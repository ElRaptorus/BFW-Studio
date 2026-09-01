import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';

import type { Menu, MenuItem } from '@evil/bifrost_fw_sdk';

export function initializeMenus(bifrost: Bifrost): void {
  registerApplicationMenu(bifrost);

  registerLeftMenuBarOverflowMenu(bifrost);
  registerEditorMenu(bifrost);
  registerEditorTabListControlsMoreMenu(bifrost);
  registerFileExplorerMenus(bifrost);
  registerComponentMenu(bifrost);

  registerMockMenu(bifrost);
}

function registerComponentMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu(
    'std/component/input/text',
    (target: HTMLInputElement, setValue?: (value: string) => void): Menu => {
      const menu: Menu = [
        {
          type: 'command',
          label: 'Cut',
          id: 'std/component/input/text/cut',
          command: 'std.internal.cutToClipboard',
          commandArgs: [target, setValue],
          visible: setValue !== undefined,
        },
        {
          type: 'command',
          label: 'Copy',
          id: 'std/component/input/text/copy',
          command: 'std.internal.copyToClipboard',
          commandArgs: [target],
        },
        {
          type: 'command',
          label: 'Paste',
          id: 'std/component/input/text/paste',
          command: 'std.internal.pasteFromClipboard',
          commandArgs: [target, setValue],
          visible: setValue !== undefined,
        },
        {
          type: 'command',
          label: 'Clear',
          id: 'std/component/input/text/clear',
          command: 'std.internal.clear',
          commandArgs: [target, setValue],
          visible: setValue !== undefined,
        },
        {
          type: 'command',
          label: 'Select All',
          id: 'std/component/input/text/select-all',
          command: 'std.internal.selectAll',
          commandArgs: [target],
        },
      ];

      return menu;
    },
  );
}

function registerApplicationMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu('std/application/main', async (bifrost: Bifrost): Promise<Menu> => {
    const getOptionalMacAppMenu = (): any[] => {
      const productName = bifrost.env.productNameWithReleaseChannel;

      if (bifrost.env.isMac && bifrost.env.isElectron) {
        return [
          {
            type: 'menu',
            id: 'app',
            submenu: [
              { type: 'role', role: 'services', id: 'app/services' },
              { type: 'divider' },
              { type: 'role', role: 'hide', label: `Hide ${productName}`, id: 'app/hide' },
              { type: 'role', role: 'hideothers', id: 'app/hide-others' },
              { type: 'role', role: 'unhide', id: 'app/unhide' },
              { type: 'divider' },
              {
                type: 'command',
                label: `Close ${productName}`,
                id: 'app/quit',
                command: 'std.window.quit',
              },
            ],
          },
        ];
      }
      return [];
    };

    const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();

    const recentSolutions = bifrost.recentlyOpened
      .getRecentlyOpenedSolutions()
      .filter((recentItem: any) => recentItem.uri.match(/^file:/) != null)
      .slice(0, 7);

    const recentSolutionsSubmenu: MenuItem[] = await Promise.all(
      recentSolutions.map(async (recentDocItem: any, index) => {
        return {
          type: 'command' as const,
          label: await bifrost.files.getLocalDirectory(recentDocItem.uri, true),
          id: `file/open-recent/open-recent-doc-item-as-directory-${index}`,
          command: 'std.solution.openDirectory',
          commandArgs: [recentDocItem.uri],
        };
      }),
    );

    if (recentSolutionsSubmenu.length > 0) {
      recentSolutionsSubmenu.push({ type: 'divider' });
    }

    const recentFiles = bifrost.recentlyOpened.getRecentlyOpenedFiles().slice(0, 11);
    const recentFilesSubmenu: MenuItem[] = await Promise.all(
      recentFiles.map(async (recentDocItem: any, index) => {
        return {
          type: 'command' as const,
          label:
            (await bifrost.files.getLocalDirectory(recentDocItem.uri, true)) +
            '/' +
            bifrost.files.getFilename(recentDocItem.uri),
          id: `file/open-recent/open-recent-doc-item-${index}`,
          command: 'std.editor.focusOrOpenDocument',
          commandArgs: [recentDocItem.uri],
        };
      }),
    );
    if (recentFilesSubmenu.length > 0) {
      recentFilesSubmenu.push({ type: 'divider' });
    }

    const recentSubmenu = [
      {
        type: 'command',
        label: 'Reopen Closed Document',
        id: 'file/open-recent/reopen-closed-document',
        command: 'std.editor.reopenRecentlyClosedDocument',
      },
      {
        type: 'divider',
      },
      ...recentSolutionsSubmenu,
      ...recentFilesSubmenu,
      {
        type: 'command',
        label: 'More ...',
        id: 'file/open-recent/more',
        command: 'std.workbench.showRecentlyOpened',
      },
      {
        type: 'divider',
      },

      {
        type: 'command',
        label: 'Clear Recently Opened',
        id: 'file/open-recent/clear-recently-opened',
        command: 'std.editor.clearRecentlyOpened',
      },
    ];
    const leftMenuBarItems = bifrost.menuBar.getViewData().items.left;
    const leftMenuBarEntries: MenuItem[] = [];
    for (const item of leftMenuBarItems) {
      if (item.type === 'pane_content_toggle') {
        const focusCommand = PANE_FOCUS_COMMANDS[item.paneId];
        leftMenuBarEntries.push({
          type: 'command',
          label: item.tooltip,
          icon: item.icon,
          id: `view/${item.tooltip.toLowerCase().replace(/\s/g, '-')}`,
          command: focusCommand ?? 'std.workbench.toggleLeftPaneAreaItem',
          commandArgs: focusCommand != null ? undefined : [item.paneId],
        });
      } else if (item.type === 'button') {
        leftMenuBarEntries.push({
          type: 'command',
          label: item.tooltip,
          id: `view/${item.tooltip.toLowerCase().replace(/\s/g, '-')}`,
          command: item.command,
          commandArgs: item.commandArgs,
        });
      }
    }

    const windowMenuAsArray: any = [];
    if (bifrost.commands.isRegistered('std.window.getWindowInfos')) {
      const windowEntries: MenuItem[] = [];
      const windows = await bifrost.commands.executeCommand('std.window.getWindowInfos');

      windows.forEach((windowInfo: any, index) => {
        windowEntries.push({
          type: 'command',
          label: windowInfo.title,
          id: `window/focus-window-by-id-${index}`,
          command: 'std.window.focusWindowById',
          commandArgs: [windowInfo.id],
          checked: windowInfo.isCurrentWindow,
        });
      });

      windowMenuAsArray.push({
        type: 'menu',
        id: 'window',
        label: 'Window',
        submenu: [
          { type: 'role', role: 'minimize', id: 'window/minimize' },
          { type: 'role', role: 'zoom', id: 'window/zoom' },
          { type: 'divider' },
          {
            type: 'command',
            label: 'Switch Window ...',
            id: 'window/switch-choose',
            command: 'std.window.switchChoose',
          },
          { type: 'divider' },
          ...windowEntries,
        ],
      });
    }

    const getLabelForReExportMenuEntry = () => {
      const reExportIsDisabled = !bifrost.commands.isCommandEnabled('std.editor.reexportFile');

      if (reExportIsDisabled) {
        return 'Re-Export file';
      }

      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      const localStorage = bifrost.getLocalStorage('document-exports');

      const storedDocumentExportSettings = localStorage.load() ?? {};
      const settingsForDocument = storedDocumentExportSettings[editorDocument.uri];

      const humanizedFilename = bifrost.files.getFilename(settingsForDocument.targetFileUri);

      return `Re-Export to '${humanizedFilename}'`;
    };

    const appMenu: Menu = [
      ...getOptionalMacAppMenu(),
      {
        type: 'menu',
        id: 'file',
        label: 'File',
        submenu: [
          {
            type: 'command',
            label: 'New File',
            id: 'file/new-file',
            command: 'std.solution.newFile',
          },
          {
            type: 'command',
            label: 'New Solution ...',
            id: 'file/new-solution',
            command: 'std.solution.createSolution',
          },
          {
            type: 'command',
            label: 'New Window ...',
            id: 'file/new-window',
            visible: bifrost.env.isElectron,
            command: 'std.window.new',
          },
          { type: 'divider' },
          {
            type: 'command',
            label: 'Open File ...',
            id: 'file/open-document',
            command: 'std.editor.openDocument',
          },
          {
            type: 'command',
            label: bifrost.env.isMac ? 'Open Solution ...' : 'Open Folder ...',
            id: 'file/open-solution',
            command: 'std.editor.openFolderAsSolution',
          },
          {
            type: 'command',
            label: 'Open Solution File ...',
            id: 'file/open-solution-file',
            visible: !bifrost.env.isMac,
            command: 'std.solution.openSolutionFile',
          },
          {
            type: 'menu',
            label: 'Open Recent',
            id: 'file/open-recent',
            submenu: recentSubmenu,
          },
          {
            type: 'command',
            label: 'Add Folder to Solution ...',
            id: 'file/add-folder-to-solution',
            command: 'std.solution.addFolder',
            visible: bifrost.solution.hasOpenSolution(),
          },
          { type: 'divider' },
          {
            type: 'command',
            label: 'Save File',
            id: 'file/save-file',
            command: 'std.editor.saveFocusedDocument',
          },
          {
            type: 'command',
            label: 'Save File as ...',
            id: 'file/save-file-as',
            command: 'std.editor.saveFocusedDocumentAs',
          },
          {
            type: 'command',
            label: 'Save All',
            id: 'file/save-all',
            command: 'std.editor.saveUnsavedDocuments',
          },
          { type: 'divider', visible: bifrost.solution.hasOpenSolution() },
          {
            type: 'command',
            label: 'Save Solution',
            id: 'file/save-solution',
            command: 'std.solution.saveSolution',
            visible: bifrost.solution.hasOpenSolution(),
          },
          {
            type: 'command',
            label: 'Save Solution As ...',
            id: 'file/save-solution-as',
            command: 'std.solution.saveSolutionAs',
            visible: bifrost.solution.hasOpenSolution(),
          },
          { type: 'divider', visible: bifrost.solution.hasOpenSolution() },
          {
            type: 'command',
            label: 'Export File as ...',
            id: 'file/export-file-as',
            command: 'std.editor.showExportDialog',
          },
          {
            type: 'command',
            label: getLabelForReExportMenuEntry(),
            id: 'file/re-export-file-as',
            command: 'std.editor.reexportFile',
          },
          { type: 'divider' },
          {
            type: 'command',
            label: 'Close Tab',
            id: 'file/close-tab',
            command: 'std.editor.closeFocusedDocument',
          },
          {
            type: 'command',
            label: 'Close Other Tabs',
            id: 'file/close-other-tabs',
            command: 'std.editor.closeOtherEditorDocuments',
            commandArgs: [focusedEditorDocument],
          },
          {
            type: 'command',
            label: 'Close Saved Tabs',
            id: 'file/close-saved-tabs',
            command: 'std.editor.closeSavedEditorDocuments',
            commandArgs: [focusedEditorDocument],
          },
          {
            type: 'command',
            label: 'Close All Tabs',
            id: 'file/close-all-tabs',
            command: 'std.editor.closeAllEditorDocuments',
            commandArgs: [focusedEditorDocument],
          },
          { type: 'divider', visible: bifrost.solution.hasOpenSolution() },
          {
            type: 'command',
            label: 'Close Solution',
            id: 'file/close-solution',
            command: 'std.solution.closeSolution',
            visible: bifrost.solution.hasOpenSolution(),
          },
        ],
      },
      {
        type: 'menu',
        id: 'edit',
        label: 'Edit',
        submenu: [
          { type: 'command', label: 'Undo', id: 'edit/undo', command: 'std.editor.undoInFocusedEditorDocument' },
          { type: 'command', label: 'Redo', id: 'edit/redo', command: 'std.editor.redoInFocusedEditorDocument' },
          { type: 'divider' },
          { type: 'role', role: 'cut', id: 'edit/cut' },
          { type: 'role', role: 'copy', id: 'edit/copy' },
          { type: 'role', role: 'paste', id: 'edit/paste' },
          { type: 'divider' },
          { type: 'role', role: 'selectall', id: 'edit/select-all' },
          { type: 'divider' },
          {
            type: 'command',
            label: 'Find',
            id: 'edit/show-and-focus-inline-search',
            command: 'std.editor.showAndFocusInlineSearch',
          },
          {
            type: 'command',
            label: 'Find in Files',
            id: 'edit/focus-search',
            command: 'std.workbench.focusSearch',
          },
        ],
      },
      {
        type: 'menu',
        id: 'view',
        label: 'View',
        submenu: [
          {
            type: 'command',
            label: 'Show Welcome Page',
            icon: 'std/menubar/startpage',
            id: 'view/startpage',
            command: 'std.startpage.open',
          },
          { type: 'divider' },
          {
            type: 'command',
            id: 'view/command-search',
            label: 'Command Search',
            command: 'std.quickJump.showCommands',
          },
          { type: 'divider' },
          {
            type: 'menu',
            id: 'view/appearance',
            label: 'Appearance',
            submenu: [
              { type: 'role', role: 'togglefullscreen', id: 'view/appearance/toggle-fullscreen' },
              {
                type: 'command',
                id: 'view/appearance/toggle-focus-mode',
                label: 'Toggle Focus Mode',
                checked: bifrost.commands.executeCommand('std.workbench.isInFocusMode'),
                command: 'std.workbench.toggleFocusMode',
              },

              { type: 'divider' },

              {
                type: 'command',
                label: 'Menu Bar',
                id: 'view/appearance/toggle-menu-bar',
                checked: bifrost.menuBar.isVisible(),
                command: 'std.workbench.toggleMenuBar',
              },
              {
                type: 'command',
                label: 'Sidebar',
                id: 'view/appearance/toggle-sidebar',
                checked: bifrost.panes.getPaneAreaVisibility('left'),
                command: 'std.workbench.toggleSidebar',
              },
              {
                type: 'command',
                label: 'Property Panel',
                id: 'view/appearance/toggle-property-panel',
                checked: bifrost.panes.getPaneAreaVisibility('right'),
                command: 'std.workbench.togglePropertyPanel',
              },
              {
                type: 'command',
                label: 'Inspector Panel',
                id: 'view/appearance/toggle-inspector-panel',
                checked: bifrost.panes.getPaneAreaVisibility('bottom'),
                command: 'std.workbench.toggleInspectorPanel',
              },
              {
                type: 'command',
                label: 'Status Bar',
                id: 'view/appearance/toggle-status-bar',
                checked: bifrost.statusBar.isVisible(),
                command: 'std.workbench.toggleStatusBar',
              },

              { type: 'divider' },

              {
                type: 'command',
                label: 'Document: Zoom to 100%',
                id: 'view/appearance/zoom-to-acutal-size',
                command: 'std.editor.zoomToActualSize',
              },
              {
                type: 'command',
                label: 'Document: Zoom to viewport',
                id: 'view/appearance/zoom-to-viewport',
                command: 'std.editor.zoomToViewport',
              },
              {
                type: 'command',
                label: 'Document: Zoom to selected element',
                id: 'view/appearance/zoom-to-selected-element',
                command: 'std.editor.zoomToSelectedElement',
              },

              { type: 'divider' },

              { type: 'role', role: 'resetzoom', label: 'Interface: Reset zoom', id: 'view/appearance/reset-zoom' },
              { type: 'role', role: 'zoomin', label: 'Interface: Zoom in', id: 'view/appearance/zoom-in' },
              { type: 'role', role: 'zoomout', label: 'Interface: Zoom out', id: 'view/appearance/zoom-out' },
            ],
          },
          {
            type: 'menu',
            id: 'view/editor-layout',
            label: 'Editor Layout',
            submenu: [
              {
                type: 'command',
                label: 'Split editor to the right',
                id: 'view/editor-layout/split-to-the-right',
                command: 'std.editor.splitToTheRight',
                commandArgs: [focusedEditorDocument],
              },
              {
                type: 'command',
                label: 'Split editor to the bottom',
                id: 'view/editor-layout/split-to-the-bottom',
                command: 'std.editor.splitToTheBottom',
                commandArgs: [focusedEditorDocument],
              },
            ],
          },
          {
            type: 'menu',
            id: 'view/editor-tabs',
            label: 'Editor Tabs',
            submenu: [
              {
                type: 'command',
                label: 'Temporary Tabs',
                id: 'view/editor-layout/temporary-tabs',
                checked: bifrost.settings.get('workbench.editor.temporaryTabs'),
                command: 'std.workbench.toggleTemporaryTabs',
              },
            ],
          },

          { type: 'divider' },
          ...leftMenuBarEntries,
          { type: 'divider' },
          {
            type: 'menu',
            id: 'view/inspectors',
            label: 'Inspectors',
            submenu: [
              {
                type: 'command',
                label: 'Editor Document Inspector',
                id: 'view/inspectors/document',
                command: 'std.workbench.toggleEditorDocumentInspector',
              },
              {
                type: 'command',
                label: 'Notification Inspector',
                id: 'view/inspectors/notification',
                command: 'std.workbench.focusNotificationInspector',
              },
              {
                type: 'command',
                id: 'view/inspectors/performance',
                label: 'Performance Inspector',
                command: 'std.workbench.focusPerformanceInspector',
              },
            ],
          },
          {
            type: 'menu',
            id: 'view/debug-console',
            label: 'Debug Console',
            submenu: [],
          },
          { type: 'divider' },
          {
            type: 'command',
            id: 'view/reset-appearance-and-layout',
            label: 'Reset appearance and layout ...',
            command: 'std.workbench.reset',
          },
        ],
      },
      {
        type: 'menu',
        id: 'go',
        label: 'Go',
        submenu: [
          {
            type: 'command',
            id: 'go/history-back',
            label: 'Back',
            command: 'std.editor.navigateToPreviousEditorDocumentInHistory',
          },
          {
            type: 'command',
            id: 'go/history-forward',
            label: 'Forward',
            command: 'std.editor.navigateToNextEditorDocumentInHistory',
          },
          { type: 'divider' },
          {
            type: 'command',
            id: 'go/editor-next',
            label: 'Next Editor',
            command: 'std.editor.focusNextDocument',
          },
          {
            type: 'command',
            id: 'go/editor-previous',
            label: 'Previous Editor',
            command: 'std.editor.focusPrevDocument',
          },
          { type: 'divider' },
          {
            type: 'command',
            id: 'go/cursor-follows-tabs',
            label: 'File Explorer Cursor Follows Tabs',
            checked: bifrost.settings.get('std.explorer.cursorFollowsTabs'),
            command: 'std.explorer.toggleCursorFollowsTabs',
          },
          { type: 'divider' },
          {
            type: 'command',
            id: 'go/goto-file-in-workspace',
            label: 'Go to File in Workspace ...',
            command: 'std.quickJump.show',
          },
          {
            type: 'command',
            id: 'go/goto-symbol-in-workspace',
            label: 'Go to Symbol in Workspace ...',
            command: 'std.workbench.showSymbolsForWorkspace',
          },
          {
            type: 'command',
            id: 'go/goto-symbol-in-editor-document',
            label: 'Go to Symbol in Editor ...',
            command: 'std.workbench.showSymbolsForFocusedEditorDocument',
          },
        ],
      },
      ...windowMenuAsArray,
      {
        type: 'menu',
        id: 'help',
        label: 'Help',
        submenu: [
          {
            type: 'command',
            label: 'Welcome',
            id: 'help/welcome',
            command: 'std.startpage.open',
          },
          {
            type: 'command',
            label: `About ${bifrost.env.productNameWithReleaseChannel}`,
            id: 'help/about-page',
            command: 'std.aboutpage.open',
          },
          { type: 'divider' },
          {
            type: 'menu',
            id: 'help/developer-support',
            label: 'Developer Support',
            submenu: [
              {
                type: 'command',
                command: 'std.window.reload',
                label: 'Reload',
                id: 'help/developer-support/reload',
              },
              { type: 'role', role: 'toggledevtools', id: 'help/developer-support/toggle-dev-tools' },
            ],
          },
        ],
      },
    ];

    return appMenu;
  });
}

