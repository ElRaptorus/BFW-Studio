/**
 * Worker Thread entry point for plugin sandboxes.
 * Each plugin runs in its own Worker Thread with a SES Compartment.
 *
 * Security-critical: This file establishes the isolation boundary between
 * the plugin code and the host system.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parentPort, workerData } from 'worker_threads';

import type { PluginPermission } from '../permissions/PermissionTypes';
import { createModuleGate } from './ModuleGate';

// ─── Worker Data ─────────────────────────────────────────────────────

interface SandboxWorkerData {
  pluginName: string;
  pluginPath: string;
  storagePath: string;
  permissions: PluginPermission[];
}

const { pluginName, pluginPath, storagePath, permissions } = workerData as SandboxWorkerData;

if (parentPort == null) {
  throw new Error('sandbox-worker must be run as a Worker Thread');
}

const port = parentPort;

// ─── SES Lockdown ────────────────────────────────────────────────────

require('ses');

// @ts-expect-error - lockdown is a global added by ses
lockdown({
  errorTaming: 'unsafe',
  consoleTaming: 'unsafe',
});

// ─── Module Gate ─────────────────────────────────────────────────────

const gatedRequire = createModuleGate(pluginName, pluginPath, permissions);

// ─── Sandboxed Process Subset ────────────────────────────────────────

function createFrozenProcessSubset(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    versions: Object.freeze({ ...process.versions }),
  });
}

// ─── Console Proxy ───────────────────────────────────────────────────

function createSandboxedConsole(): Console {
  function send(level: string, args: unknown[]): void {
    const serialized = args.map((arg) => {
      try {
        return typeof arg === 'string' ? arg : JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    });
    port.postMessage({ type: 'console', level, args: serialized });
  }

  return {
    log: (...args: unknown[]) => send('log', args),
    info: (...args: unknown[]) => send('info', args),
    warn: (...args: unknown[]) => send('warn', args),
    error: (...args: unknown[]) => send('error', args),
    debug: (...args: unknown[]) => send('debug', args),
    trace: (...args: unknown[]) => send('trace', args),
    dir: (...args: unknown[]) => send('log', args),
    time: () => {},
    timeEnd: () => {},
    timeLog: () => {},
    assert: (condition: unknown, ...args: unknown[]) => {
      if (!condition) {
        send('error', ['Assertion failed:', ...args]);
      }
    },
    clear: () => {},
    count: () => {},
    countReset: () => {},
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    table: (...args: unknown[]) => send('log', args),
    profile: () => {},
    profileEnd: () => {},
    timeStamp: () => {},
    Console: console.Console,
  } as unknown as Console;
}

// ─── Sandboxed API Proxy ─────────────────────────────────────────────

const WORKER_REQUEST_TIMEOUT_MS = 30_000;

const pendingRequests = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();
let requestCounter = 0;

function assertNoFunctions(args: unknown[], context: string): void {
  function check(value: unknown, path: string): void {
    if (typeof value === 'function') {
      throw new Error(
        `[sandbox-worker] Cannot send a function at ${path} in ${context}. ` +
          'Callbacks must be registered via the callback API, not passed as arguments.',
      );
    }
    if (value != null && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (let j = 0; j < value.length; j++) {
          check(value[j], `${path}[${j}]`);
        }
      } else {
        const obj = value as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
          check(obj[key], `${path}.${key}`);
        }
      }
    }
  }

  for (let i = 0; i < args.length; i++) {
    check(args[i], `argument[${i}]`);
  }
}

function sendApiRequest(namespace: string, method: string, args: unknown[]): Promise<unknown> {
  assertNoFunctions(args, `${namespace}.${method}`);
  const requestId = `w-${pluginName}-${++requestCounter}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(
          `[sandbox-worker] API request ${namespace}.${method} (${requestId}) timed out after ${WORKER_REQUEST_TIMEOUT_MS}ms`,
        ),
      );
    }, WORKER_REQUEST_TIMEOUT_MS);
    pendingRequests.set(requestId, { resolve, reject, timer });
    port.postMessage({
      type: 'host.apiRequest',
      requestId,
      payload: { namespace, method, args },
    });
  });
}

function sendRegisterCallback(
  callbackId: string,
  namespace: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  assertNoFunctions(args, `registerCallback:${namespace}.${method}`);
  const requestId = `w-${pluginName}-${++requestCounter}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(
          `[sandbox-worker] Callback registration ${namespace}.${method} (${requestId}) timed out after ${WORKER_REQUEST_TIMEOUT_MS}ms`,
        ),
      );
    }, WORKER_REQUEST_TIMEOUT_MS);
    pendingRequests.set(requestId, { resolve, reject, timer });
    port.postMessage({
      type: 'host.registerCallback',
      requestId,
      payload: { callbackId, namespace, method, args },
    });
  });
}

function sendUnregisterCallback(callbackId: string): void {
  port.postMessage({
    type: 'host.unregisterCallback',
    payload: { callbackId },
  });
}

function sendCallbackResult(
  callbackId: string,
  invocationId: string,
  success: boolean,
  result?: unknown,
  error?: string,
): void {
  port.postMessage({
    type: 'host.callbackResult',
    requestId: invocationId,
    payload: { callbackId, invocationId, success, result, error },
  });
}

// ─── Callback Registry (per-Worker) ─────────────────────────────────

const localCallbacks = new Map<string, (...args: unknown[]) => unknown>();
const eventCallbackMap = new Map<string, string[]>();

function registerLocalCallback(callbackId: string, callback: (...args: unknown[]) => unknown): void {
  localCallbacks.set(callbackId, callback);
}

function unregisterLocalCallback(callbackId: string): void {
  localCallbacks.delete(callbackId);
}

function registerEventCallback(eventName: string, callbackId: string): void {
  const ids = eventCallbackMap.get(eventName) ?? [];
  ids.push(callbackId);
  eventCallbackMap.set(eventName, ids);
}

function unregisterEventCallback(eventName: string, callbackId: string): void {
  const ids = eventCallbackMap.get(eventName);
  if (ids == null) {
    return;
  }
  const idx = ids.indexOf(callbackId);
  if (idx !== -1) {
    ids.splice(idx, 1);
  }
  if (ids.length === 0) {
    eventCallbackMap.delete(eventName);
  }
}

// ─── Build Plugin-facing API ─────────────────────────────────────────

function createPluginApi(): Record<string, unknown> {
  const { randomUUID } = require('crypto') as { randomUUID: () => string };

  function createCallbackApi(namespace: string) {
    return {
      async register(
        method: string,
        args: unknown[],
        callback: (...cbArgs: unknown[]) => unknown,
      ): Promise<{ dispose: () => void }> {
        const callbackId = randomUUID();
        registerLocalCallback(callbackId, callback);
        await sendRegisterCallback(callbackId, namespace, method, args);
        return {
          dispose() {
            unregisterLocalCallback(callbackId);
            sendUnregisterCallback(callbackId);
          },
        };
      },
    };
  }

  function createNamespaceProxy(namespace: string) {
    return new Proxy(
      {},
      {
        get(_target, method: string) {
          return (...args: unknown[]) => sendApiRequest(namespace, method, args);
        },
      },
    );
  }

  const commandsCallbackApi = createCallbackApi('commands');
  const settingsCallbackApi = createCallbackApi('settings');
  const webviewsCallbackApi = createCallbackApi('webviews');
  const notificationsCallbackApi = createCallbackApi('notifications');
  const editorsCallbackApi = createCallbackApi('editors');
  const workspaceCallbackApi = createCallbackApi('workspace');
  const diagnosticsCallbackApi = createCallbackApi('diagnostics');
  const bpmnCallbackApi = createCallbackApi('bpmn');

  return {
    commands: {
      register(
        id: string,
        callback: (...cbArgs: unknown[]) => unknown,
        options?: { description?: string | string[]; visibleInSearch?: boolean },
      ): Promise<{ dispose: () => void }> {
        return commandsCallbackApi.register('register', [id, options ?? {}], callback);
      },
      executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
        return sendApiRequest('commands', 'executeCommand', [commandId, ...args]);
      },
      tryToExecuteCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
        return sendApiRequest('commands', 'tryToExecuteCommand', [commandId, ...args]);
      },
      isCommandEnabled(commandId: string, ...args: unknown[]): Promise<unknown> {
        return sendApiRequest('commands', 'isCommandEnabled', [commandId, ...args]);
      },
      isRegistered(commandId: string): Promise<unknown> {
        return sendApiRequest('commands', 'isRegistered', [commandId]);
      },
      getCommands(): Promise<unknown> {
        return sendApiRequest('commands', 'getCommands', []);
      },
      disposeCallbacks() {
        /* no-op in sandbox — cleanup handled by SandboxManager */
      },
    },
    diagnostics: new Proxy(
      {
        onDidChange(callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
          return diagnosticsCallbackApi.register('onDidChange', [], callback);
        },
      } as Record<string, unknown>,
      {
        get(target: Record<string, unknown>, method: string) {
          const val = target[method];
          if (typeof val === 'function') {
            return val;
          }
          return (...args: unknown[]) => sendApiRequest('diagnostics', method, args);
        },
      },
    ),
    dialogs: createNamespaceProxy('dialogs'),
    notifications: {
      open(...args: unknown[]): Promise<unknown> {
        return sendApiRequest('notifications', 'open', args);
      },
      close(...args: unknown[]): Promise<unknown> {
        return sendApiRequest('notifications', 'close', args);
      },
      update(...args: unknown[]): Promise<unknown> {
        return sendApiRequest('notifications', 'update', args);
      },
      onResponse(
        notificationId: string,
        callback: (...cbArgs: unknown[]) => unknown,
      ): Promise<{ dispose: () => void }> {
        return notificationsCallbackApi.register('onResponse', [notificationId], callback);
      },
      showWithActions(
        content: string,
        actions: string[],
        callback: (...cbArgs: unknown[]) => unknown,
      ): Promise<{ dispose: () => void }> {
        return notificationsCallbackApi.register('showWithActions', [content, actions], callback);
      },
    },
    settings: new Proxy(
      {
        onDidChange(key: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
          return settingsCallbackApi.register('onDidChange', [key], callback);
        },
        disposeCallbacks() {
          /* no-op */
        },
      } as Record<string, unknown>,
      {
        get(target: Record<string, unknown>, method: string) {
          const val = target[method];
          if (typeof val === 'function') {
            return val;
          }
          return (...args: unknown[]) => sendApiRequest('settings', method, args);
        },
      },
    ),
    events: {
      async on(eventName: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        const callbackId = randomUUID();
        registerLocalCallback(callbackId, callback);
        registerEventCallback(eventName, callbackId);
        await sendRegisterCallback(callbackId, 'events', 'on', [eventName]);
        return {
          dispose() {
            unregisterLocalCallback(callbackId);
            unregisterEventCallback(eventName, callbackId);
            sendUnregisterCallback(callbackId);
          },
        };
      },
      disposeCallbacks() {
        /* no-op */
      },
    },
    webviews: {
      postMessage(...args: unknown[]): Promise<unknown> {
        return sendApiRequest('webviews', 'postMessage', args);
      },
      onMessage(iframeId: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        return webviewsCallbackApi.register('onMessage', [iframeId], callback);
      },
      disposeCallbacks() {
        /* no-op */
      },
    },
    editors: new Proxy(
      {
        onDidOpen(
          documentTypeLocalId: string,
          callback: (...cbArgs: unknown[]) => unknown,
        ): Promise<{ dispose: () => void }> {
          return editorsCallbackApi.register('onDidOpen', [documentTypeLocalId], callback);
        },
        onSaveRequest(
          documentType: string,
          callback: (...cbArgs: unknown[]) => unknown,
        ): Promise<{ dispose: () => void }> {
          return editorsCallbackApi.register('onSaveRequest', [documentType], callback);
        },
        disposeCallbacks() {
          /* no-op in sandbox */
        },
      } as Record<string, unknown>,
      {
        get(target: Record<string, unknown>, method: string) {
          const val = target[method];
          if (typeof val === 'function') {
            return val;
          }
          return (...args: unknown[]) => sendApiRequest('editors', method, args);
        },
      },
    ),
    panes: createNamespaceProxy('panes'),
    statusBar: new Proxy(
      {
        async showProgress(label: string): Promise<{ update: (l: string) => void; done: () => void }> {
          const handleId = (await sendApiRequest('statusBar', 'showProgress', [label])) as string;
          return {
            update(newLabel: string) {
              sendApiRequest('statusBar', 'progressUpdate', [handleId, newLabel]);
            },
            done() {
              sendApiRequest('statusBar', 'progressDone', [handleId]);
            },
          };
        },
      } as Record<string, unknown>,
      {
        get(target: Record<string, unknown>, method: string) {
          const val = target[method];
          if (typeof val === 'function') {
            return val;
          }
          return (...args: unknown[]) => sendApiRequest('statusBar', method, args);
        },
      },
    ),
    menuBar: createNamespaceProxy('menuBar'),
    menus: createNamespaceProxy('menus'),
    workspace: new Proxy(
      {
        onDidChangeFile(uri: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
          return workspaceCallbackApi.register('onDidChangeFile', [uri], callback);
        },
        onDidChangeSolution(callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
          return workspaceCallbackApi.register('onDidChangeSolution', [], callback);
        },
        disposeCallbacks() {
          /* no-op in sandbox */
        },
      } as Record<string, unknown>,
      {
        get(target: Record<string, unknown>, method: string) {
          const val = target[method];
          if (typeof val === 'function') {
            return val;
          }
          return (...args: unknown[]) => sendApiRequest('workspace', method, args);
        },
      },
    ),
    views: createNamespaceProxy('views'),
    themes: createNamespaceProxy('themes'),
    bpmn: {
      setOverlays(uri: string, overlays: unknown[]): Promise<unknown> {
        return sendApiRequest('bpmn', 'setOverlays', [uri, overlays]);
      },
      clearOverlays(uri: string, filter?: unknown): Promise<unknown> {
        return sendApiRequest('bpmn', 'clearOverlays', [uri, filter]);
      },
      getElements(uri: string): Promise<unknown> {
        return sendApiRequest('bpmn', 'getElements', [uri]);
      },
      getElement(uri: string, elementId: string): Promise<unknown> {
        return sendApiRequest('bpmn', 'getElement', [uri, elementId]);
      },
      getXml(uri: string): Promise<unknown> {
        return sendApiRequest('bpmn', 'getXml', [uri]);
      },
      onElementSelected(uri: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('onElementSelected', [uri], callback);
      },
      onElementHover(uri: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('onElementHover', [uri], callback);
      },
      onElementDoubleClick(uri: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('onElementDoubleClick', [uri], callback);
      },
      onElementContextMenu(uri: string, callback: (...cbArgs: unknown[]) => unknown): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('onElementContextMenu', [uri], callback);
      },
      onOverlayContextChanged(
        uri: string,
        callback: (...cbArgs: unknown[]) => unknown,
      ): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('onOverlayContextChanged', [uri], callback);
      },
      registerOverlayFactory(
        factory: (...cbArgs: unknown[]) => unknown,
        options?: { priority?: number },
      ): Promise<{ dispose: () => void }> {
        return bpmnCallbackApi.register('registerOverlayFactory', [options], factory);
      },
      registerPaletteEntry(entry: unknown): Promise<unknown> {
        return sendApiRequest('bpmn', 'registerPaletteEntry', [entry]);
      },
      unregisterPaletteEntry(entryId: string): Promise<unknown> {
        return sendApiRequest('bpmn', 'unregisterPaletteEntry', [entryId]);
      },
      registerContextPadEntry(entry: unknown): Promise<unknown> {
        return sendApiRequest('bpmn', 'registerContextPadEntry', [entry]);
      },
      unregisterContextPadEntry(entryId: string): Promise<unknown> {
        return sendApiRequest('bpmn', 'unregisterContextPadEntry', [entryId]);
      },
      updateContextPadEntry(entryId: string, update: unknown): Promise<unknown> {
        return sendApiRequest('bpmn', 'updateContextPadEntry', [entryId, update]);
      },
      disposeCallbacks() {
        /* no-op in sandbox — cleanup handled by SandboxManager */
      },
    },
    env: Object.freeze({
      pluginPath,
      pluginName,
      storagePath,
      apiVersion: '1.0.0',
    }),
  };
}

