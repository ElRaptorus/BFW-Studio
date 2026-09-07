import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EVENT_DIAGNOSTICS_CHANGED } from '#bifrost/common/DiagnosticsManager';
import type { WatcherDisposable } from '#bifrost/common/FileHandlingService';
import { insertAfterMenuBarItem, insertBeforeMenuBarItem } from '#bifrost/common/MenuBarModifierFunctions';
import { EVENT_SOLUTION_CHANGED } from '#bifrost/common/SolutionManager';
import { canAccessCommand, checkCommandAccess } from '#bifrost/common/plugin-host/permissions/CommandDenylist';
import { PermissionDeniedError, PermissionGate } from '#bifrost/common/plugin-host/permissions/PermissionGate';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  type ApiRequestPayload,
  type CallbackInvocationPayload,
  PH_CALLBACK_INVOCATION,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import type { ProgressHandle, StatusBarItem, StatusBarItemArea } from '#bifrost/contracts/StatusBarTypes';
import { EVENT_EDITOR_AREA_FOCUS_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import type { PluginIframeManager } from '#components/webview/PluginIframeManager';
import { ipcRenderer } from 'electron';
import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';

import type { Menu, MenuItem } from '@evil/bifrost_fw_sdk';

import { BpmnApiBridge } from './BpmnApiBridge';
import { DmnApiBridge } from './DmnApiBridge';
import { createIframeDocumentRendererConstructor } from './IframeDocumentRenderer';
import { createIframePaneProvider } from './IframePaneProvider';
import type { PluginHost } from './PluginHost';
import { createTreeViewPaneProvider } from './TreeViewPaneProvider';
import type { ContributionRegistrar } from './manifest/ContributionRegistrar';

/**
 * Renderer-side bridge that executes Plugin Host API requests
 * against the real Bifrost instance. No IPC — communicates with
 * the child process directly through PluginHost's connection.
 *
 * Callbacks are grouped by plugin name so that individual plugin
 * cleanup (future) and bulk cleanup on dispose/refresh both work.
 */
export class PluginHostBridge {
  private bifrost: Bifrost;
  private pluginHost: PluginHost;
  private pluginIframeManager: PluginIframeManager;
  readonly permissionGate = new PermissionGate();

  /**
   * Grouped by plugin name, then by callbackId.
   * The plugin name is extracted from the namespaced command ID
   * (`plugin.<pluginName>.<commandId>`).
   */
  private registeredCallbacks = new Map<string, Map<string, { disposer: () => void }>>();

  /** Maps namespaced document type IDs to onDidOpen callback IDs. */
  private onDidOpenCallbacks = new Map<string, string>();

  /** Maps URI patterns to display names for plugin-registered editor document types. */
  private documentTypeLabels = new Map<string, { uriPattern: RegExp; displayName: string }>();

  /**
   * Per-plugin stored status bar item arrays.
   * Key: `pluginName:statusBarItemId` → items array.
   */
  private statusBarItems = new Map<string, StatusBarItem[]>();

  /**
   * Active progress handles created by plugins, keyed by handleId.
   * Used for cleanup when a plugin is disabled/uninstalled.
   */
  private progressHandles = new Map<string, { pluginName: string; handle: ProgressHandle }>();
  private nextProgressHandleId = 0;

  /** The plugin that currently has an open dialog (for cleanup on disable). */
  private activeDialogOwner: string | null = null;

  /**
   * File watchers created by plugins via `api.workspace.onDidChangeFile`.
   * Key: callbackId. Disposed when the callback is unregistered or the plugin is disabled.
   */
  private activeFileWatchers = new Map<string, WatcherDisposable>();

  /**
   * Pane visibility state set by plugins via `api.panes.setVisible`.
   * Key: fully namespaced paneId (e.g. `plugin.myPlugin.sidebar`).
   * Panes without an entry default to visible.
   * Cleared per-plugin in {@link disposePlugin}.
   */
  private paneVisibility = new Map<string, boolean>();

  /**
   * Tree view data pushed by plugins via `api.views.updateTreeData`.
   * Key: fully namespaced viewId (e.g. `plugin.myPlugin.fileTree`).
   */
  private treeViewData = new Map<string, unknown[]>();

  /**
   * Tree view data change listeners. When `updateTreeData` is called,
   * all listeners for that viewId are notified so the React component re-renders.
   */
  private treeViewListeners = new Map<string, Set<() => void>>();

  /**
   * Plugin-contributed theme tokens, keyed by namespaced theme ID.
   * Each entry maps to a `<style>` element injected into the document.
   */
  private pluginThemeStyles = new Map<string, HTMLStyleElement>();

  /**
   * Tracks which plugin registered which themes (for cleanup on disable).
   */
  private pluginThemeIds = new Map<string, Set<string>>();

  /** Lazily computed base directory for all plugin storage. */
  private pluginStorageBase: string | null = null;

  private contributionRegistrar: ContributionRegistrar | null = null;

  private bpmnBridge: BpmnApiBridge;
  private dmnBridge: DmnApiBridge;

  constructor(bifrost: Bifrost, pluginHost: PluginHost, pluginIframeManager: PluginIframeManager) {
    this.bifrost = bifrost;
    this.pluginHost = pluginHost;
    this.pluginIframeManager = pluginIframeManager;
    this.bpmnBridge = new BpmnApiBridge(bifrost, pluginHost);
    this.dmnBridge = new DmnApiBridge(bifrost, pluginHost);
  }

  setContributionRegistrar(registrar: ContributionRegistrar): void {
    this.contributionRegistrar = registrar;
  }

  private getPluginStorageBase(): string {
    if (this.pluginStorageBase == null) {
      if (process.env.BFR_PLUGIN_STORAGE_PATH) {
        this.pluginStorageBase = path.resolve(process.env.BFR_PLUGIN_STORAGE_PATH);
      } else {
        const platform = os.platform();
        let cacheBase: string;
        if (platform === 'darwin') {
          cacheBase = path.join(os.homedir(), 'Library', 'Caches');
        } else if (platform === 'win32') {
          cacheBase = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
        } else {
          cacheBase = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
        }
        const channel = process.env.BFR_STUDIO_CHANNEL ?? 'dev';
        this.pluginStorageBase = path.join(cacheBase, `bifrost-forge-world-${channel}`, 'plugin-storage');
      }
    }
    return this.pluginStorageBase;
  }

  async executeApiRequest(payload: ApiRequestPayload): Promise<unknown> {
    const { namespace, method, args, pluginName } = payload;
    const callerName = pluginName ?? 'unknown';

    switch (namespace) {
      case 'commands':
        return this.handleCommandsApi(method, args, callerName);
      case 'diagnostics':
        return this.handleDiagnosticsApi(method, args, callerName);
      case 'dialogs':
        return this.handleDialogsApi(method, args, callerName);
      case 'notifications':
        return this.handleNotificationsApi(method, args);
      case 'settings':
        return this.handleSettingsApi(method, args, callerName);
      case 'webviews':
        return this.handleWebviewsApi(method, args, callerName);
      case 'editors':
        return this.handleEditorsApi(method, args, callerName);
      case 'panes':
        return this.handlePanesApi(method, args, callerName);
      case 'statusBar':
        return this.handleStatusBarApi(method, args, callerName);
      case 'menuBar':
        return this.handleMenuBarApi(method, args, callerName);
      case 'menus':
        return this.handleMenusApi(method, args, callerName);
      case 'workspace':
        this.permissionGate.assert(callerName, 'filesystem', `workspace.${method}`);
        return this.handleWorkspaceApi(method, args, callerName);
      case 'views':
        return this.handleViewsApi(method, args, callerName);
      case 'themes':
        return this.handleThemesApi(method, args, callerName);
      case 'bpmn':
        this.permissionGate.assert(callerName, 'bpmn', `bpmn.${method}`);
        if (
          method === 'registerPaletteEntry' ||
          method === 'unregisterPaletteEntry' ||
          method === 'registerContextPadEntry' ||
          method === 'unregisterContextPadEntry' ||
          method === 'updateContextPadEntry' ||
          method.startsWith('modeling.')
        ) {
          this.permissionGate.assert(callerName, 'bpmn.modelling', `bpmn.${method}`);
        }
        if (method === 'postToRendererModule') {
          this.permissionGate.assert(callerName, 'bpmn.renderer', `bpmn.${method}`);
        }
        return this.bpmnBridge.handleApiRequest(method, args, callerName);
      case 'dmn':
        this.permissionGate.assert(callerName, 'dmn', `dmn.${method}`);
        if (
          method === 'registerPaletteEntry' ||
          method === 'unregisterPaletteEntry' ||
          method === 'registerContextPadEntry' ||
          method === 'unregisterContextPadEntry' ||
          method === 'updateContextPadEntry' ||
          method.startsWith('modeling.')
        ) {
          this.permissionGate.assert(callerName, 'dmn.modelling', `dmn.${method}`);
        }
        if (method === 'postToRendererModule') {
          this.permissionGate.assert(callerName, 'dmn.renderer', `dmn.${method}`);
        }
        return this.dmnBridge.handleApiRequest(method, args, callerName);
      default:
        throw new Error(`Unknown API namespace: ${namespace}`);
    }
  }

  registerCallback(payload: RegisterCallbackPayload): void {
    const { callbackId, namespace, method, args, pluginName: callerName } = payload;

    if (namespace === 'commands' && method === 'register') {
      const [rawCommandId, options] = args as [string, { description?: string | string[]; visibleInSearch?: boolean }];
      const pluginName = callerName ?? this.extractPluginName(rawCommandId);
      const commandId = this.ensurePluginPrefix(rawCommandId, pluginName);

      const handler = async (...handlerArgs: unknown[]) => {
        return this.pluginHost.getConnection()!.request(PH_CALLBACK_INVOCATION, {
          callbackId,
          args: handlerArgs,
        } satisfies CallbackInvocationPayload);
      };

      // If the command was registered as a stub by the ContributionRegistrar,
      // unregister the stub and re-register with the original description so
      // the command stays searchable.
      const stubDescription = this.contributionRegistrar?.stubCommandIds.get(commandId);
      if (stubDescription != null) {
        try {
          this.bifrost.commands.unregister(commandId);
        } catch {
          /* already unregistered */
        }
        this.contributionRegistrar!.stubCommandIds.delete(commandId);
        this.bifrost.commands.register(commandId, handler, {
          visibleInSearch: true,
          description: options?.description ?? stubDescription,
        });
      } else {
        this.bifrost.commands.register(commandId, handler, {
          visibleInSearch: options?.visibleInSearch,
          description: options?.description,
        });
      }

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          this.bifrost.commands.unregister(commandId);
        },
      });
      return;
    }

    if (namespace === 'settings' && method === 'onDidChange') {
      const [key] = args as [string];
      const pluginName = callerName ?? this.extractPluginName(key);

      const subscription: AbstractSubscription = this.bifrost.settings.on(
        EVENT_SETTINGS_CHANGED,
        (changedKey: string, newValue: unknown) => {
          if (changedKey !== key) {
            return;
          }
          this.pluginHost.getConnection()!.request(PH_CALLBACK_INVOCATION, {
            callbackId,
            args: [newValue],
          } satisfies CallbackInvocationPayload);
        },
      );

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => subscription.dispose(),
      });
      return;
    }

    if (namespace === 'webviews' && method === 'onMessage') {
      const [iframeId] = args as [string];
      const pluginName = callerName ?? this.extractPluginNameFromCallbackId(callbackId);

      const iframeEntry = this.pluginIframeManager.getIframe(iframeId);
      if (iframeEntry != null && iframeEntry.pluginName !== pluginName) {
        throw new PermissionDeniedError(
          pluginName,
          'webviews',
          `Cannot register message handler for iframe '${iframeId}' owned by '${iframeEntry.pluginName}'`,
        );
      }

      const handler = (data: unknown): void => {
        this.pluginHost.getConnection()!.request(PH_CALLBACK_INVOCATION, {
          callbackId,
          args: [data],
        } satisfies CallbackInvocationPayload);
      };

      this.pluginIframeManager.setMessageHandler(iframeId, handler);

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          this.pluginIframeManager.setMessageHandler(iframeId, undefined);
        },
      });
      return;
    }

    if (namespace === 'notifications' && method === 'onResponse') {
      const [notificationId] = args as [string];
      const pluginName = callerName ?? '_unknown';

      const allNotifications = this.bifrost.notifications.getAllNotifications();
      const notification = allNotifications.find((entry) => entry.id === notificationId);

      if (notification != null) {
        const originalCallback = notification.responseCallbackFn;

        (notification as any).responseCallbackFn = (action: { action: string; label: string }) => {
          originalCallback(action);
          this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
            callbackId,
            args: [{ action: action.action, label: action.label }],
          } satisfies CallbackInvocationPayload);
        };
      }

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          // Response callbacks are transient — no external cleanup needed
        },
      });
      return;
    }

    if (namespace === 'notifications' && method === 'showWithActions') {
      const [content, actions] = args as [string, string[]];
      const pluginName = callerName ?? '_unknown';

      const actionObjects = actions.map((label) => ({ action: label, label }));

      const notificationId = this.bifrost.notifications.open({
        type: 'info' as const,
        content,
        actions: actionObjects,
      });

      const allNotifications = this.bifrost.notifications.getAllNotifications();
      const notification = allNotifications.find((entry) => entry.id === notificationId);

      if (notification != null) {
        const originalCallback = notification.responseCallbackFn;

        (notification as any).responseCallbackFn = (action: { action: string; label: string }) => {
          originalCallback(action);
          this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
            callbackId,
            args: [{ action: action.action, label: action.label }],
          } satisfies CallbackInvocationPayload);
        };
      }

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          // Notification + callback are transient
        },
      });
      return;
    }

    if (namespace === 'diagnostics' && method === 'onDidChange') {
      const pluginName = callerName ?? '_unknown';

      const subscription = this.bifrost.diagnostics.on(EVENT_DIAGNOSTICS_CHANGED, () => {
        this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
          callbackId,
          args: [],
        } satisfies CallbackInvocationPayload);
      });

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => subscription.dispose(),
      });
      return;
    }

    if (namespace === 'editors' && method === 'onDidOpen') {
      const pluginName = callerName ?? '_unknown';
      const [documentTypeLocalId] = args as [string];
      const documentTypeId = `plugin.${pluginName}.${documentTypeLocalId}`;

      this.onDidOpenCallbacks.set(documentTypeId, callbackId);

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          this.onDidOpenCallbacks.delete(documentTypeId);
        },
      });
      return;
    }

    if (namespace === 'workspace' && method === 'onDidChangeFile') {
      const pluginName = callerName ?? '_unknown';
      const [uri] = args as [string];

      this.permissionGate.assert(pluginName, 'filesystem', 'workspace.onDidChangeFile');
      this.assertUriInScope(pluginName, uri);

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let pendingEvent: { type: string; uri: string } | null = null;

      const coalesceAndForward = (eventUri: string, changeType: string): void => {
        pendingEvent = { type: changeType, uri: eventUri };
        if (debounceTimer == null) {
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            if (pendingEvent != null) {
              this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
                callbackId,
                args: [pendingEvent],
              } satisfies CallbackInvocationPayload);
              pendingEvent = null;
            }
          }, 100);
        }
      };

      const mapChokidarEvent = (eventType: string): string | null => {
        switch (eventType) {
          case 'add':
          case 'addDir':
            return 'created';
          case 'change':
            return 'changed';
          case 'unlink':
          case 'unlinkDir':
            return 'deleted';
          default:
            return null;
        }
      };

      const watchCallback = (eventType: string, filePath: string): void => {
        const mappedType = mapChokidarEvent(eventType);
        if (mappedType != null) {
          const fileUri = this.bifrost.files.getUriForFilename(filePath);
          coalesceAndForward(fileUri, mappedType);
        }
      };

      const watcher = this.bifrost.files.watchDirectory(uri, watchCallback);

      this.activeFileWatchers.set(callbackId, watcher);

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          if (debounceTimer != null) {
            clearTimeout(debounceTimer);
          }
          watcher.dispose();
          this.activeFileWatchers.delete(callbackId);
        },
      });
      return;
    }

    if (namespace === 'workspace' && method === 'onDidChangeSolution') {
      const pluginName = callerName ?? '_unknown';

      this.permissionGate.assert(pluginName, 'filesystem', 'workspace.onDidChangeSolution');

      const subscription: AbstractSubscription = this.bifrost.solution.on(EVENT_SOLUTION_CHANGED, () => {
        this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
          callbackId,
          args: [],
        } satisfies CallbackInvocationPayload);
      });

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => subscription.dispose(),
      });
      return;
    }

    if (namespace === 'events' && method === 'on') {
      const pluginName = callerName ?? '_unknown';
      const [eventName] = args as [string];

      if (eventName === 'editorFocusChanged') {
        const subscription = this.bifrost.editors.on(
          EVENT_EDITOR_AREA_FOCUS_UPDATED,
          (focusedDoc: EditorDocument | null) => {
            let payload: { uri: string | null; documentType: string | null };
            if (focusedDoc != null) {
              let documentType: string | null = null;
              try {
                const typeDef = this.bifrost.editors.getDocumentTypeDefinitionByUri(focusedDoc.uri);
                documentType = typeDef.documentType;
              } catch {
                /* URI has no registered document type */
              }
              payload = { uri: focusedDoc.uri, documentType };
            } else {
              payload = { uri: null, documentType: null };
            }
            this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
              callbackId,
              args: [payload],
            } satisfies CallbackInvocationPayload);
          },
        );

        this.getOrCreatePluginGroup(pluginName).set(callbackId, {
          disposer: () => subscription.dispose(),
        });
      }
      return;
    }

    if (namespace === 'editors' && method === 'onSaveRequest') {
      const pluginName = callerName ?? '_unknown';
      const [uri] = args as [string];

      const saveDelegate = async (): Promise<void> => {
        await this.pluginHost.getConnection()!.request(PH_CALLBACK_INVOCATION, {
          callbackId,
          args: [],
        } satisfies CallbackInvocationPayload);
      };

      this.bifrost.editors.registerSaveDelegate(uri, saveDelegate);

      this.getOrCreatePluginGroup(pluginName).set(callbackId, {
        disposer: () => {
          this.bifrost.editors.unregisterSaveDelegate(uri);
        },
      });
      return;
    }

    if (namespace === 'bpmn') {
      const pluginName = callerName ?? '_unknown';
      this.permissionGate.assert(pluginName, 'bpmn', `bpmn.${method}`);
      if (method === 'onRendererModuleMessage') {
        this.permissionGate.assert(pluginName, 'bpmn.renderer', `bpmn.${method}`);
      }
      this.bpmnBridge.registerCallback(payload, (name) => this.getOrCreatePluginGroup(name));
      return;
    }

    if (namespace === 'dmn') {
      const pluginName = callerName ?? '_unknown';
      this.permissionGate.assert(pluginName, 'dmn', `dmn.${method}`);
      if (method === 'onRendererModuleMessage') {
        this.permissionGate.assert(pluginName, 'dmn.renderer', `dmn.${method}`);
      }
      this.dmnBridge.registerCallback(payload, (name) => this.getOrCreatePluginGroup(name));
      return;
    }

    console.warn(
      `[PluginHostBridge] Unhandled callback registration: ${namespace}.${method} (plugin: ${callerName ?? 'unknown'}, callbackId: ${callbackId})`,
    );
  }

  unregisterCallback(callbackId: string): void {
    for (const group of this.registeredCallbacks.values()) {
      const entry = group.get(callbackId);
      if (entry != null) {
        entry.disposer();
        group.delete(callbackId);
        return;
      }
    }
  }

  deliverRendererModuleMessage(pluginName: string, data: unknown): void {
    this.bpmnBridge.deliverRendererModuleMessage(pluginName, data);
    this.dmnBridge.deliverRendererModuleMessage(pluginName, data);
  }

  disposePlugin(pluginName: string): void {
    const group = this.registeredCallbacks.get(pluginName);
    if (group) {
      for (const [key, entry] of group.entries()) {
        entry.disposer();
        this.activeFileWatchers.delete(key);
      }
      this.registeredCallbacks.delete(pluginName);
    }

    this.bpmnBridge.disposePlugin(pluginName);
    this.dmnBridge.disposePlugin(pluginName);
    this.bifrost.diagnostics.clearDiagnostics(`plugin.${pluginName}`);

    const panePrefix = `plugin.${pluginName}.`;
    let hadVisibility = false;
    for (const paneId of this.paneVisibility.keys()) {
      if (paneId.startsWith(panePrefix)) {
        this.paneVisibility.delete(paneId);
        hadVisibility = true;
      }
    }
    if (hadVisibility) {
      this.bifrost.panes.requestPaneLayoutUpdate();
    }

    if (this.activeDialogOwner === pluginName) {
      this.bifrost.dialog.close();
      this.activeDialogOwner = null;
    }

    const treePrefix = `plugin.${pluginName}.`;
    for (const viewId of this.treeViewData.keys()) {
      if (viewId.startsWith(treePrefix)) {
        this.treeViewData.delete(viewId);
        this.treeViewListeners.delete(viewId);
      }
    }

    const themeIds = this.pluginThemeIds.get(pluginName);
    if (themeIds != null) {
      for (const themeId of themeIds) {
        this.removePluginTheme(themeId, pluginName);
      }
      this.pluginThemeIds.delete(pluginName);
    }

    ipcRenderer.send('plugin:clear-resource-roots', pluginName);
  }

  dispose(): void {
    for (const group of this.registeredCallbacks.values()) {
      for (const entry of group.values()) {
        entry.disposer();
      }
    }
    this.registeredCallbacks.clear();
    this.onDidOpenCallbacks.clear();
    this.documentTypeLabels.clear();
    this.activeFileWatchers.clear();
    this.paneVisibility.clear();
    this.treeViewData.clear();
    this.treeViewListeners.clear();

    for (const styleEl of this.pluginThemeStyles.values()) {
      styleEl.remove();
    }
    this.pluginThemeStyles.clear();
    this.pluginThemeIds.clear();

    if (this.activeDialogOwner != null) {
      this.bifrost.dialog.close();
      this.activeDialogOwner = null;
    }

    this.bpmnBridge.dispose();
    this.dmnBridge.dispose();
  }

  private getOrCreatePluginGroup(pluginName: string): Map<string, { disposer: () => void }> {
    let group = this.registeredCallbacks.get(pluginName);
    if (group == null) {
      group = new Map();
      this.registeredCallbacks.set(pluginName, group);
    }
    return group;
  }

  private static readonly KNOWN_COMMAND_GROUPS = new Set([
    'std',
    'bpmn',
    'dmn',
    'git',
    'engine',
    'plugins',
    'dev',
    'plugin',
  ]);

  /**
   * Auto-prefix a plugin command ID with `plugin.<name>.` if not already prefixed.
   * This implements the transparent prefixing convention (Phase 9, Option A).
   */
  private ensurePluginPrefix(commandId: string, pluginName: string): string {
    const expectedPrefix = `plugin.${pluginName}.`;
    if (commandId.startsWith(expectedPrefix)) {
      return commandId;
    }
    return `${expectedPrefix}${commandId}`;
  }

  /**
   * Resolve a command ID for execution: if it belongs to a known group, pass through.
   * Otherwise, auto-prefix with `plugin.<name>.` so plugins can use short IDs.
   */
  private resolveCommandIdForExecution(commandId: string, pluginName: string): string {
    const firstDot = commandId.indexOf('.');
    if (firstDot > 0) {
      const group = commandId.slice(0, firstDot);
      if (PluginHostBridge.KNOWN_COMMAND_GROUPS.has(group)) {
        return commandId;
      }
    }
    return this.ensurePluginPrefix(commandId, pluginName);
  }

  private extractPluginName(namespacedId: string): string {
    const parts = namespacedId.split('.');
    if (parts[0] === 'plugin' && parts.length >= 3) {
      return parts[1];
    }
    return '_unknown';
  }

  private handleWebviewsApi(method: string, args: unknown[], pluginName: string): unknown {
    switch (method) {
      case 'postMessage': {
        const [iframeId, data] = args as [string, unknown];
        const entry = this.pluginIframeManager.getIframe(iframeId);
        if (entry == null) {
          throw new Error(`Unknown iframe: ${iframeId}`);
        }
        if (entry.pluginName !== pluginName) {
          throw new PermissionDeniedError(
            pluginName,
            'webviews',
            `Cannot send messages to iframe '${iframeId}' owned by '${entry.pluginName}'`,
          );
        }
        this.pluginIframeManager.postMessageToIframe(iframeId, data);
        return undefined;
      }
      case 'createPanel': {
        const [options] = args as [{ title: string; entryPoint: string }];
        const iframeId = `webview:${pluginName}:${options.entryPoint}`;
        return iframeId;
      }
      case 'dispose': {
        const [iframeId] = args as [string];
        const entry = this.pluginIframeManager.getIframe(iframeId);
        if (entry != null && entry.pluginName !== pluginName) {
          throw new PermissionDeniedError(
            pluginName,
            'webviews',
            `Cannot dispose iframe '${iframeId}' owned by '${entry.pluginName}'`,
          );
        }
        this.pluginIframeManager.unregister(iframeId);
        return undefined;
      }
      default:
        throw new Error(`Unknown webviews method: ${method}`);
    }
  }

  private handleEditorsApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerWebviewDocumentType': {
        const pluginName = callerName;
        const [options] = args as [
          {
            id: string;
            displayName: string;
            icon: string;
            uriPattern: string;
            webviewOptions: { entryPoint: string; localResourceRoots?: string[] };
            includedFilePatterns?: string[];
          },
        ];

        const documentTypeId = `plugin.${pluginName}.${options.id}`;
        const rendererKey = `plugin-iframe-${documentTypeId}`;

        const webviewProtocol = this.pluginHost.getWebviewProtocol();
        if (webviewProtocol == null) {
          throw new Error('Webview protocol is not available — cannot register iframe document type.');
        }

        const rendererConstructor = createIframeDocumentRendererConstructor({
          pluginName,
          webviewOptions: options.webviewOptions,
          pluginIframeManager: this.pluginIframeManager,
          webviewProtocol,
          onDidOpenNotifier: (iframeId: string, uri: string) => {
            const onDidOpenCallbackId = this.onDidOpenCallbacks.get(documentTypeId);
            if (onDidOpenCallbackId != null) {
              this.pluginHost.getConnection()?.request(PH_CALLBACK_INVOCATION, {
                callbackId: onDidOpenCallbackId,
                args: [iframeId, uri],
              } satisfies CallbackInvocationPayload);
            }
          },
        });

        const uriRegex = new RegExp(options.uriPattern);

        // registerOrReplace transparently overwrites a manifest-declared placeholder type
        // (from contributes.editorDocumentTypes) registered by ContributionRegistrar at
        // discovery time, or simply registers fresh if no placeholder preceded it.
        this.bifrost.editors.registerOrReplaceDocumentType(documentTypeId, {
          uriMatch: uriRegex,
          icon: options.icon,
          rendererKey,
          rendererConstructor,
          modelKey: null,
        });
        this.contributionRegistrar?.placeholderEditorDocumentTypeIds.delete(documentTypeId);

        this.documentTypeLabels.set(documentTypeId, {
          uriPattern: uriRegex,
          displayName: options.displayName,
        });

        if (options.webviewOptions.localResourceRoots != null) {
          ipcRenderer.send('plugin:set-resource-roots', pluginName, options.webviewOptions.localResourceRoots);
        }

        const includedFilePatterns = options.includedFilePatterns ?? [];
        if (includedFilePatterns.length > 0) {
          this.bifrost.solution.registerDefaultIncludedFiles(includedFilePatterns);
        }

        this.getOrCreatePluginGroup(pluginName).set(`doctype:${documentTypeId}`, {
          disposer: () => {
            this.documentTypeLabels.delete(documentTypeId);
            this.bifrost.editors.unregisterDocumentType(documentTypeId).catch((err) => {
              console.warn(`[PluginHostBridge] Failed to unregister document type '${documentTypeId}':`, err);
            });
            if (includedFilePatterns.length > 0) {
              this.bifrost.solution.unregisterDefaultIncludedFiles(includedFilePatterns);
            }
          },
        });

        return undefined;
      }
      case 'openDocument': {
        const [uri] = args as [string];
        const label = this.resolveDocumentTypeLabel(uri);
        this.bifrost.editors.focusOrOpenEditorDocument(uri, label);
        return undefined;
      }
      case 'setDirty': {
        const [uri, isDirty] = args as [string, boolean];
        this.bifrost.editors.setDirty(uri, isDirty);
        return undefined;
      }
      case 'getFocusedDocumentUri': {
        const focused = this.bifrost.editors.getFocusedEditorDocument();
        return focused?.uri ?? null;
      }
      default:
        throw new Error(`Unknown editors method: ${method}`);
    }
  }

  private handlePanesApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerWebviewPane': {
        const pluginName = callerName;
        const [options] = args as [
          {
            id: string;
            title: string;
            area: 'left' | 'bottom' | 'right';
            groupId?: string;
            icon?: string;
            webviewOptions: { entryPoint: string; localResourceRoots?: string[] };
          },
        ];

        const webviewProtocol = this.pluginHost.getWebviewProtocol();
        if (webviewProtocol == null) {
          throw new Error('Webview protocol is not available — cannot register iframe pane.');
        }

        const paneId = `plugin.${pluginName}.${options.id}`;
        const providerId = `plugin/${pluginName}/panes/${options.id}`;

        const paneProviderModule = createIframePaneProvider({
          pluginName,
          paneId,
          title: options.title,
          webviewOptions: options.webviewOptions,
          pluginIframeManager: this.pluginIframeManager,
          webviewProtocol,
          getVisibility: () => this.paneVisibility.get(paneId),
        });

        const placeholderExists = this.bifrost.panes.alreadyRegistered(paneId);

        if (placeholderExists) {
          // A placeholder pane was registered by ContributionRegistrar during
          // manifest processing. Replace the placeholder provider with the
          // real iframe provider while keeping the pane's group registration.
          try {
            this.bifrost.panes.unregisterPaneProvider(providerId);
          } catch {
            /* provider may already be gone */
          }
          this.bifrost.panes.registerPaneProvider(providerId, paneProviderModule);
        } else {
          const paneObject = this.bifrost.panes.getPaneViaPaneProvider(paneId, providerId, paneProviderModule);

          if (options.groupId != null && !options.groupId.startsWith('plugin-')) {
            this.bifrost.panes.appendToPaneGroup(options.area, options.groupId, [paneObject]);
          } else {
            const groupId = options.groupId ?? `plugin-${pluginName}`;

            try {
              this.bifrost.panes.registerPaneGroup(options.area, groupId, [paneObject], {
                label: options.title,
                icon: options.icon,
              });
            } catch {
              this.bifrost.panes.appendToPaneGroup(options.area, groupId, [paneObject]);
            }
          }
        }

        this.getOrCreatePluginGroup(pluginName).set(`pane:${paneId}`, {
          disposer: () => {
            try {
              this.bifrost.panes.unregisterPane(paneId);
            } catch (err) {
              console.warn(`[PluginHostBridge] Failed to unregister pane '${paneId}':`, err);
            }
            try {
              this.bifrost.panes.unregisterPaneProvider(providerId);
            } catch (err) {
              console.warn(`[PluginHostBridge] Failed to unregister pane provider '${providerId}':`, err);
            }
          },
        });

        return undefined;
      }
      case 'setVisible': {
        const [localPaneId, visible] = args as [string, boolean];
        const paneId = `plugin.${callerName}.${localPaneId}`;
        this.paneVisibility.set(paneId, visible);
        this.bifrost.panes.requestPaneLayoutUpdate();
        return undefined;
      }
      default:
        throw new Error(`Unknown panes method: ${method}`);
    }
  }

  private handleStatusBarApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerStatusBarItem': {
        const pluginName = callerName;
        const [area, id, rawItems, priority] = args as [StatusBarItemArea, string, unknown, number | undefined];
        const items = coerceStatusBarItemList(rawItems);

        const namespacedId = `plugin.${pluginName}.${id}`;
        const storageKey = `${pluginName}:${id}`;
        this.statusBarItems.set(storageKey, items);

        if (this.registeredCallbacks.get(pluginName)?.has(`statusBarItem:${id}`)) {
          this.bifrost.statusBar.updateStatusBarItems();
          return undefined;
        }

        const factoryFn = () => this.statusBarItems.get(storageKey) ?? [];

        this.bifrost.statusBar.registerStatusBarItem(area, namespacedId, factoryFn, priority);
        this.bifrost.statusBar.updateStatusBarItems();

        this.getOrCreatePluginGroup(pluginName).set(`statusBarItem:${id}`, {
          disposer: () => {
            this.bifrost.statusBar.unregisterStatusBarItem(namespacedId);
            this.statusBarItems.delete(storageKey);
            this.bifrost.statusBar.updateStatusBarItems();
          },
        });

        return undefined;
      }
      case 'updateStatusBarItem': {
        const [id, rawItems] = args as [string, unknown];
        const storageKey = `${callerName}:${id}`;

        if (!this.statusBarItems.has(storageKey)) {
          throw new Error(`Status bar item not registered: ${id}`);
        }

        this.statusBarItems.set(storageKey, coerceStatusBarItemList(rawItems));
        this.bifrost.statusBar.updateStatusBarItems();
        return undefined;
      }
      case 'unregisterStatusBarItem': {
        const [id] = args as [string];

        this.bifrost.statusBar.unregisterStatusBarItem(`plugin.${callerName}.${id}`);
        this.statusBarItems.delete(`${callerName}:${id}`);
        this.bifrost.statusBar.updateStatusBarItems();

        const group = this.registeredCallbacks.get(callerName);
        if (group) {
          group.delete(`statusBarItem:${id}`);
        }

        return undefined;
      }
      case 'showProgress': {
        const [label] = args as [string];
        const handle = this.bifrost.statusBar.showProgress(label);
        const handleId = `ph:${this.nextProgressHandleId++}`;

        this.progressHandles.set(handleId, { pluginName: callerName, handle });

        this.getOrCreatePluginGroup(callerName).set(`progress:${handleId}`, {
          disposer: () => {
            const entry = this.progressHandles.get(handleId);
            if (entry) {
              entry.handle.done();
              this.progressHandles.delete(handleId);
            }
          },
        });

        return handleId;
      }
      case 'progressUpdate': {
        const [handleId, label] = args as [string, string];
        const entry = this.progressHandles.get(handleId);
        if (entry) {
          entry.handle.update(label);
        }
        return undefined;
      }
      case 'progressDone': {
        const [handleId] = args as [string];
        const entry = this.progressHandles.get(handleId);
        if (entry) {
          entry.handle.done();
          this.progressHandles.delete(handleId);
        }

        const group = this.registeredCallbacks.get(callerName);
        if (group) {
          group.delete(`progress:${handleId}`);
        }

        return undefined;
      }
      case 'isVisible': {
        return this.bifrost.statusBar.isVisible();
      }
      default:
        throw new Error(`Unknown statusBar method: ${method}`);
    }
  }

  private handleMenuBarApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerMenuBarItem': {
        const [area, items] = args as ['left' | 'center' | 'right', unknown[]];
        const factoryFn = () => items as any[];

        const disposer = this.bifrost.menuBar.registerMenuBarItem(area, factoryFn);
        this.bifrost.menuBar.updateMenuBarItems();

        const key = `menuBarItem:${callerName}:${Date.now()}:${Math.random()}`;
        this.getOrCreatePluginGroup(callerName).set(key, {
          disposer: () => {
            disposer.dispose();
            this.bifrost.menuBar.updateMenuBarItems();
          },
        });

        return undefined;
      }
      case 'registerMenuBarItemModifier': {
        const [config] = args as [{ insertAfter?: string; insertBefore?: string; items: unknown[] }];

        let disposer: { dispose: () => void };

        if (config.insertAfter != null) {
          disposer = this.bifrost.menuBar.registerMenuBarItemModifier((menuBarItemMap) => {
            return insertAfterMenuBarItem(menuBarItemMap, config.insertAfter!, () => config.items as any[]);
          });
        } else if (config.insertBefore != null) {
          disposer = this.bifrost.menuBar.registerMenuBarItemModifier((menuBarItemMap) => {
            return insertBeforeMenuBarItem(menuBarItemMap, config.insertBefore!, () => config.items as any[]);
          });
        } else {
          throw new Error('MenuBarItemModifierConfig must specify insertAfter or insertBefore');
        }

        this.bifrost.menuBar.updateMenuBarItems();

        const key = `menuBarModifier:${callerName}:${Date.now()}:${Math.random()}`;
        this.getOrCreatePluginGroup(callerName).set(key, {
          disposer: () => {
            disposer.dispose();
            this.bifrost.menuBar.updateMenuBarItems();
          },
        });

        return undefined;
      }
      case 'isVisible': {
        return this.bifrost.menuBar.isVisible();
      }
      default:
        throw new Error(`Unknown menuBar method: ${method}`);
    }
  }

  private handleMenusApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerMenuModifier': {
        const [menuId, config] = args as [
          string,
          {
            items: MenuItem[];
            position?: {
              type: 'append' | 'prepend' | 'appendToSubmenu' | 'prependToSubmenu' | 'insertAfter' | 'insertBefore';
              submenuId?: string;
              id?: string;
            };
          },
        ];

        const position = config.position ?? { type: 'append' };

        const disposer = this.bifrost.menus.registerMenuModifier(menuId, (menu: Menu) => {
          switch (position.type) {
            case 'append':
              return this.bifrost.menus.appendToMenu(menu, config.items);
            case 'prepend':
              return this.bifrost.menus.prependToMenu(menu, config.items);
            case 'appendToSubmenu':
              return this.bifrost.menus.appendToSubmenu(menu, position.submenuId!, config.items);
            case 'prependToSubmenu':
              return this.bifrost.menus.prependToSubmenu(menu, position.submenuId!, config.items);
            case 'insertAfter':
              return this.bifrost.menus.insertAfterMenuItem(menu, position.id!, config.items);
            case 'insertBefore':
              return this.bifrost.menus.insertBeforeMenuItem(menu, position.id!, config.items);
            default:
              return this.bifrost.menus.appendToMenu(menu, config.items);
          }
        });

        void this.bifrost.menus.updateMenus();

        const key = `menuModifier:${callerName}:${menuId}:${Date.now()}:${Math.random()}`;
        this.getOrCreatePluginGroup(callerName).set(key, {
          disposer: () => {
            disposer.dispose();
            void this.bifrost.menus.updateMenus();
          },
        });

        return undefined;
      }
      default:
        throw new Error(`Unknown menus method: ${method}`);
    }
  }

  /**
   * Finds the display name for a plugin-registered editor document type
   * whose URI pattern matches the given URI.
   */
  private resolveDocumentTypeLabel(uri: string): string | undefined {
    for (const entry of this.documentTypeLabels.values()) {
      if (entry.uriPattern.test(uri)) {
        return entry.displayName;
      }
    }
    return undefined;
  }

  /**
   * Extracts the plugin name from a callback ID with the format
   * `<pluginName>:webview:<iframeId>:<method>`.
   */
  private extractPluginNameFromCallbackId(callbackId: string): string {
    const colonIndex = callbackId.indexOf(':');
    if (colonIndex > 0) {
      return callbackId.slice(0, colonIndex);
    }
    return '_unknown';
  }

  private assertUriInScope(pluginName: string, uri: string): void {
    if (!uri.startsWith('file://')) {
      throw new Error(`Workspace API only supports file:// URIs, got: ${uri}`);
    }

    const localPath = path.resolve(this.bifrost.files.getLocalFilenameForUri(uri));

    const storagePath = path.join(this.getPluginStorageBase(), pluginName);
    const storageRelative = path.relative(storagePath, localPath);
    if (!storageRelative.startsWith('..') && !path.isAbsolute(storageRelative)) {
      return;
    }

    const solution = this.bifrost.solution.getSolution();
    if (solution != null) {
      for (const project of solution.projects) {
        const projectLocal = path.resolve(this.bifrost.files.getLocalFilenameForUri(project.baseUri));
        const relative = path.relative(projectLocal, localPath);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
          return;
        }
      }
    }

    throw new Error(
      `Access denied: URI '${uri}' is outside the allowed scope (solution project folders and plugin storage).`,
    );
  }

  private async handleWorkspaceApi(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'readFile': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        return this.bifrost.files.load(uri);
      }
      case 'readBinaryFile': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        const localPath = this.bifrost.files.getLocalFilenameForUri(uri);
        const buffer = await fsPromises.readFile(localPath);
        return buffer.toString('base64');
      }
      case 'writeFile': {
        const [uri, content] = args as [string, string];
        this.assertUriInScope(pluginName, uri);
        const localPath = this.bifrost.files.getLocalFilenameForUri(uri);
        await fsPromises.mkdir(path.dirname(localPath), { recursive: true });
        await this.bifrost.files.save(uri, content);
        return undefined;
      }
      case 'writeBinaryFile': {
        const [uri, base64Content] = args as [string, string];
        this.assertUriInScope(pluginName, uri);
        const localPath = this.bifrost.files.getLocalFilenameForUri(uri);
        await fsPromises.mkdir(path.dirname(localPath), { recursive: true });
        const buffer = Buffer.from(base64Content, 'base64');
        await fsPromises.writeFile(localPath, buffer);
        return undefined;
      }
      case 'listDirectory': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        const uris = await this.bifrost.files.listDirectory(uri);
        const entries: { name: string; uri: string; type: 'file' | 'directory' }[] = [];
        for (const entryUri of uris) {
          const isDir = await this.bifrost.files.isDirectory(entryUri);
          const basename = this.bifrost.files.getFilename(entryUri);
          entries.push({ name: basename, uri: entryUri, type: isDir ? 'directory' : 'file' });
        }
        return entries;
      }
      case 'stat': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        const localPath = this.bifrost.files.getLocalFilenameForUri(uri);
        const exists = await this.bifrost.files.doesFileOrDirectoryExist(localPath);
        if (!exists) {
          return { isDirectory: false, isFile: false, exists: false };
        }
        const isDir = await this.bifrost.files.isDirectory(uri);
        return { isDirectory: isDir, isFile: !isDir, exists: true };
      }
      case 'createDirectory': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        await this.bifrost.files.createDirectory(uri);
        return undefined;
      }
      case 'deleteFile': {
        const [uri] = args as [string];
        this.assertUriInScope(pluginName, uri);
        await this.bifrost.files.deleteFilesAndDirectories([uri]);
        return undefined;
      }
      case 'getProjectFolders': {
        const solution = this.bifrost.solution.getSolution();
        if (solution == null) {
          return [];
        }
        return solution.projects.map((project) => ({
          uri: project.baseUri,
          name: project.name,
        }));
      }
      default:
        throw new Error(`Unknown workspace method: ${method}`);
    }
  }

  private async handleCommandsApi(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'executeCommand': {
        const [rawCommandId, commandArgs] = args as [string, unknown[]];
        const commandId = this.resolveCommandIdForExecution(rawCommandId, pluginName);
        checkCommandAccess(this.bifrost, commandId, pluginName, this.permissionGate);
        return Promise.resolve(this.bifrost.commands.executeCommand(commandId, commandArgs));
      }
      case 'tryToExecuteCommand': {
        const [rawCommandId, commandArgs] = args as [string, unknown[]];
        const commandId = this.resolveCommandIdForExecution(rawCommandId, pluginName);
        checkCommandAccess(this.bifrost, commandId, pluginName, this.permissionGate);
        try {
          const result = this.bifrost.commands.tryToExecuteCommand(commandId, commandArgs);
          if (result.success) {
            const resolvedValue = await Promise.resolve(result.returnValue);
            return { success: true, returnValue: resolvedValue };
          }
          return {
            success: false,
            error: {
              message: result.error?.message ?? String(result.error),
              stack: result.error?.stack,
            },
          };
        } catch (err: any) {
          return {
            success: false,
            error: {
              message: err?.message ?? String(err),
              stack: err?.stack,
            },
          };
        }
      }
      case 'isCommandEnabled': {
        const [rawCommandId, commandArgs] = args as [string, unknown[]];
        const commandId = this.resolveCommandIdForExecution(rawCommandId, pluginName);
        checkCommandAccess(this.bifrost, commandId, pluginName, this.permissionGate);
        return this.bifrost.commands.isCommandEnabled(commandId, commandArgs);
      }
      case 'isRegistered': {
        const [rawCommandName] = args as [string];
        const commandName = this.resolveCommandIdForExecution(rawCommandName, pluginName);
        return this.bifrost.commands.isRegistered(commandName);
      }
      case 'getCommands': {
        return this.bifrost.commands
          .getCommands()
          .filter((cmd) => canAccessCommand(this.bifrost, cmd.name, pluginName, this.permissionGate))
          .map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            visibleInSearch: cmd.visibleInSearch,
          }));
      }
      default:
        throw new Error(`Unknown commands method: ${method}`);
    }
  }

  private handleDiagnosticsApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'set': {
        const [uri, diagnostics] = args as [string, { severity: 'error' | 'warning' | 'info'; message: string }[]];
        const owner = `plugin.${callerName}`;
        this.bifrost.diagnostics.setDiagnostics(
          uri,
          owner,
          diagnostics.map((diag) => ({ severity: diag.severity, message: diag.message, source: owner })),
        );
        return undefined;
      }
      case 'clear': {
        this.bifrost.diagnostics.clearDiagnostics(`plugin.${callerName}`);
        return undefined;
      }
      case 'get': {
        const [uri] = args as [string | undefined];
        const diagnosticsMap = this.bifrost.diagnostics.getDiagnostics(uri);
        const result: Record<string, { severity: string; message: string }[]> = {};
        for (const [diagUri, diagList] of diagnosticsMap) {
          result[diagUri] = diagList.map((diag) => ({ severity: diag.severity, message: diag.message }));
        }
        return result;
      }
      case 'getCount': {
        return this.bifrost.diagnostics.getCount();
      }
      default:
        throw new Error(`Unknown diagnostics method: ${method}`);
    }
  }

  private async handleDialogsApi(method: string, args: unknown[], callerName: string): Promise<unknown> {
    switch (method) {
      case 'open': {
        const [options] = args as [
          {
            title: string;
            content: unknown[];
            actions: { response: string; label: string; default?: boolean; cancel?: boolean; dangerous?: boolean }[];
            className?: string;
            hideCloseButton?: boolean;
          },
        ];
        this.activeDialogOwner = callerName;
        try {
          const result = await this.bifrost.dialog.open({
            title: options.title,
            content: options.content as any,
            actions: options.actions,
            className: options.className,
            hideCloseButton: options.hideCloseButton,
          });
          return {
            wasCancelled: result.wasCancelled,
            response: result.response,
            formData: result.formData,
          };
        } finally {
          this.activeDialogOwner = null;
        }
      }
      case 'prompt': {
        const [title, placeholder] = args as [string, string | undefined];
        this.activeDialogOwner = callerName;
        try {
          return await this.bifrost.dialog.prompt(title, placeholder);
        } finally {
          this.activeDialogOwner = null;
        }
      }
      case 'showOpenFile': {
        const [options] = args as [
          {
            title?: string;
            defaultPath?: string;
            filters?: { name: string; extensions: string[] }[];
          },
        ];
        this.activeDialogOwner = callerName;
        try {
          return await this.bifrost.dialog.showOpenFile(options);
        } finally {
          this.activeDialogOwner = null;
        }
      }
      case 'showOpenDirectory': {
        this.activeDialogOwner = callerName;
        try {
          return await this.bifrost.dialog.showOpenDirectory();
        } finally {
          this.activeDialogOwner = null;
        }
      }
      case 'showSaveFile': {
        const [options] = args as [
          {
            title?: string;
            defaultPath?: string;
            buttonLabel?: string;
            filters?: { name: string; extensions: string[] }[];
          },
        ];
        this.activeDialogOwner = callerName;
        try {
          return await this.bifrost.dialog.showSaveFile(options);
        } finally {
          this.activeDialogOwner = null;
        }
      }
      default:
        throw new Error(`Unknown dialogs method: ${method}`);
    }
  }

  private handleNotificationsApi(method: string, args: unknown[]): unknown {
    switch (method) {
      case 'open': {
        const [options] = args as [
          {
            type: string;
            content: string;
            origin?: string;
            actions?: { action: string; label: string; default?: boolean }[];
            sticky?: boolean;
          },
        ];
        return this.bifrost.notifications.open({
          type: options.type as 'info' | 'warning' | 'error',
          content: options.content,
          source: options.origin,
          actions: options.actions,
          sticky: options.sticky,
        });
      }
      case 'close': {
        const [notificationId] = args as [string];
        this.bifrost.notifications.close(notificationId);
        return undefined;
      }
      case 'update': {
        const [notificationId, updateOptions] = args as [string, { content: string }];
        this.bifrost.notifications.update(notificationId, updateOptions);
        return undefined;
      }
      default:
        throw new Error(`Unknown notifications method: ${method}`);
    }
  }

  private handleViewsApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'registerTreeView': {
        const pluginName = callerName;
        const [options] = args as [
          {
            id: string;
            title: string;
            area: 'left' | 'bottom' | 'right';
            groupId?: string;
            icon?: string;
          },
        ];

        const paneId = `plugin.${pluginName}.${options.id}`;
        const providerId = `plugin/${pluginName}/views/${options.id}`;

        this.treeViewData.set(paneId, []);
        this.treeViewListeners.set(paneId, new Set());

        const paneProviderModule = createTreeViewPaneProvider({
          pluginName,
          paneId,
          title: options.title,
          getTreeData: () => (this.treeViewData.get(paneId) as any[]) ?? [],
          onTreeDataChanged: (listener: () => void) => {
            this.treeViewListeners.get(paneId)?.add(listener);
            return () => {
              this.treeViewListeners.get(paneId)?.delete(listener);
            };
          },
          onItemClick: (command: string | undefined, metadata: unknown) => {
            if (command != null) {
              const namespacedCommand = `plugin.${pluginName}.${command}`;
              this.bifrost.commands.executeCommand(namespacedCommand, [metadata]);
            }
          },
          getVisibility: () => this.paneVisibility.get(paneId),
        });

        if (options.groupId != null && !options.groupId.startsWith('plugin-')) {
          const paneObject = this.bifrost.panes.getPaneViaPaneProvider(paneId, providerId, paneProviderModule);
          this.bifrost.panes.appendToPaneGroup(options.area, options.groupId, [paneObject]);
        } else {
          const groupId = options.groupId ?? `plugin-${pluginName}`;
          const paneObject = this.bifrost.panes.getPaneViaPaneProvider(paneId, providerId, paneProviderModule);

          try {
            this.bifrost.panes.registerPaneGroup(options.area, groupId, [paneObject], {
              label: options.title,
              icon: options.icon,
            });
          } catch {
            this.bifrost.panes.appendToPaneGroup(options.area, groupId, [paneObject]);
          }
        }

        this.getOrCreatePluginGroup(pluginName).set(`treeView:${paneId}`, {
          disposer: () => {
            try {
              this.bifrost.panes.unregisterPane(paneId);
            } catch (err) {
              console.warn(`[PluginHostBridge] Failed to unregister tree view pane '${paneId}':`, err);
            }
            try {
              this.bifrost.panes.unregisterPaneProvider(providerId);
            } catch (err) {
              console.warn(`[PluginHostBridge] Failed to unregister tree view provider '${providerId}':`, err);
            }
            this.treeViewData.delete(paneId);
            this.treeViewListeners.delete(paneId);
          },
        });

        return undefined;
      }
      case 'updateTreeData': {
        const [localViewId, items] = args as [string, unknown[]];
        const paneId = `plugin.${callerName}.${localViewId}`;

        if (!this.treeViewData.has(paneId)) {
          throw new Error(`Tree view not registered: ${localViewId}`);
        }

        this.treeViewData.set(paneId, items);
        const listeners = this.treeViewListeners.get(paneId);
        if (listeners != null) {
          for (const listener of listeners) {
            listener();
          }
        }

        return undefined;
      }
      default:
        throw new Error(`Unknown views method: ${method}`);
    }
  }

  private handleThemesApi(method: string, args: unknown[], callerName: string): unknown {
    switch (method) {
      case 'register': {
        const [definition] = args as [
          { id: string; label: string; type: 'dark' | 'light'; tokens: Record<string, string> },
        ];

        const themeId = `plugin.${callerName}.${definition.id}`;

        this.bifrost.theme.registerTheme({
          id: themeId,
          label: definition.label,
          type: definition.type,
        });

        this.injectPluginThemeCSS(themeId, definition.tokens);

        let themeSet = this.pluginThemeIds.get(callerName);
        if (themeSet == null) {
          themeSet = new Set();
          this.pluginThemeIds.set(callerName, themeSet);
        }
        themeSet.add(themeId);

        this.getOrCreatePluginGroup(callerName).set(`theme:${themeId}`, {
          disposer: () => {
            this.removePluginTheme(themeId, callerName);
          },
        });

        return undefined;
      }
      case 'unregister': {
        const [localThemeId] = args as [string];
        const themeId = `plugin.${callerName}.${localThemeId}`;
        this.removePluginTheme(themeId, callerName);
        return undefined;
      }
      case 'getActiveTheme': {
        return this.bifrost.theme.getCurrentTheme();
      }
      default:
        throw new Error(`Unknown themes method: ${method}`);
    }
  }

  /**
   * Injects a `<style>` element with CSS custom property overrides
   * scoped to `.bifrost.bifrost-theme--<themeId>`.
   */
  private injectPluginThemeCSS(themeId: string, tokens: Record<string, string>): void {
    const existingEl = this.pluginThemeStyles.get(themeId);
    if (existingEl != null) {
      existingEl.remove();
    }

    const cssRules: string[] = [];
    for (const [key, value] of Object.entries(tokens)) {
      const cssProperty = key.startsWith('--') ? key : `--${key}`;
      cssRules.push(`  ${cssProperty}: ${value};`);
    }

    const escapedThemeId = themeId.replace(/\./g, '\\.');
    const css = `.bifrost.bifrost-theme--${escapedThemeId} {\n${cssRules.join('\n')}\n}`;

    const styleEl = document.createElement('style');
    styleEl.dataset.pluginTheme = themeId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    this.pluginThemeStyles.set(themeId, styleEl);
  }

  /**
   * Removes a plugin theme: unregisters from theme manager,
   * removes injected CSS, falls back to default theme if active.
   */
  private removePluginTheme(themeId: string, pluginName: string): void {
    const currentTheme = this.bifrost.theme.getCurrentTheme();

    const styleEl = this.pluginThemeStyles.get(themeId);
    if (styleEl != null) {
      styleEl.remove();
      this.pluginThemeStyles.delete(themeId);
    }

    const themeDef = this.bifrost.theme.getTheme(themeId);

    try {
      this.bifrost.theme.unregisterTheme(themeId);
    } catch {
      /* theme may already be unregistered */
    }

    if (currentTheme === themeId) {
      const fallback = themeDef?.type === 'light' ? 'light' : 'dark';
      this.bifrost.theme.setTheme(fallback);
    }

    const themeSet = this.pluginThemeIds.get(pluginName);
    if (themeSet != null) {
      themeSet.delete(themeId);
      if (themeSet.size === 0) {
        this.pluginThemeIds.delete(pluginName);
      }
    }

    const group = this.registeredCallbacks.get(pluginName);
    if (group != null) {
      group.delete(`theme:${themeId}`);
    }
  }

  private async handleSettingsApi(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'register': {
        const [descriptors] = args as [Record<string, unknown>];
        // Validate that all keys are in the plugin's namespace
        if (descriptors != null && typeof descriptors === 'object') {
          const ownPrefix = `plugin.${pluginName}.`;
          for (const key of Object.keys(descriptors)) {
            if (!key.startsWith(ownPrefix)) {
              throw new PermissionDeniedError(
                pluginName,
                'settings',
                `Write denied: descriptor key '${key}' is outside plugin namespace '${ownPrefix}'`,
              );
            }
          }
        }
        this.bifrost.settings.register(descriptors as any);
        return undefined;
      }
      case 'has': {
        const [key] = args as [string];
        return this.bifrost.settings.has(key);
      }
      case 'get': {
        const [key] = args as [string];
        return this.bifrost.settings.get(key);
      }
      case 'getSchema': {
        const [key] = args as [string];
        return this.bifrost.settings.getSchema(key);
      }
      case 'getSchemas': {
        const schemasMap = this.bifrost.settings.getSchemas();
        const result: Record<string, unknown> = {};
        for (const [key, descriptor] of schemasMap) {
          result[key] = descriptor;
        }
        return result;
      }
      case 'getDefault': {
        const [key] = args as [string];
        return this.bifrost.settings.getDefault(key);
      }
      case 'getDefaults': {
        return this.bifrost.settings.getDefaults();
      }
      case 'set': {
        const [key, value] = args as [string, unknown];
        const ownPrefix = `plugin.${pluginName}.`;
        if (!key.startsWith(ownPrefix)) {
          throw new PermissionDeniedError(
            pluginName,
            'settings',
            `Write denied: '${key}' is outside plugin namespace '${ownPrefix}'`,
          );
        }
        this.bifrost.settings.set(key, value);
        return undefined;
      }
      case 'add': {
        const [key, value] = args as [string, unknown];
        const addPrefix = `plugin.${pluginName}.`;
        if (!key.startsWith(addPrefix)) {
          throw new PermissionDeniedError(
            pluginName,
            'settings',
            `Write denied: '${key}' is outside plugin namespace '${addPrefix}'`,
          );
        }
        this.bifrost.settings.add(key, value);
        return undefined;
      }
      case 'removeValue': {
        const [key, value] = args as [string, string];
        const removePrefix = `plugin.${pluginName}.`;
        if (!key.startsWith(removePrefix)) {
          throw new PermissionDeniedError(
            pluginName,
            'settings',
            `Write denied: '${key}' is outside plugin namespace '${removePrefix}'`,
          );
        }
        this.bifrost.settings.removeValue(key, value);
        return undefined;
      }
      default:
        throw new Error(`Unknown settings method: ${method}`);
    }
  }
}

/**
 * Keep plugin payloads as a real array. Array-like objects (`{ 0: ..., length }`)
 * must not be stored as-is — `Array.concat` would flatten them into bare cells.
 */
function coerceStatusBarItemList(value: unknown): StatusBarItem[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value as StatusBarItem];
}