const PANE_FOCUS_COMMANDS: Record<string, string> = {
  'pane/left/explorer': 'std.workbench.focusExplorer',
  'pane/left/search': 'std.workbench.focusSearch',
};

function registerLeftMenuBarOverflowMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu('std/menubar/left-overflow', (): Menu => {
    const leftItems = bifrost.menuBar.getViewData().items.left;
    const items: MenuItem[] = [];

    for (const item of leftItems) {
      if (item.visible === false) {
        continue;
      }

      if (item.type === 'pane_content_toggle') {
        const focusCommand = PANE_FOCUS_COMMANDS[item.paneId];

        items.push({
          type: 'command',
          label: item.tooltip,
          icon: item.icon,
          id: `std/menubar/left-overflow/${item.id}`,
          checked: bifrost.panes.isPaneGroupVisibleByPaneId(item.paneId),
          command: focusCommand ?? 'std.workbench.toggleLeftPaneAreaItem',
          commandArgs: focusCommand != null ? undefined : [item.paneId],
        });
      } else if (item.type === 'button') {
        items.push({
          type: 'command',
          label: item.tooltip,
          icon: item.icon,
          id: `std/menubar/left-overflow/${item.id}`,
          command: item.command,
          commandArgs: item.commandArgs,
        });
      }
    }

    return items;
  });
}