// ─── Load Plugin ─────────────────────────────────────────────────────

async function loadAndActivatePlugin(): Promise<void> {
  const pkgPath = path.join(pluginPath, 'package.json');
  const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(pkgRaw);

  const mainEntry = pkg.main ?? 'index.js';
  const mainPath = path.resolve(pluginPath, mainEntry);
  const pluginCode = fs.readFileSync(mainPath, 'utf-8');

  const sandboxConsole = createSandboxedConsole();
  const api = createPluginApi();

  // @ts-expect-error - Compartment is a global added by ses lockdown
  const compartment = new Compartment({
    __options__: true,
    globals: {
      console: sandboxConsole,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      setImmediate,
      clearImmediate,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      atob,
      btoa,
      Date,
      Math,
      structuredClone,
      queueMicrotask,
      crypto: Object.freeze({
        randomUUID: require('crypto').randomUUID,
        getRandomValues: require('crypto').getRandomValues.bind(require('crypto')),
      }),
      require: gatedRequire,
      __dirname: pluginPath,
      __filename: mainPath,
      process: createFrozenProcessSubset(),
    },
  });

  const wrappedCode = `(function(exports, require, module, __filename, __dirname) {\n${pluginCode}\n})`;
  const factory = compartment.evaluate(wrappedCode);

  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports };

  factory(moduleExports, gatedRequire, moduleObj, mainPath, pluginPath);

  const pluginModule = moduleObj.exports as Record<string, unknown>;

  // Hoisted so the deactivate handler can reference it after activation assigns it.
  let deactivateFn: (() => void | Promise<void>) | undefined;

  // Register message handlers BEFORE activate() so that API responses,
  // callback registrations, and callback invocations can be processed
  // while the plugin's activate() is still running.
  port.on('message', async (msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'sandbox:deactivate') {
      try {
        await deactivateFn?.();
      } catch (err) {
        sandboxConsole.error('Error during deactivate:', err);
      }
      process.exit(0);
    }

    if (msg.type === 'host.callbackInvocation') {
      const { callbackId, args, invocationId } = msg as unknown as {
        callbackId: string;
        args: unknown[];
        invocationId: string;
      };
      const callback = localCallbacks.get(callbackId);
      if (callback == null) {
        sendCallbackResult(callbackId, invocationId, false, undefined, `Unknown callback: ${callbackId}`);
        return;
      }
      try {
        const result = await callback(...(args ?? []));
        sendCallbackResult(callbackId, invocationId, true, result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendCallbackResult(callbackId, invocationId, false, undefined, errorMsg);
      }
    }

    if (msg.type === 'apiResponse') {
      const requestId = msg.requestId as string;
      const payload = msg.payload as { success: boolean; result?: unknown; error?: string };
      const pending = pendingRequests.get(requestId);
      if (pending != null) {
        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);
        if (payload.success) {
          pending.resolve(payload.result);
        } else {
          pending.reject(new Error(payload.error ?? 'Unknown API error'));
        }
      }
    }

    if (msg.type === 'registerCallbackResponse') {
      const requestId = msg.requestId as string;
      const payload = msg.payload as { success: boolean; result?: unknown; error?: string };
      const pending = pendingRequests.get(requestId);
      if (pending != null) {
        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);
        if (payload.success) {
          pending.resolve(payload.result);
        } else {
          pending.reject(new Error(payload.error ?? 'Unknown callback registration error'));
        }
      }
    }

    if (msg.type === 'host.event') {
      const { eventName, args } = msg.payload as { eventName: string; args: unknown[] };
      const callbackIds = eventCallbackMap.get(eventName);
      if (callbackIds != null) {
        for (const cbId of callbackIds) {
          const cb = localCallbacks.get(cbId);
          if (cb != null) {
            try {
              cb(...(args ?? []));
            } catch (err) {
              sandboxConsole.error(`Error in event callback for '${eventName}':`, err);
            }
          }
        }
      }
    }
  });

  if (typeof pluginModule.activate === 'function') {
    await pluginModule.activate(api);
  } else if (
    pluginModule.default != null &&
    typeof pluginModule.default === 'object' &&
    typeof (pluginModule.default as Record<string, unknown>).activate === 'function'
  ) {
    await (pluginModule.default as Record<string, (...args: unknown[]) => unknown>).activate(api);
  } else {
    throw new Error(`Plugin '${pluginName}' has no activate() export`);
  }

  // Assign deactivate after activation so the hoisted handler can use it.
  if (typeof pluginModule.deactivate === 'function') {
    deactivateFn = pluginModule.deactivate as () => void | Promise<void>;
  } else if (
    pluginModule.default != null &&
    typeof pluginModule.default === 'object' &&
    typeof (pluginModule.default as Record<string, unknown>).deactivate === 'function'
  ) {
    deactivateFn = (pluginModule.default as Record<string, () => void | Promise<void>>).deactivate;
  }
}

// ─── Start ───────────────────────────────────────────────────────────

loadAndActivatePlugin()
  .then(() => {
    port.postMessage({ type: 'sandbox:ready' });
  })
  .catch((err) => {
    port.postMessage({
      type: 'sandbox:error',
      error: err instanceof Error ? err.message : String(err),
    });
  });
