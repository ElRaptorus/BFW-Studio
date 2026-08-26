import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import { ipcRenderer, webUtils } from 'electron';
import log from 'electron-log/renderer';
import { createRoot } from 'react-dom/client';

import React from 'react';

import App from '../../App';
import { BifrostProvider } from '../../bifrostContext';
import { createAndInitializeBifrost } from '../../createAndInitializeBifrost';
import * as BuildInfo from '../../generatedBuildAndProductInfo';
import type { Bifrost } from '../Bifrost';
import { getOperatingSystem } from '../browser/BrowserFunctions';
import { SearchIndex } from '../browser/SearchIndex';
import { SymbolIndex } from '../browser/SymbolIndex';
import { EVENT_SOLUTION_CHANGED } from '../common/SolutionManager';
import { initializeBifrostWindowOpenMagic } from '../common/WindowOpenMagicFunctions';
import type { BifrostOptions, BifrostWindowSerialized } from '../contracts/BifrostTypes';
import {
  IPC_MESSAGE_CLOSE_FOCUSED_WINDOW,
  IPC_MESSAGE_CREATE_NEW_WINDOW,
  IPC_MESSAGE_FOCUS_WINDOW,
  IPC_MESSAGE_GET_WINDOWS,
  IPC_MESSAGE_HIDE_WINDOW_BY_INSTANCE_ID,
  IPC_MESSAGE_MAXIMIZE_FOCUSED_WINDOW,
  IPC_MESSAGE_MINIMIZE_FOCUSED_WINDOW,
  IPC_MESSAGE_QUIT,
  IPC_MESSAGE_RELOAD_RECENTLY_OPENED,
  IPC_MESSAGE_RELOAD_SETTINGS,
  IPC_MESSAGE_RESOLVE_WINDOW_CLOSING_PROMISE_WITH_RESULT,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG,
  IPC_MESSAGE_SOLUTION_CHANGED,
  IPC_MESSAGE_TERMINATE,
  IPC_MESSAGE_UNHANDLED_REJECTION_OR_ERROR,
  IPC_MESSAGE_WARN_ABOUT_UNSAVED_EDITOR_DOCUMENTS_BEFORE_CLOSING,
  IPC_MESSAGE_WINDOW_CLOSED_BY_USER,
  IPC_MESSAGE_WINDOW_CLOSED_BY_USER_PROMISE,
  IPC_MESSAGE_WINDOW_NAVIGATE_TO_URL,
} from '../contracts/IpcEvents';
import type { QuickJumpItem } from '../contracts/QuickJumpTypes';
import { EVENT_RECENTLY_OPENED_CHANGED } from '../contracts/RecentTypes';
import DialogServiceElectron from './DialogServiceElectron';
import FileHandlingServiceElectron from './FileHandlingServiceElectron';
import { HttpServiceElectron } from './HttpServiceElectron';
import MenuManagerElectron from './MenuManagerElectron';
import { initializeElectronCommands } from './initializeElectronCommands';
import { PluginHost } from './plugin-host/PluginHost';

if (BuildInfo.releaseChannelName === 'unknown') {
  // Turn on debugging output in console
  window.localStorage.debug = '*,-engine.io-client:*,-socket.io*';
} else {
  // hide debug output from client.ts
  process.env.minLogLevel = 'error';
}

