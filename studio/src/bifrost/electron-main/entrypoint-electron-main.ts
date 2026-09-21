import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import type {
  DialogActionObject,
  DialogOptionsStrict,
  DialogOptionsStrict_MessageBox,
  DialogResult,
} from '#bifrost/contracts/DialogTypes';
import { fork } from 'child_process';
import type { MessageBoxOptions } from 'electron';
import { BrowserWindow, Menu, app, dialog, ipcMain, net, protocol, shell } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { Minimatch } from 'minimatch';
import { parseArgs } from 'node:util';
import * as path from 'path';
import type sysinfo from 'systeminformation';

import * as BuildInfo from '../../generatedBuildAndProductInfo';
import { ReleaseChannelName } from '../common/Environment';
import { Performance } from '../common/Performance';
import {
  IPC_INVOKE_COPY_FILE_OR_DIRECTORY,
  IPC_INVOKE_CREATE_DIR,
  IPC_INVOKE_EXISTS,
  IPC_INVOKE_FETCH,
  IPC_INVOKE_GET_APP_PATH,
  IPC_INVOKE_GET_SYSTEMINFORMATION,
  IPC_INVOKE_IS_DIRECTORY,
  IPC_INVOKE_OPEN_PATH,
  IPC_INVOKE_READ_DIR,
  IPC_INVOKE_READ_FILE,
  IPC_INVOKE_RENAME_FILE_OR_DIRECTORY,
  IPC_INVOKE_SHOW_ITEM_IN_FOLDER,
  IPC_INVOKE_TRASH_ITEM,
  IPC_INVOKE_TRAVERSE_DIRECTORY,
  IPC_INVOKE_UNINSTALL_PLUGIN,
  IPC_INVOKE_WRITE_FILE,
  IPC_MESSAGE_CLEAR_WINDOW_SOLUTION,
  IPC_MESSAGE_CLOSE_FOCUSED_WINDOW,
  IPC_MESSAGE_CREATE_NEW_WINDOW,
  IPC_MESSAGE_EXECUTE_COMMAND_AT_RENDERER,
  IPC_MESSAGE_FOCUS_WINDOW,
  IPC_MESSAGE_GET_WINDOWS,
  IPC_MESSAGE_HIDE_WINDOW_BY_INSTANCE_ID,
  IPC_MESSAGE_MAXIMIZE_FOCUSED_WINDOW,
  IPC_MESSAGE_MINIMIZE_FOCUSED_WINDOW,
  IPC_MESSAGE_PLUGIN_STATE_CHANGED,
  IPC_MESSAGE_QUIT,
  IPC_MESSAGE_RELOAD_RECENTLY_OPENED,
  IPC_MESSAGE_RELOAD_SETTINGS,
  IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG,
  IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG,
  IPC_MESSAGE_SOLUTION_CHANGED,
  IPC_MESSAGE_TERMINATE,
  IPC_MESSAGE_UNHANDLED_REJECTION_OR_ERROR,
  IPC_MESSAGE_UPDATE_MAIN_MENU,
} from '../contracts/IpcEvents';
import { getBifrostAppStorageFilename, getPluginsDir } from '../node/BifrostPathFunctions';
import BifrostAppManager, {
  EVENT_APP_STATE_CHANGED,
  EVENT_CLOSE_WINDOW,
  EVENT_FOCUS_WINDOW,
  EVENT_NEW_WINDOW,
} from './BifrostAppManager';
import BifrostAppStorage from './BifrostAppStorage';
import { registerGitHandlers } from './registerGitHandlers';

let bifrostAppManager: BifrostAppManager | null;
let bifrostAppStorage: BifrostAppStorage;

const saveAppFn = () => bifrostAppStorage.save(bifrostAppManager?.serialize());
let appManagerSubscriptions: AbstractSubscription[] = [];

const releaseChannelName = BuildInfo.releaseChannelName;