function registerFileExplorerMenus(bifrost: Bifrost): void {
  bifrost.menus.registerMenu('std/file-explorer/solution', (metadata: any): Menu => {
    const uri = metadata.uri;
    assertNotNull(uri, 'uri');

    return [
      {
        type: 'command',
        label: 'Add Directory to Solution ...',
        id: 'std/file-explorer/solution/add-directory',
        command: 'std.solution.addDirectory',
      },
      {
        type: 'command',
        label: 'Add Folder to Solution ...',
        id: 'std/file-explorer/solution/add-folder',
        command: 'std.solution.addFolder',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Reveal Solution in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/file-explorer/solution/reveal-solution-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Open in Terminal`,
        id: 'std/file-explorer/solution/open-in-terminal',
        command: 'std.shell.openTerminalInDirectory',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Show Hidden Files`,
        id: 'std/file-explorer/solution/show-hidden-files',
        checked: !!bifrost.solution.getSolution()?.showHiddenFiles,
        command: 'std.solution.toggleHiddenFiles',
      },
    ];
  });

  bifrost.menus.registerMenu('std/file-explorer/project', (metadata: any): Menu => {
    const uri = metadata.uri;
    assertNotNull(uri, 'uri');

    return [
      {
        type: 'command',
        label: 'New File ...',
        id: 'std/file-explorer/project/new-file',
        command: 'std.solution.newFile',
      },
      {
        type: 'command',
        label: 'New Directory ...',
        id: 'std/file-explorer/project/new-directory',
        command: 'std.solution.addDirectory',
      },
      {
        type: 'command',
        label: 'Add Folder to Solution ...',
        id: 'std/file-explorer/project/add-folder',
        command: 'std.solution.addFolder',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Reveal Project in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/file-explorer/project/reveal-project-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Open in Terminal`,
        id: 'std/file-explorer/project/open-in-terminal',
        command: 'std.shell.openTerminalInDirectory',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Rename Project`,
        id: 'std/file-explorer/project/rename-project',
        command: 'std.internal.empty',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Delete Project`,
        id: 'std/file-explorer/project/delete-project',
        command: 'std.internal.empty',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Show Hidden Files`,
        id: 'std/file-explorer/project/show-hidden-files',
        checked: !!bifrost.solution.getSolution()?.showHiddenFiles,
        command: 'std.solution.toggleHiddenFiles',
      },
    ];
  });

  bifrost.menus.registerMenu('std/file-explorer/solution-root', (metadata: any): Menu => {
    const uri = metadata.uri;
    assertNotNull(uri, 'uri');

    const solution = bifrost.solution.getSolution();
    const project = solution?.projects.find((project) => project.baseUri === uri);

    return [
      {
        type: 'command',
        label: 'New File ...',
        id: 'std/file-explorer/solution-root/new-file',
        command: 'std.solution.newFile',
      },
      {
        type: 'command',
        label: 'New Directory ...',
        id: 'std/file-explorer/solution-root/new-directory',
        command: 'std.solution.addDirectory',
      },
      {
        type: 'command',
        label: 'Add Folder to Solution ...',
        id: 'std/file-explorer/solution-root/add-folder',
        command: 'std.solution.addFolder',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Reveal in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/file-explorer/solution-root/reveal-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Open in Terminal`,
        id: 'std/file-explorer/solution-root/open-in-terminal',
        command: 'std.shell.openTerminalInDirectory',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Rename`,
        id: 'std/file-explorer/solution-root/rename',
        command: 'std.solution.renameProjectLabel',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Remove Folder from Solution`,
        id: 'std/file-explorer/solution-root/remove-folder',
        command: 'std.solution.removeFolder',
        commandArgs: [project?.id],
        visible: solution != null && solution.projects.length > 1,
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Show Hidden Files`,
        id: 'std/file-explorer/solution-root/show-hidden-files',
        checked: !!solution?.showHiddenFiles,
        command: 'std.solution.toggleHiddenFiles',
      },
    ];
  });

  bifrost.menus.registerMenu('std/file-explorer/directory', (metadata: any): Menu => {
    const uri = metadata.uri;
    assertNotNull(uri, 'uri');

    return [
      {
        type: 'command',
        label: 'New File ...',
        id: 'std/file-explorer/directory/new-file',
        command: 'std.solution.newFile',
      },
      {
        type: 'command',
        label: 'New Directory ...',
        id: 'std/file-explorer/directory/new-directory',
        command: 'std.solution.addDirectory',
      },
      {
        type: 'command',
        label: 'Add Folder to Solution ...',
        id: 'std/file-explorer/directory/add-folder',
        command: 'std.solution.addFolder',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Reveal Directory in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/file-explorer/directory/reveal-directory-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Open in Terminal`,
        id: 'std/file-explorer/directory/open-in-terminal',
        command: 'std.shell.openTerminalInDirectory',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Rename`,
        id: 'std/file-explorer/directory/rename',
        command: 'std.solution.renameFileOrDirectory',
      },
      {
        type: 'command',
        label: `Delete`,
        id: 'std/file-explorer/directory/delete',
        command: 'std.solution.deleteSelectedElementsInFileExplorer',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Hide Directory by Name`,
        id: 'std/file-explorer/directory/hide-by-name',
        command: 'std.fileExplorer.hideDirByName',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Hide Directory by Path`,
        id: 'std/file-explorer/directory/hide-by-path',
        command: 'std.fileExplorer.hideDirByPath',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Show Hidden Files`,
        id: 'std/file-explorer/directory/show-hidden-files',
        checked: !!bifrost.solution.getSolution()?.showHiddenFiles,
        command: 'std.solution.toggleHiddenFiles',
      },
    ];
  });

  bifrost.menus.registerMenu('std/file-explorer/file', (metadata: any): Menu => {
    const uri = metadata.uri;
    assertNotNull(uri, 'uri');

    return [
      {
        type: 'command',
        label: `Open to the Side`,
        id: 'std/file-explorer/file/open-to-the-side',
        command: 'std.editor.openDocumentToTheSide',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Reveal File in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/file-explorer/file/reveal-file-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: `Open in Text Editor`,
        id: 'std/file-explorer/file/open-in-text-editor',
        command: 'std.shell.openDocumentInTextEditor',
        commandArgs: [uri],
      },
      {
        type: 'divider',
        id: 'std/file-explorer/file/divider-before-new-file-commands',
      },
      {
        type: 'command',
        label: 'New File ...',
        id: 'std/file-explorer/file/new-file',
        command: 'std.solution.newFile',
      },
      {
        type: 'command',
        label: 'New Directory ...',
        id: 'std/file-explorer/file/new-directory',
        command: 'std.solution.addDirectory',
      },
      {
        type: 'command',
        label: 'Add Folder to Solution ...',
        id: 'std/file-explorer/file/add-folder',
        command: 'std.solution.addFolder',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Compare to ...',
        id: 'std/file-explorer/file/compare-to/external-file',
        command: 'std.solution.compareTo',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Copy File Name',
        id: 'std/editor/editor-tab/copy-file-name',
        command: 'std.editor.copyEditorDocumentFileName',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: 'Copy File Path',
        id: 'std/editor/editor-tab/copy-file-path',
        command: 'std.editor.copyEditorDocumentFilePath',
        commandArgs: [uri],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Duplicate`,
        id: 'std/file-explorer/file/duplicate',
        command: 'std.solution.duplicateFile',
      },
      {
        type: 'command',
        label: `Rename`,
        id: 'std/file-explorer/file/rename',
        command: 'std.solution.renameFileOrDirectory',
      },
      {
        type: 'command',
        label: `Delete`,
        id: 'std/file-explorer/file/delete',
        command: 'std.solution.deleteSelectedElementsInFileExplorer',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: `Show Hidden Files`,
        id: 'std/file-explorer/file/show-hidden-files',
        checked: !!bifrost.solution.getSolution()?.showHiddenFiles,
        command: 'std.solution.toggleHiddenFiles',
      },
    ];
  });

  bifrost.menus.registerMenu(
    'std/file-explorer/multi-selection',
    (selectedMetadata: any[], clickedMetadata: any, studio: Bifrost): Menu => {
      const uris: string[] = selectedMetadata
        .filter((meta: any) => meta?.type === 'file' || meta?.type === 'directory')
        .map((meta: any) => meta?.uri)
        .filter((uri: string | undefined): uri is string => uri != null);

      const fileUris: string[] = selectedMetadata
        .filter((meta: any) => meta?.type === 'file')
        .map((meta: any) => meta?.uri)
        .filter((uri: string | undefined): uri is string => uri != null);

      return [
        {
          type: 'command',
          label: 'Open to the Side',
          id: 'std/file-explorer/multi-selection/open-to-the-side',
          command: 'std.editor.openMultipleDocumentsToTheSide',
          commandArgs: [fileUris],
          visible: fileUris.length > 0,
        },
        {
          type: 'divider',
          visible: fileUris.length > 0,
        },
        {
          type: 'command',
          label: `Copy ${uris.length} File Names`,
          id: 'std/file-explorer/multi-selection/copy-file-names',
          command: 'std.fileExplorer.copyMultipleFileNames',
          commandArgs: [uris],
        },
        {
          type: 'command',
          label: `Copy ${uris.length} File Paths`,
          id: 'std/file-explorer/multi-selection/copy-file-paths',
          command: 'std.fileExplorer.copyMultipleFilePaths',
          commandArgs: [uris],
        },
        {
          type: 'divider',
        },
        {
          type: 'command',
          label: `Reveal in ${studio.env.isMac ? 'Finder' : 'Explorer'}`,
          id: 'std/file-explorer/multi-selection/reveal-in-file-manager',
          command: 'std.shell.revealUniqueContainingFolders',
          commandArgs: [uris],
        },
        {
          type: 'divider',
        },
        {
          type: 'command',
          label: `Delete ${uris.length} Items`,
          id: 'std/file-explorer/multi-selection/delete',
          command: 'std.solution.deleteSelectedElementsInFileExplorer',
        },
        {
          type: 'divider',
        },
        {
          type: 'command',
          label: 'Show Hidden Files',
          id: 'std/file-explorer/multi-selection/show-hidden-files',
          checked: !!studio.solution.getSolution()?.showHiddenFiles,
          command: 'std.solution.toggleHiddenFiles',
        },
      ];
    },
  );
}

function registerEditorMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu('std/editor/editor-tab', (editorDocument: EditorDocument, bifrost: Bifrost): Menu => {
    return [
      {
        type: 'command',
        label: 'Close',
        id: 'std/editor/editor-tab/close-editor-document',
        command: 'std.editor.closeEditorDocument',
        commandArgs: [editorDocument],
      },
      {
        type: 'command',
        label: 'Close Others',
        id: 'std/editor/editor-tab/close-other-editor-documents',
        command: 'std.editor.closeOtherEditorDocuments',
        commandArgs: [editorDocument],
      },
      {
        type: 'command',
        label: 'Close Saved',
        id: 'std/editor/editor-tab/close-saved-editor-documents',
        command: 'std.editor.closeSavedEditorDocuments',
        commandArgs: [editorDocument],
      },
      {
        type: 'command',
        label: 'Close All',
        id: 'std/editor/editor-tab/close-all-editor-documents',
        command: 'std.editor.closeAllEditorDocuments',
        commandArgs: [editorDocument],
      },
      {
        type: 'divider',
        id: 'std/editor/editor-tab/divider-before-copy-file-uri-commands',
      },
      {
        type: 'command',
        label: 'Copy File Name',
        id: 'std/editor/editor-tab/copy-file-name',
        command: 'std.editor.copyEditorDocumentFileName',
        commandArgs: [editorDocument?.uri],
      },
      {
        type: 'command',
        label: 'Copy File Path',
        id: 'std/editor/editor-tab/copy-file-path',
        command: 'std.editor.copyEditorDocumentFilePath',
        commandArgs: [editorDocument?.uri],
      },
      {
        type: 'divider',
        id: 'std/editor/editor-tab/divider-before-file-manager-commands',
      },
      {
        type: 'command',
        label: `Reveal File in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
        id: 'std/editor/editor-tab/show-document-in-file-manager',
        command: 'std.shell.showDocumentInFileManager',
        commandArgs: [editorDocument],
      },
      {
        type: 'command',
        label: `Open in Text Editor`,
        id: 'std/editor/editor-tab/open-in-text-editor',
        command: 'std.shell.openDocumentInTextEditor',
        commandArgs: [editorDocument],
      },
      {
        type: 'divider',
        id: 'std/editor/editor-tab/divider-before-split-commands',
      },
      {
        type: 'command',
        label: 'Split to the Right',
        id: 'std/editor/editor-tab/split-to-the-right',
        command: 'std.editor.splitToTheRight',
        commandArgs: [editorDocument],
      },
      {
        type: 'command',
        label: 'Split to the Bottom',
        id: 'std/editor/editor-tab/split-to-the-bottom',
        command: 'std.editor.splitToTheBottom',
        commandArgs: [editorDocument],
      },
    ];
  });
}

function registerEditorTabListControlsMoreMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu('std/editor/editor-tab-list-controls/more', (editorDocuments: EditorDocument[]): Menu => {
    return [
      {
        type: 'command',
        label: 'Search Tab',
        id: 'std/editor/editor-tab-list-controls/more/search-tab',
        command: 'std.quickJump.show',
      },
      {
        type: 'command',
        label: 'Save all Tabs',
        id: 'std/editor/editor-tab-list-controls/more/save-all',
        command: 'std.editor.saveAllEditorDocumentsInTabGroup',
        commandArgs: [editorDocuments],
      },
      {
        type: 'command',
        label: 'Close all Tabs',
        id: 'std/editor/editor-tab-list-controls/more/close-all',
        command: 'std.editor.closeAllEditorDocumentsInTabGroup',
        commandArgs: [editorDocuments],
      },
    ];
  });
}

function registerMockMenu(bifrost: Bifrost): void {
  bifrost.menus.registerMenu(
    'mock/pane-heading-options',
    (_bifrost: Bifrost, paneId: string, paneIsCollapsed?: boolean): Menu => {
      return [
        {
          type: 'command',
          label: paneIsCollapsed === false ? 'Collapse' : 'Expand',
          id: 'mock/pane-heading-options/set-pane-collapsed',
          command: 'std.workbench.setPaneCollapsed',
          commandArgs: [paneId, !paneIsCollapsed],
        },
        {
          type: 'divider',
        },
        {
          type: 'command',
          label: 'Close All Panes',
          id: 'mock/pane-heading-options/close-all-panes',
          command: 'std.internal.empty',
        },
        {
          type: 'command',
          label: 'Expand All Panes',
          id: 'mock/pane-heading-options/expand-all-panes',
          command: 'std.internal.empty',
        },
      ];
    },
  );

  bifrost.menus.registerMenu('mock/machine-sanctum', (...args): Menu => {
    return [
      {
        type: 'command',
        label: `Args: ${JSON.stringify(args)}`,
        id: 'mock/machine-sanctum/save',
        command: 'std.editor.saveFocusedDocument',
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Choose Theme',
        id: 'mock/machine-sanctum/choose-theme',
        icon: 'ph-duotone ph-swatches',
        command: 'std.workbench.chooseTheme',
      },
      {
        type: 'command',
        label: 'Quick Jump',
        id: 'mock/machine-sanctum/quick-jump',
        command: 'std.quickJump.showCommands',
      },
      {
        type: 'menu',
        label: 'More tools',
        id: 'mock/machine-sanctum/more-tools',
        submenu: [
          {
            type: 'command',
            label: 'Toggle Property Panel',
            id: 'mock/machine-sanctum/more-tools/toggle-property-panel',
            icon: 'ph ph-split-vertical',
            command: 'std.workbench.togglePropertyPanel',
          },
          {
            type: 'command',
            label: 'Toggle Inspector Panel',
            id: 'mock/machine-sanctum/more-tools/toggle-inspector-panel',
            icon: 'ph ph-split-horizontal',
            command: 'std.workbench.toggleInspectorPanel',
          },
          {
            type: 'command',
            label: 'Toggle Sidebar',
            id: 'mock/machine-sanctum/more-tools/toggle-sidebar',
            icon: 'ph ph-split-vertical ph-flip-h',
            command: 'std.workbench.toggleSidebar',
          },
          {
            type: 'divider',
          },
          {
            type: 'command',
            label: 'Hide Bars & Panels',
            id: 'mock/machine-sanctum/more-tools/hide-bars-and-panels',
            command: 'std.workbench.hideBarsAndPanels',
          },
          {
            type: 'command',
            label: 'Show Bars & Panels',
            id: 'mock/machine-sanctum/more-tools/show-bars-and-panels',
            command: 'std.workbench.showBarsAndPanels',
          },
          {
            type: 'divider',
          },
          {
            type: 'command',
            label: 'Choose Theme',
            id: 'mock/machine-sanctum/more-tools/choose-theme',
            command: 'std.workbench.chooseTheme',
          },
          {
            type: 'command',
            label: 'Quick Jump',
            id: 'mock/machine-sanctum/more-tools/quick-jump',
            command: 'std.quickJump.showCommands',
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Close All Panes',
        id: 'mock/machine-sanctum/close-all-panes',
        command: 'std.internal.empty',
      },
      {
        type: 'command',
        label: 'Expand All Panes',
        id: 'mock/machine-sanctum/expand-all-panes',
        command: 'std.internal.empty',
      },
    ];
  });

  bifrost.menus.registerMenu('mock/machine-sanctum/treeview', (metadata: any, _bifrost: Bifrost): Menu => {
    return [
      {
        type: 'command',
        label: 'Show metadata',
        id: 'mock/machine-sanctum/treeview/show-metadata',
        command: 'std.internal.notify',
        commandArgs: [metadata],
      },
      {
        type: 'divider',
      },
      {
        type: 'command',
        label: 'Choose Theme',
        id: 'mock/machine-sanctum/treeview/choose-theme',
        command: 'std.workbench.chooseTheme',
      },
      {
        type: 'command',
        label: 'Quick Jump',
        id: 'mock/machine-sanctum/treeview/quick-jump',
        command: 'std.quickJump.showCommands',
      },
    ];
  });
}