async function startRenderer(bifrostWindowOptions: any): Promise<void> {
  log.transports.ipc.level = false;
  Object.assign(console, log.functions);

  const env = 'electron';
  const os = getOperatingSystem();
  const performanceEntries: any[] = bifrostWindowOptions.performanceEntries ?? [];
  const startArgs = bifrostWindowOptions.args ?? {};

  const bifrostOptions: BifrostOptions = {
    client: env,
    os,
    startupArgs: startArgs,
    performanceEntries,
    isPackaged: bifrostWindowOptions.isPackaged,
    appKey: bifrostWindowOptions.appKey,
    instanceKey: bifrostWindowOptions.instanceKey,
    localStorageInstance: window.localStorage,
    dialogServiceConstructor: DialogServiceElectron,
    fileHandlingConstructor: FileHandlingServiceElectron,
    httpServiceConstructor: HttpServiceElectron,
    menuManagerConstructor: MenuManagerElectron,
    searchIndexConstructor: SearchIndex,
    symbolIndexConstructor: SymbolIndex,
    pluginHostConstructor: PluginHost,
    webviewProtocol: bifrostWindowOptions.webviewProtocol,
  };

  const uiRoot = document.getElementById('root')!;
  const bifrost = await createAndInitializeBifrost(uiRoot, bifrostOptions, async (bifrost: Bifrost): Promise<void> => {
    initializeElectronCommands(bifrost);
    // sent when the user closes the window intentionally, e.g. by clicking the "x" in the titlebar
    ipcRenderer.on(IPC_MESSAGE_WINDOW_CLOSED_BY_USER, async (event, currentWindowCount) => {
      bifrost.commands.executeCommand('std.window.hide');

      await bifrost.plugins.shutdown();

      if (currentWindowCount > 1) {
        bifrost.clearInstance();
      }

      const windows = (await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS)) as BifrostWindowSerialized[];
      const currentIndex = windows.findIndex(
        (windowInfo: BifrostWindowSerialized) => bifrost.env.instanceKey === windowInfo.instanceKey,
      );

      const currentWindowId = windows[currentIndex].id;

      ipcRenderer.send(`${IPC_MESSAGE_WINDOW_CLOSED_BY_USER_PROMISE}_${currentWindowId}`);
    });
    ipcRenderer.on(IPC_MESSAGE_WINDOW_NAVIGATE_TO_URL, (event, url: string) => {
      let hasRegisteredTypeForUri = false;
      try {
        hasRegisteredTypeForUri = bifrost.editors.getDocumentTypeDefinitionByUri(url) != null;
      } catch {
        // do nothing
      }

      if (hasRegisteredTypeForUri) {
        bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [url]);
        return;
      }

      if (bifrost.files.isHttpUri(url)) {
        bifrost.commands.executeCommand('std.editor.openUrlInBrowser', [url]);
        return;
      }

      bifrost.commands.executeCommand('std.window.handlePotentiallyHarmfulWindowNavigation', [url]);
    });
    ipcRenderer.on(IPC_MESSAGE_UNHANDLED_REJECTION_OR_ERROR, (event: any, errorMessage: string): void => {
      throw new Error(errorMessage.toString());
    });

    bifrost.solution.on(EVENT_SOLUTION_CHANGED, () => {
      const solution = bifrost.solution.getSolution();
      const solutionUri = solution?.solutionFileUri ?? solution?.baseUri;

      ipcRenderer.send(IPC_MESSAGE_SOLUTION_CHANGED, bifrost.env.instanceKey, solutionUri);
    });

    initializeBifrostWindowManagementForElectron(bifrost);
    initializeBifrostWindowSettingsPropagation(bifrost);
    initializeBifrostRecentlyOpenedPropagation(bifrost);
    initializeBifrostWindowOpenMagic(bifrost);

    window.onfocus = () => {
      bifrost.menus.updateMenus();
    };

    ipcRenderer.on(
      IPC_MESSAGE_WARN_ABOUT_UNSAVED_EDITOR_DOCUMENTS_BEFORE_CLOSING,
      async (event: Electron.IpcRendererEvent): Promise<void> => {
        const editorDocumentsToSave = bifrost.editors
          .getOpenEditorDocuments()
          .filter((editorDocument) => editorDocument.hasUnsavedChanges);

        const success = await bifrost.editors.warnAboutUnsavedEditorDocumentsAndAskForSaving(editorDocumentsToSave);

        if (success) {
          await bifrost.plugins.shutdown();
        }

        const windows = (await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS)) as BifrostWindowSerialized[];
        const currentIndex = windows.findIndex(
          (windowInfo: BifrostWindowSerialized) => bifrost.env.instanceKey === windowInfo.instanceKey,
        );

        const currentWindowId = windows[currentIndex].id;

        ipcRenderer.send(`${IPC_MESSAGE_RESOLVE_WINDOW_CLOSING_PROMISE_WITH_RESULT}_${currentWindowId}`, success);
      },
    );

    removeUnusedWindowInstancesFromLocalStorage();
  });

  applyCustomBifrostWindowOptions(bifrost, bifrostWindowOptions);

  // Adds commands for window-management, which are not available or are implemented differently in the webapp
  function initializeBifrostWindowManagementForElectron(bifrost: Bifrost): void {
    bifrost.commands.register('std.window.handlePotentiallyHarmfulWindowNavigation', (url: string) => {
      bifrost.notifications.open({
        type: 'info',
        content: `Could not navigate to '${url}'`,
      });
    });

    bifrost.commands.register('std.window.terminate', async () => {
      await bifrost.plugins.shutdown();
      ipcRenderer.send(IPC_MESSAGE_TERMINATE);
    });

    bifrost.commands.register(
      'std.window.quit',
      async () => {
        await bifrost.plugins.shutdown();
        ipcRenderer.send(IPC_MESSAGE_QUIT);
      },
      { visibleInSearch: true, description: 'Application: Quit' },
    );

    bifrost.commands.register(
      'std.window.new',
      () => {
        const currentEngineMenuBarUrl = bifrost.commands.isRegistered('engine.menubar.getEngineUrl')
          ? bifrost.commands.executeCommand<string>('engine.menubar.getEngineUrl')
          : '';
        ipcRenderer.send(IPC_MESSAGE_CREATE_NEW_WINDOW, { engineMenuBarToSet: currentEngineMenuBarUrl });
      },
      { visibleInSearch: true, description: 'Window: New window' },
    );

    bifrost.commands.register(
      'std.window.maximize',
      () => {
        ipcRenderer.send(IPC_MESSAGE_MAXIMIZE_FOCUSED_WINDOW);
      },
      { visibleInSearch: true, description: 'Window: Maximize window' },
    );

    bifrost.commands.register(
      'std.window.minimize',
      () => {
        ipcRenderer.send(IPC_MESSAGE_MINIMIZE_FOCUSED_WINDOW);
      },
      { visibleInSearch: true, description: 'Window: Minimize window' },
    );

    bifrost.commands.register(
      'std.window.close',
      () => {
        ipcRenderer.send(IPC_MESSAGE_CLOSE_FOCUSED_WINDOW);
      },
      { visibleInSearch: true, description: 'Window: Close window' },
    );

    bifrost.commands.register('std.window.hide', async () => {
      ipcRenderer.invoke(IPC_MESSAGE_HIDE_WINDOW_BY_INSTANCE_ID, bifrost.env.instanceKey);
    });

    bifrost.commands.register(
      'std.window.newFromFocusedDocument',
      () => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();
        if (editorDocument == null) {
          return;
        }

        ipcRenderer.send(IPC_MESSAGE_CREATE_NEW_WINDOW, {
          editorDocumentModal: true,
          editorDocumentUri: editorDocument.uri,
        });
      },
      { visibleInSearch: true, description: 'Window: Open active document in new window' },
    );

    bifrost.commands.register(
      'std.window.focusOrOpenWithSolution',
      async (uri: string) => {
        const windows = (await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS)) as BifrostWindowSerialized[];

        const solutionIsAlreadyOpened = windows.find((window) => window.solutionUri === uri);
        if (solutionIsAlreadyOpened) {
          return bifrost.commands.executeCommand('std.window.focusWindowById', [solutionIsAlreadyOpened.id]);
        }

        bifrost.recentlyOpened.addRecentlyOpenedSolutionItem({ uri: uri });

        const localPath = bifrost.files.getLocalFilenameForUri(uri);

        const currentEngineMenuBarUrl = bifrost.commands.isRegistered('engine.menubar.getEngineUrl')
          ? bifrost.commands.executeCommand<string>('engine.menubar.getEngineUrl')
          : '';

        ipcRenderer.send(IPC_MESSAGE_CREATE_NEW_WINDOW, {
          args: { _: [localPath] },
          engineMenuBarToSet: currentEngineMenuBarUrl,
        });
      },
      {
        enabledWhen: (uri: string) => {
          const windows = ipcRenderer.sendSync(IPC_MESSAGE_GET_WINDOWS) as BifrostWindowSerialized[];
          const windowWithSolutionUriAlreadyOpened = windows.some((window) => window.solutionUri === uri);

          return bifrost.solution.hasOpenSolution() || windowWithSolutionUriAlreadyOpened;
        },
      },
    );

    bifrost.commands.register(
      'std.window.switchNext',
      async () => {
        const windows = (await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS)) as BifrostWindowSerialized[];
        const currentIndex = windows.findIndex(
          (windowInfo: BifrostWindowSerialized) => bifrost.env.instanceKey === windowInfo.instanceKey,
        );
        let nextIndex = currentIndex + 1;
        if (nextIndex >= windows.length) {
          nextIndex = 0;
        }

        const windowInfo = windows[nextIndex];
        assertNotNull(windowInfo, 'windowInfo');

        ipcRenderer.send(IPC_MESSAGE_FOCUS_WINDOW, windowInfo.id);
      },
      { visibleInSearch: true, description: 'Window: Quick switch' },
    );

    bifrost.commands.register(
      'std.window.switchChoose',
      async () => {
        const windows =
          await bifrost.commands.executeCommand<Promise<BifrostWindowSerialized[]>>('std.window.getWindowInfos');

        const entries: QuickJumpItem[] = windows.map((windowInfo: BifrostWindowSerialized) => {
          const namePrefix = windowInfo.isCurrentWindow ? '* ' : '';

          return {
            type: 'callback',
            label: namePrefix + windowInfo.title,
            callbackFn: () => bifrost.commands.executeCommand('std.window.focusWindowById', [windowInfo.id]),
          };
        });

        bifrost.quickJump.show({ prompt: 'Select window to focus', entries: entries });
      },
      { visibleInSearch: true, description: 'Window: Switch window ...' },
    );

    bifrost.commands.register('std.window.getWindowInfos', async (): Promise<BifrostWindowSerialized[]> => {
      const instanceKey = bifrost.env.instanceKey;
      const windows = await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS);

      return windows.map((windowInfo: BifrostWindowSerialized) => {
        return {
          ...windowInfo,
          isCurrentWindow: instanceKey === windowInfo.instanceKey,
        };
      });
    });

    bifrost.commands.register('std.window.focusWindowById', (windowId: string) => {
      ipcRenderer.send(IPC_MESSAGE_FOCUS_WINDOW, windowId);
    });

    bifrost.commands.register('std.internal.pickNativeDirectory', async (): Promise<string | null> => {
      const filenames = await ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG);
      return filenames?.[0] ?? null;
    });

    bifrost.commands.register('std.internal.pickNativeFile', async (): Promise<string | null> => {
      const filenames = await ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG);
      return filenames?.[0] ?? null;
    });

    bifrost.commands.register('std.internal.getPathsFromFiles', (files: File[]): string[] => {
      return files.map((file) => webUtils.getPathForFile(file)).filter(Boolean);
    });
  }

  function applyCustomBifrostWindowOptions(bifrost: Bifrost, options: any): void {
    if (options.editorDocumentModal) {
      bifrost.commands.executeCommand('std.workbench.toggleFocusMode');
    }
    if (options.editorDocumentUri) {
      bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [options.editorDocumentUri]);
    }
    if (options.engineMenuBarToSet) {
      bifrost.commands.executeCommand('engine.menubar.setEngineUrl', [options.engineMenuBarToSet]);
    }
    if (options.args && options.args['diff-before'] && options.args['diff-after']) {
      const diffBefore = bifrost.files.getUriForFilename(options.args['diff-before']);
      const diffAfter = bifrost.files.getUriForFilename(options.args['diff-after']);

      bifrost.commands.executeCommand('bpmn.diff.openDiffTwoFiles', [diffBefore, diffAfter]);
    }
  }

  // Ensures that propagating settings across windows does not end in an infinite loop of events
  function initializeBifrostWindowSettingsPropagation(bifrost: Bifrost): void {
    let reloadWasTriggeredByThisWindow = false;

    bifrost.settings.on(EVENT_SETTINGS_CHANGED, (name: string, value: any) => {
      if (reloadWasTriggeredByThisWindow) {
        return;
      }

      ipcRenderer.send(IPC_MESSAGE_RELOAD_SETTINGS, bifrost.env.appKey, bifrost.env.instanceKey, name, value);
    });

    ipcRenderer.on(
      IPC_MESSAGE_RELOAD_SETTINGS,
      (event: any, appKey: string, instanceKey: string, name: string, value: any) => {
        if (reloadWasTriggeredByThisWindow || instanceKey === bifrost.env.instanceKey) {
          return;
        }

        reloadWasTriggeredByThisWindow = true;
        bifrost.settings.onSettingsChangedInOtherInstance(name, value);
        reloadWasTriggeredByThisWindow = false;
      },
    );
  }

  function initializeBifrostRecentlyOpenedPropagation(bifrost: Bifrost): void {
    let reloadWasTriggeredByThisWindow = false;

    bifrost.recentlyOpened.on(EVENT_RECENTLY_OPENED_CHANGED, () => {
      if (reloadWasTriggeredByThisWindow) {
        return;
      }

      ipcRenderer.send(IPC_MESSAGE_RELOAD_RECENTLY_OPENED, bifrost.env.appKey, bifrost.env.instanceKey);
    });

    ipcRenderer.on(IPC_MESSAGE_RELOAD_RECENTLY_OPENED, (event: any, appKey: string, instanceKey: string) => {
      if (reloadWasTriggeredByThisWindow || instanceKey === bifrost.env.instanceKey) {
        return;
      }

      reloadWasTriggeredByThisWindow = true;
      bifrost.recentlyOpened.onRecentlyOpenedChangedInOtherInstance();
      reloadWasTriggeredByThisWindow = false;
    });
  }

  async function removeUnusedWindowInstancesFromLocalStorage() {
    const localStorageItems = Object.keys(window.localStorage);
    const windows = (await ipcRenderer.invoke(IPC_MESSAGE_GET_WINDOWS)) as any[];

    localStorageItems.forEach((item) => {
      const itemIsFromCurrentlyOpenedWindows = windows.some((window) =>
        item.startsWith(`${bifrostWindowOptions.appKey}/${window.instanceKey}`),
      );

      if (itemIsFromCurrentlyOpenedWindows) {
        return;
      }

      const itemIsFromBifrostAndInstanceItem = item.startsWith(`${bifrostWindowOptions.appKey}/window-`);
      if (itemIsFromBifrostAndInstanceItem) {
        window.localStorage.removeItem(item);
      }
    });
  }

  const root = createRoot(uiRoot);
  root.render(
    <BifrostProvider value={bifrost}>
      <App />
    </BifrostProvider>,
  );

  (window as any).bifrost = bifrost;
}

async function run() {
  const queryParams = new URLSearchParams(window.location.search);
  const bifrostWindowOptions = JSON.parse(queryParams.get('windowOptions')!);
  (window as any).bifrostWindowOptions = bifrostWindowOptions;
  startRenderer(bifrostWindowOptions);
}
run();