if (process.env.APP_TEST == 'true') {
  require('@electron/remote/main').initialize();
  app.on('browser-window-created', (_, window) => {
    require('@electron/remote/main').enable(window.webContents);
  });
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.__BFW_BUNDLE_DIR__ = __dirname;

export function startMain(startArgs: Record<string, any>, shellStartTime: number): void {
  app.requestSingleInstanceLock();
  const hasSingleInstanceLock = app.hasSingleInstanceLock();

  if (!hasSingleInstanceLock) {
    app.exit();
  }

  const protocolSchemeName =
    ReleaseChannelName.Stable === releaseChannelName
      ? 'bifrost-forge-world'
      : `bifrost-forge-world-${releaseChannelName}`;
  const webviewProtocolName =
    ReleaseChannelName.Stable === releaseChannelName ? 'bifrostfw-webview' : `bifrostfw-webview-${releaseChannelName}`;

  /**
   * Register custom protocols before the `ready` event.
   *
   * `bifrost-forge-world://` — serves app files from the bundle directory.
   * `bifrostfw-webview://` — serves plugin files from their install directories
   *   with per-plugin origin isolation and CSP headers.
   */
  protocol.registerSchemesAsPrivileged([
    {
      scheme: protocolSchemeName,
      privileges: {
        secure: true,
        standard: true,
        bypassCSP: true,
        allowServiceWorkers: true,
        supportFetchAPI: true,
      },
    },
    {
      scheme: webviewProtocolName,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: false,
      },
    },
  ]);

  app.on('second-instance', (event, argv, workingDirectory) => {
    const noArgumentsSet = argv.length === 1;

    if (noArgumentsSet) {
      return;
    }

    argv.shift();

    const filteredArgv = argv.filter((arg) => !arg.startsWith('--'));

    bifrostAppManager?.newWindow({ args: { _: filteredArgv } });
  });

  const performance = new Performance(['shell', shellStartTime]);
  performance.mark('electron-main #start');

  log.transports.ipc.level = false;
  log.transports.file.level = false;
  Object.assign(console, log.functions);

  let beforeQuitEventReceived = false;

  let filePathToOpenAfterAppReady: string;
  app.once('will-finish-launching', () => {
    app.on('open-file', (event: Electron.Event, filePath: string) => {
      if (bifrostAppManager == null) {
        filePathToOpenAfterAppReady = filePath;
      } else {
        bifrostAppManager.newWindow({ args: { _: [filePath] } });
      }
    });
  });

  app.once('ready', () => {
    performance.mark('electron-main #end');

    /**
     * We need to register a custom protocol because the file protocol does not support sharedworker and service worker to be shared between windows.
     */
    protocol.handle(protocolSchemeName, (request) => {
      const filePath = request.url.replace(`${protocolSchemeName}://instance`, 'file:///');

      return net.fetch(filePath);
    });

    /**
     * Protocol handler for `bifrostfw-webview://`. Serves plugin files from disk
     * with per-plugin origin isolation. The hostname encodes the plugin name;
     * the pathname is resolved relative to the plugin's install directory.
     *
     * Special paths `/studio-bridge.js` and `/studio-bridge.js.map` serve
     * the bridge script (and its source map) from the app bundle directory
     * so plugins can include it via `<script>`.
     */
    const pluginsBaseDir = getPluginsDir();

    const pluginResourceRoots = new Map<string, string[]>();

    ipcMain.on('plugin:set-resource-roots', (_event, pluginName: string, roots: string[]) => {
      pluginResourceRoots.set(pluginName, roots);
    });

    ipcMain.on('plugin:clear-resource-roots', (_event, pluginName: string) => {
      pluginResourceRoots.delete(pluginName);
    });

    protocol.handle(webviewProtocolName, async (request) => {
      const url = new URL(request.url);
      const hostname = url.hostname;
      const pluginName = hostnameToPluginName(hostname);
      const requestedPath = decodeURIComponent(url.pathname);

      if (!isValidPluginName(pluginName)) {
        return new Response('Forbidden — invalid plugin name', { status: 403 });
      }

      if (requestedPath === '/studio-bridge.js' || requestedPath === '/studio-bridge.js.map') {
        const bridgePath = path.join(__dirname, requestedPath.slice(1));
        const response = await net.fetch(`file://${bridgePath}`);
        return addWebviewSecurityHeaders(response, hostname, webviewProtocolName);
      }

      const pluginRoot = path.resolve(pluginsBaseDir, pluginName);

      const resolvedPath = path.resolve(pluginRoot, requestedPath.slice(1));
      const relativePath = path.relative(pluginRoot, resolvedPath);

      // Path traversal check (string-level)
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return new Response('Forbidden — path traversal blocked', { status: 403 });
      }

      // Symlink traversal check (filesystem-level)
      let realResolved: string;
      try {
        const realPluginRoot = fs.realpathSync(pluginRoot);
        realResolved = fs.realpathSync(resolvedPath);
        if (!realResolved.startsWith(realPluginRoot + path.sep) && realResolved !== realPluginRoot) {
          return new Response('Forbidden — symlink traversal blocked', { status: 403 });
        }
      } catch {
        return new Response('Not found', { status: 404 });
      }

      // localResourceRoots enforcement
      const roots = pluginResourceRoots.get(pluginName);
      if (roots != null && roots.length > 0) {
        const withinRoot = roots.some((root) => {
          const absRoot = path.resolve(pluginRoot, root);
          const rel = path.relative(absRoot, resolvedPath);
          return !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        if (!withinRoot) {
          return new Response('Forbidden — outside localResourceRoots', { status: 403 });
        }
      }

      try {
        const response = await net.fetch(`file://${realResolved}`);
        return addWebviewSecurityHeaders(response, hostname, webviewProtocolName);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });

    if (filePathToOpenAfterAppReady != null && filePathToOpenAfterAppReady.trim() !== '') {
      startArgs._.push(filePathToOpenAfterAppReady);
    }

    const appKey = 'bifrost';
    bifrostAppManager = new BifrostAppManager(
      appKey,
      {
        args: startArgs,
        test: process.argv,
        performanceEntries: performance.entries,
        isPackaged: app.isPackaged,
        webviewProtocol: webviewProtocolName,
      },
      protocolSchemeName,
    );
    bifrostAppStorage = new BifrostAppStorage(getBifrostAppStorageFilename(), appKey);

    appManagerSubscriptions = [
      bifrostAppManager.on(EVENT_NEW_WINDOW, saveAppFn),
      bifrostAppManager.on(EVENT_FOCUS_WINDOW, saveAppFn),
      bifrostAppManager.on(EVENT_CLOSE_WINDOW, saveAppFn),
      bifrostAppManager.on(EVENT_APP_STATE_CHANGED, saveAppFn),
    ];

    bifrostAppManager.onLastWindowClose(async () => {
      beforeQuitEventReceived = true;
    });

    bifrostAppManager.deserialize(bifrostAppStorage.load());
  });

  ipcMain.handle(IPC_INVOKE_FETCH, async (event: any, ...args: any[]) => {
    const [url, ...rest] = args;

    try {
      const res = await fetch(url, ...rest);
      const contentType = res.headers.get('content-type') || '';
      const bodyText = await res.text();

      const responseData = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: bodyText,
        ok: res.ok,
        redirected: res.redirected,
        url: res.url,
        contentType,
      };

      return { response: responseData };
    } catch (error) {
      console.error('Error during IPC_INVOKE_FETCH:', error);
      // The error must be returned as a plain JSON, or all error data will be lost during serialization.
      return {
        error: {
          message: error.message,
          name: error.name,
          type: error.type,
          code: error.code,
          errno: error.errno,
          stack: error.stack,
        },
      };
    }
  });

  ipcMain.handle(IPC_INVOKE_SHOW_ITEM_IN_FOLDER, (event: any, fullPath: string) => {
    shell.showItemInFolder(fullPath);
  });

  ipcMain.handle(IPC_INVOKE_OPEN_PATH, async (event: any, fullPath: string) => {
    return await shell.openPath(fullPath);
  });

  ipcMain.on(IPC_MESSAGE_CREATE_NEW_WINDOW, (event: any, bifrostWindowpOptions: any) => {
    bifrostAppManager?.newWindow(bifrostWindowpOptions);
  });

  ipcMain.on(IPC_MESSAGE_MAXIMIZE_FOCUSED_WINDOW, (event: any) => {
    bifrostAppManager?.maximizeFocusedWindow();
  });

  ipcMain.on(IPC_MESSAGE_MINIMIZE_FOCUSED_WINDOW, (event: any) => {
    bifrostAppManager?.minimizeFocusedWindow();
  });

  ipcMain.on(IPC_MESSAGE_FOCUS_WINDOW, (event: any, windowId: string) => {
    bifrostAppManager?.focusWindow(windowId);
  });

  ipcMain.on(IPC_MESSAGE_CLOSE_FOCUSED_WINDOW, (event: any) => {
    bifrostAppManager?.closeFocusedWindow();
  });

  ipcMain.handle(IPC_MESSAGE_HIDE_WINDOW_BY_INSTANCE_ID, (event: any, instanceKey?: string) => {
    const windows = bifrostAppManager?.getWindows();
    const windowToHide = windows?.find((window) => window.instanceKey === instanceKey);

    bifrostAppManager?.hideFocusedWindow(windowToHide?.id);
  });

  ipcMain.on(IPC_MESSAGE_GET_WINDOWS, (event: any) => {
    event.returnValue = bifrostAppManager?.getWindows();
  });

  ipcMain.handle(IPC_MESSAGE_GET_WINDOWS, (event: any) => {
    return bifrostAppManager?.getWindows();
  });

  ipcMain.on(IPC_MESSAGE_CLEAR_WINDOW_SOLUTION, (event: any, instanceKey: string) => {
    bifrostAppManager?.clearSolutionUri(instanceKey);
  });

  ipcMain.on(
    IPC_MESSAGE_RELOAD_SETTINGS,
    async (event: any, appKey: string, instanceKey: string, settingsName: string, settingsValue: any) => {
      bifrostAppManager?.reloadSettings(appKey, instanceKey, settingsName, settingsValue);
    },
  );

  ipcMain.on(IPC_MESSAGE_RELOAD_RECENTLY_OPENED, (event: any, appKey: string, instanceKey: string) => {
    bifrostAppManager?.reloadRecentlyOpened(appKey, instanceKey);
  });

  ipcMain.on(IPC_MESSAGE_SOLUTION_CHANGED, (event, instanceKey: string, solutionUri: string) => {
    bifrostAppManager?.setSolutionUri(instanceKey, solutionUri);
  });

  ipcMain.on(IPC_MESSAGE_TERMINATE, (event: any) => {
    beforeQuitEventReceived = true;
    try {
      appManagerSubscriptions.forEach((subscription) => subscription.dispose());

      bifrostAppManager?.terminate();
    } catch (e) {
      console.error(e);
    }
    app.quit();
  });

  ipcMain.on(IPC_MESSAGE_QUIT, async (event: any) => {
    // Prevent the before-quit listener if app shall quit through IPC_MESSAGE_QUIT event
    beforeQuitEventReceived = true;
    try {
      appManagerSubscriptions.forEach((subscription) => subscription.dispose());
      saveAppFn();

      await bifrostAppManager?.gracefulShutdown();
    } catch (e) {
      console.error(e);
    }
    app.quit();
  });

  ipcMain.on(IPC_MESSAGE_UPDATE_MAIN_MENU, (event, template: any[]) => {
    const templateWithClickHandler = addClickListenerToElectronMenuTemplate(template);
    const electronMenu = Menu.buildFromTemplate(templateWithClickHandler);

    Menu.setApplicationMenu(electronMenu);
  });

  ipcMain.handle(IPC_INVOKE_GET_SYSTEMINFORMATION, async (event) => {
    const [osInfo, cpuInfo, diskInfo, memInfo, graphicsInfo, dockerInfo] = await new Promise<
      [
        sysinfo.Systeminformation.OsData,
        sysinfo.Systeminformation.CpuData,
        sysinfo.Systeminformation.DisksIoData,
        sysinfo.Systeminformation.MemData,
        sysinfo.Systeminformation.GraphicsData,
        sysinfo.Systeminformation.DockerInfoData,
      ]
    >((resolve, reject) => {
      const filename = path.resolve(__dirname, 'Systeminformation.js');
      const forkedProcess = fork(filename, {});

      forkedProcess.on('message', (message) => {
        resolve(message as any);
        forkedProcess.kill();
      });
      forkedProcess.on('error', (error) => {
        reject(error);
        forkedProcess.kill();
      });
    });

    const newHostSystem = {
      os: `${osInfo.distro} (${osInfo.release})`,
      cpu: `${cpuInfo.brand} (${cpuInfo.physicalCores} x ${cpuInfo.speed} GHz)`,
      storage: `${Math.round(diskInfo[0].size / 1024 / 1024 / 1024)} GB`,
      memory: `${Math.round(memInfo.total / 1024 / 1024 / 1024)} GB`,
      graphics: graphicsInfo.controllers[graphicsInfo.controllers.length - 1]?.model ?? 'NA',
      docker: dockerInfo.serverVersion ?? 'NA',
    };

    return newHostSystem;
  });

  ipcMain.handle(
    IPC_INVOKE_READ_FILE,
    (event, ...args: Parameters<typeof fsPromises.readFile>): ReturnType<typeof fsPromises.readFile> => {
      return fsPromises.readFile(...args);
    },
  );

  ipcMain.handle(IPC_INVOKE_EXISTS, async (event, filename: string): Promise<boolean> => {
    try {
      await fsPromises.stat(filename);
      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false;
      } else {
        throw error;
      }
    }
  });

  ipcMain.handle(
    IPC_INVOKE_WRITE_FILE,
    (event, ...args: Parameters<typeof fsPromises.writeFile>): ReturnType<typeof fsPromises.writeFile> => {
      return fsPromises.writeFile(...args);
    },
  );

  ipcMain.handle(IPC_INVOKE_IS_DIRECTORY, async (event, filename: string): Promise<boolean> => {
    try {
      const stat = await fsPromises.stat(filename);
      return stat.isDirectory();
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_INVOKE_READ_DIR, async (event, ...args: Parameters<typeof fsPromises.readdir>): Promise<any[]> => {
    const results = await fsPromises.readdir(...args);

    return results.map((result) => {
      return {
        name: result.name,
        isBlockDevice: result.isBlockDevice(),
        isDirectory: result.isDirectory(),
        isFile: result.isFile(),
        isSymbolicLink: result.isSymbolicLink(),
      };
    });
  });

  ipcMain.handle(IPC_INVOKE_TRAVERSE_DIRECTORY, async (event, rootDir: string, excludePatterns?: string[]) => {
    const hasExcludePatterns = excludePatterns != null && excludePatterns.length > 0;

    if (!hasExcludePatterns) {
      const entries = await fsPromises.readdir(rootDir, { withFileTypes: true, recursive: true });

      return entries.map((entry) => {
        const parentRelative = path.relative(rootDir, entry.parentPath);

        return {
          name: entry.name,
          relativePath: path.join(parentRelative, entry.name),
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
        };
      });
    }

    const excludeMatchers = excludePatterns.map((pattern) => new Minimatch(pattern));
    const results: { name: string; relativePath: string; isDirectory: boolean; isFile: boolean }[] = [];

    async function walkFiltered(dir: string, relativeBase: string): Promise<void> {
      let entries;
      try {
        entries = await fsPromises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;

        if (entry.isDirectory()) {
          const isDirExcluded = excludeMatchers.some(
            (matcher) => matcher.match(entry.name) || matcher.match(relativePath),
          );

          if (!isDirExcluded) {
            results.push({ name: entry.name, relativePath, isDirectory: true, isFile: false });
            await walkFiltered(path.join(dir, entry.name), relativePath);
          }
        } else if (entry.isFile()) {
          results.push({ name: entry.name, relativePath, isDirectory: false, isFile: true });
        }
      }
    }

    await walkFiltered(rootDir, '');
    return results;
  });

  ipcMain.handle(IPC_INVOKE_CREATE_DIR, (event, dirPath: string) => {
    return fsPromises.mkdir(dirPath, { recursive: true });
  });

  ipcMain.handle(IPC_INVOKE_COPY_FILE_OR_DIRECTORY, (event, source: string, destination: string) => {
    return fsPromises.cp(source, destination, { recursive: true });
  });

  ipcMain.handle(
    IPC_INVOKE_RENAME_FILE_OR_DIRECTORY,
    (event, ...args: Parameters<typeof fsPromises.rename>): ReturnType<typeof fsPromises.rename> => {
      return fsPromises.rename(...args);
    },
  );

  registerDialogHandlers();
  registerGitHandlers();

  ipcMain.handle(
    IPC_INVOKE_TRASH_ITEM,
    (event, ...args: Parameters<typeof shell.trashItem>): ReturnType<typeof shell.trashItem> => {
      return shell.trashItem(...args);
    },
  );

  ipcMain.handle(IPC_INVOKE_UNINSTALL_PLUGIN, async (_event, pluginPath: string) => {
    const pluginsDir = getPluginsDir();
    if (!path.resolve(pluginPath).startsWith(path.resolve(pluginsDir))) {
      throw new Error('Cannot uninstall: path is outside the plugins directory');
    }
    await shell.trashItem(pluginPath);
  });

  ipcMain.on(IPC_MESSAGE_PLUGIN_STATE_CHANGED, (event: any, action: string, pluginName: string) => {
    bifrostAppManager?.relayToOtherWindows(IPC_MESSAGE_PLUGIN_STATE_CHANGED, [action, pluginName], event.sender.id);
  });

  ipcMain.handle(IPC_INVOKE_GET_APP_PATH, () => app.getPath('exe'));

  /**
   * The before-quit hook gets called twice so we must prevent that saveAppFn gets called twice,
   * because the second call of saveAppFn would lead to save an empty windows array, because the windows might be already closed.
   *
   * The before-quit hook gets executed always if the app quits e.g. if the app will be closed through the dock/taskbar or the computer shuts down.
   */
  app.on('before-quit', (event: Electron.Event) => {
    if (beforeQuitEventReceived === false) {
      beforeQuitEventReceived = true;
      saveAppFn();
      bifrostAppManager?.setAppWillQuitUnexpected(true);

      const resetBeforeQuitEventReceivedTimeout = setTimeout(() => {
        clearTimeout(resetBeforeQuitEventReceivedTimeout);
        beforeQuitEventReceived = false;
      }, 1000);
    }
  });

  process.on('unhandledRejection', (error: any) => {
    const errorMessage = error?.message ?? error;
    console.error('Unhandled Rejection:', errorMessage);
    bifrostAppManager?.sendToAllWindows(IPC_MESSAGE_UNHANDLED_REJECTION_OR_ERROR, [errorMessage]);
  });

  process.on('uncaughtException', (error, origin) => {
    const errorMessage = `${origin}: ${error}`;
    console.error(errorMessage);
    bifrostAppManager?.sendToAllWindows(IPC_MESSAGE_UNHANDLED_REJECTION_OR_ERROR, [errorMessage]);
  });
}

/**
 * npm package names may contain lowercase alphanumeric, hyphens, dots,
 * underscores, and scoped names (`@scope/name`). Reject anything that
 * could escape the plugins directory (`.`, `..`, path separators).
 *
 * Accepts both raw names (`@scope/name`) and hostname-flattened forms (`scope--name`).
 */
function isValidPluginName(name: string): boolean {
  if (name.length === 0 || name === '.' || name === '..') {
    return false;
  }
  // Scoped names: @scope/name
  if (/^@[a-z0-9]([a-z0-9._-]*)?\/[a-z0-9]([a-z0-9._-]*)$/.test(name)) {
    return true;
  }
  // Unscoped or hostname-flattened: scope--name, my-plugin
  return /^[a-z0-9]([a-z0-9._-])*$/.test(name) && !name.includes('/') && !name.includes('\\');
}

/**
 * Reverse a hostname-flattened name back to the scoped npm form.
 * `scope--name` → `@scope/name`. Names without `--` pass through unchanged.
 */
function hostnameToPluginName(hostname: string): string {
  if (hostname.includes('--')) {
    const idx = hostname.indexOf('--');
    return `@${hostname.slice(0, idx)}/${hostname.slice(idx + 2)}`;
  }
  return hostname;
}

function addWebviewSecurityHeaders(response: Response, pluginName: string, schemeName: string): Response {
  const headers = new Headers(response.headers);
  headers.set(
    'Content-Security-Policy',
    [
      `default-src 'none'`,
      `script-src ${schemeName}://${pluginName} 'unsafe-inline'`,
      `style-src ${schemeName}://${pluginName} 'unsafe-inline'`,
      `img-src ${schemeName}://${pluginName} data:`,
      `font-src ${schemeName}://${pluginName}`,
      `connect-src ${schemeName}://${pluginName}`,
    ].join('; '),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function addClickListenerToElectronMenuTemplate(template: any[]) {
  return template.map((menuItem) => {
    if (menuItem.submenu) {
      const submenuTemplateWithClickListener = addClickListenerToElectronMenuTemplate(menuItem.submenu);
      return {
        ...menuItem,
        submenu: submenuTemplateWithClickListener,
      };
    }

    if (menuItem.command != null) {
      return {
        ...menuItem,
        click: (menuItem: any, browserWindow: Electron.BrowserWindow, event) =>
          browserWindow?.webContents?.send(
            IPC_MESSAGE_EXECUTE_COMMAND_AT_RENDERER,
            menuItem.command,
            menuItem.commandArgs,
          ),
      };
    }

    return menuItem;
  });
}

function filterArgv(givenArgv: string[]): string[] {
  let argv = givenArgv.slice(1);

  const electronEntrypointJsIndex = argv.findIndex((arg) => arg.indexOf('bundle-electron-main.js') != -1);
  const isElectronDebugBuild = electronEntrypointJsIndex !== -1;
  if (isElectronDebugBuild) {
    argv = argv.slice(electronEntrypointJsIndex + 1);
  }

  const beforeSeparator = '---';
  const beforeSeparatorIndex = argv.findIndex((arg) => arg === beforeSeparator);
  const beforeSeparatorIsPresent = beforeSeparatorIndex !== -1;
  if (beforeSeparatorIsPresent) {
    argv = argv.slice(0, beforeSeparatorIndex);
  }

  return argv;
}

function getElectronMessageBoxOptions(dialogOptions: DialogOptionsStrict_MessageBox): MessageBoxOptions {
  const type = 'none';
  const title = '';
  const message =
    typeof dialogOptions.content === 'string' ? dialogOptions.content : (dialogOptions.content[0] as any).text;
  const buttons = dialogOptions.actions.reverse().map((button: any) => button.label || button.response.toUpperCase());
  const defaultId = dialogOptions.actions.findIndex((button: any) => button.default);
  const cancelId = dialogOptions.actions.findIndex((button: any) => button.cancel);

  return {
    type,
    title,
    message,
    buttons,
    defaultId,
    cancelId,
  };
}

function getBrowserWindow(): BrowserWindow | null {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    return focusedWindow;
  }

  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length === 0) {
    return null;
  }

  return allWindows[0];
}

/**
 * Applies the ultimate home-directory fallback for native file dialogs.
 *
 * Since Electron v43, a dialog with no `defaultPath` opens in Downloads. The renderer
 * (`DialogManager`) resolves last-used / configured / solution directories, but when it
 * resolves nothing it leaves `defaultPath` empty (or a bare, relative filename). Here we
 * anchor that to the user's home directory so dialogs never fall back to Downloads.
 */
function withHomeFallback<T extends { defaultPath?: string }>(options: T): T {
  const provided = options.defaultPath;

  if (provided == null || provided.trim() === '') {
    return { ...options, defaultPath: app.getPath('home') };
  }

  if (!path.isAbsolute(provided)) {
    return { ...options, defaultPath: path.join(app.getPath('home'), provided) };
  }

  return options;
}

function registerDialogHandlers() {
  ipcMain.handle(
    IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG,
    (event, options: DialogOptionsStrict = { type: 'open-file' }) => {
      const dialogOptions: Electron.OpenDialogSyncOptions = {
        properties: ['openFile', 'multiSelections'],
        ...options,
      };

      const browserWindow = getBrowserWindow();
      if (!browserWindow) {
        return null;
      }

      const filenames = dialog.showOpenDialogSync(browserWindow, withHomeFallback(dialogOptions));

      return filenames || null;
    },
  );

  ipcMain.handle(IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG, (_event, options: DialogOptionsStrict | undefined) => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      return null;
    }

    const dialogOptions: Electron.OpenDialogSyncOptions = {
      properties: ['openDirectory'],
      ...options,
    };

    const filenames = dialog.showOpenDialogSync(browserWindow, withHomeFallback(dialogOptions));

    return filenames || null;
  });

  ipcMain.handle(IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX, (event, dialogOptions) => {
    const options = getElectronMessageBoxOptions(dialogOptions);
    const responses = dialogOptions.actions.map((button: DialogActionObject) => button.response);

    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      return null;
    }

    const responseIndex = dialog.showMessageBoxSync(browserWindow, options);
    const response = responses[responseIndex];
    const dialogResult: DialogResult = {
      wasCancelled: false,
      response: response,
    };

    return dialogResult;
  });

  ipcMain.handle(IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG, (_event, options) => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      return null;
    }

    const dialogOptions: Electron.SaveDialogSyncOptions = { ...(options ?? {}) };

    const filename = dialog.showSaveDialogSync(browserWindow, withHomeFallback(dialogOptions));

    return filename || null;
  });
}

const shellStartTime = Date.now();
const parsed = parseArgs({ args: filterArgv(process.argv), strict: false });
const argvAsObject: Record<string, any> = { _: parsed.positionals, ...parsed.values };

startMain(argvAsObject, shellStartTime);
