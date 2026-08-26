import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { QuickJumpItem } from '#bifrost/contracts/QuickJumpTypes';
import type { SymbolQuery, SymbolResult } from '#bifrost/contracts/SymbolTypes';

export function initializeWorkbenchCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register(
    'std.workbench.showRecentlyOpened',
    async () => {
      const recentSolutions: QuickJumpItem[] = await Promise.all(
        bifrost.recentlyOpened
          .getRecentlyOpenedSolutions()
          .filter((recentItem: any) => recentItem.uri.match(/^file:/) != null)
          .map(async (recentDocItem: any, index: number) => {
            return {
              type: 'command',
              label: bifrost.files.getFilename(recentDocItem.uri),
              sublabel: await bifrost.files.getLocalDirectory(recentDocItem.uri, true),
              command: 'std.solution.openDirectory',
              commandArgs: [recentDocItem.uri],
              badges: index === 0 ? [{ type: 'text', text: 'Recent Solutions' }] : undefined,
            };
          }),
      );

      const recentEditorDocuments: QuickJumpItem[] = await Promise.all(
        bifrost.recentlyOpened.getRecentlyOpenedFiles().map(async (recentDocItem: any, index: number) => {
          return {
            type: 'command',
            label: bifrost.files.getFilename(recentDocItem.uri),
            sublabel: await bifrost.files.getLocalDirectory(recentDocItem.uri, true),
            command: 'std.editor.focusOrOpenDocument',
            commandArgs: [recentDocItem.uri],
            badges: index === 0 ? [{ type: 'text', text: 'Recent Documents' }] : undefined,
          };
        }),
      );

      bifrost.quickJump.show({
        prompt: 'Select to open ...',
        entries: [...recentSolutions, ...recentEditorDocuments],
      });
    },
    { visibleInSearch: true, enabledWhen: () => bifrost.recentlyOpened.hasRecentlyOpenedSolutionsOrFiles() },
  );

  commands.register(
    'std.workbench.showSymbolsForWorkspace',
    async () => {
      bifrost.commands.executeCommand('std.workbench.showSymbolsForWorkspaceOrEditorDocument');
    },
    {
      visibleInSearch: true,
      description: ['Workbench: Go to Symbol in Workspace ...', 'Workbench: Goto Symbol in Workspace ...'],
    },
  );

  commands.register(
    'std.workbench.showSymbolsForFocusedEditorDocument',
    async () => {
      bifrost.commands.executeCommand('std.workbench.showSymbolsForWorkspaceOrEditorDocument', [
        bifrost.editors.getFocusedEditorDocument(),
      ]);
    },
    {
      visibleInSearch: true,
      description: ['Workbench: Go to Symbol in Document ...', 'Workbench: Goto Symbol in Document ...'],
      enabledWhen: () => bifrost.editors.getFocusedEditorDocument() != null,
    },
  );

  commands.register(
    'std.workbench.showSymbolsForWorkspaceOrEditorDocument',
    async (editorDocument?: EditorDocument) => {
      const showingSymbolsForSolution = editorDocument == null;

      const symbolQuery: SymbolQuery = {};
      if (editorDocument != null) {
        symbolQuery.uris = [editorDocument.uri];
      }

      const symbols = await bifrost.symbolIndex.getAll(symbolQuery);
      const relevantSymbols = symbols.filter((symbol) => symbol.name != null && symbol.metadata?.isSelectable);

      const symbolQuickJumpItems: QuickJumpItem[] = relevantSymbols.map((symbol: SymbolResult): QuickJumpItem => {
        const type = symbol.type?.replace('bpmn:', '');

        let sublabel = [symbol.id, type].join(' • ');
        if (showingSymbolsForSolution) {
          sublabel = [symbol.id, type, symbol.processId, bifrost.files.getFilename(symbol.uri)]
            .filter((str) => str != null)
            .join(' • ');
        }

        return {
          type: 'command',
          label: symbol.name || symbol.id,
          sublabel: sublabel,
          command: 'std.editor.gotoSymbolInDocument',
          commandArgs: [symbol.uri, symbol.id],
        };
      });

      bifrost.quickJump.show({
        prompt: 'Jump to any symbol by typing ...',
        entries: symbolQuickJumpItems,
      });
    },
  );

  commands.register(
    'std.workbench.toggleLeftPaneAreaItem',
    (paneId: string) => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId(paneId, true);
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.focusExplorer',
    () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/left/explorer', true);
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.focusSearch',
    () => {
      const isAlreadyActive = bifrost.panes.isPaneGroupVisibleByPaneId('pane/left/search');
      const isAlreadyFocused =
        document.activeElement != null && document.activeElement.classList.contains('global-search-pane-phrase-input');

      if (isAlreadyActive && !isAlreadyFocused) {
        bifrost.searchView.focusAndSelect();
      } else {
        bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/left/search', true);
      }
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleNotifications',
    () => {
      bifrost.notifications.toggle();
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleEditorDocumentInspector',
    () => {
      bifrost.panes.togglePaneAreaByPaneId('inspectors/editor_document_inspector');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.focusEditorDocumentInspector',
    () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.focusNotificationInspector',
    () => {
      bifrost.panes.togglePaneAreaByPaneId('inspectors/notification_inspector');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.focusPerformanceInspector',
    () => {
      bifrost.panes.togglePaneAreaByPaneId('inspectors/performance_inspector');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleSidebar',
    () => {
      const leftPaneVisible = bifrost.panes.getPaneAreaVisibility('left');
      if (leftPaneVisible) {
        bifrost.panes.hidePaneArea('left');
      } else {
        bifrost.panes.selectLastActivePaneInArea('left');
      }
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleMenuBar',
    () => {
      bifrost.menuBar.toggleVisibility();
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleStatusBar',
    () => {
      bifrost.statusBar.toggleVisibility();
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.hideBarsAndPanels',
    () => {
      bifrost.menuBar.hide();
      bifrost.statusBar.hide();
      commands.executeCommand('std.workbench.hidePanels');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.hidePanels',
    () => {
      bifrost.panes.hidePaneArea('left');
      bifrost.panes.hidePaneArea('right');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.showBarsAndPanels',
    () => {
      bifrost.menuBar.show();
      bifrost.statusBar.show();
      commands.executeCommand('std.workbench.showPanels');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.showPanels',
    () => {
      bifrost.panes.showPaneArea('right');
      bifrost.panes.selectLastActivePaneInArea('left');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleBarsAndPanels',
    () => {
      const visible = [bifrost.panes.getPaneAreaVisibility('right'), bifrost.panes.getPaneAreaVisibility('left')].some(
        (x) => x,
      );

      const command = visible ? 'std.workbench.hideBarsAndPanels' : 'std.workbench.showBarsAndPanels';
      commands.executeCommand(command);
    },
    { visibleInSearch: true },
  );

  const isInFocusMode = (): boolean => {
    const anyPaneOrBarVisible = [
      bifrost.panes.getPaneAreaVisibility('right'),
      bifrost.panes.getPaneAreaVisibility('left'),
    ].some((x) => x);

    return !anyPaneOrBarVisible;
  };

  commands.register('std.workbench.isInFocusMode', () => isInFocusMode());

  commands.register(
    'std.workbench.toggleFocusMode',
    () => {
      // Toogle means "if there is any panel or bar, hide everything, otherwise show"
      const inFocusMode = isInFocusMode();

      if (inFocusMode) {
        bifrost.commands.executeCommand('std.workbench.showBarsAndPanels');
        bifrost.commands.executeCommand('std.workbench.showEditorTabs');
      } else {
        bifrost.commands.executeCommand('std.workbench.hideBarsAndPanels');
        bifrost.commands.executeCommand('std.workbench.hideEditorTabs');
      }
    },
    { visibleInSearch: true, description: ['Workbench: Toggle focus mode', 'zen mode'] },
  );

  commands.register(
    'std.workbench.togglePanels',
    () => {
      // Toogle means "if there is any panel, hide all of them, otherwise show"
      const visible = [bifrost.panes.getPaneAreaVisibility('right'), bifrost.panes.getPaneAreaVisibility('left')].some(
        (x) => x,
      );

      const command = visible ? 'std.workbench.hidePanels' : 'std.workbench.showPanels';
      commands.executeCommand(command);
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.toggleInspectorPanel',
    () => {
      bifrost.panes.togglePaneArea('bottom');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.togglePropertyPanel',
    () => {
      bifrost.panes.togglePaneArea('right');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.showPropertyPanel',
    () => {
      bifrost.panes.showPaneArea('right');
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.hidePropertyPanel',
    () => {
      bifrost.panes.hidePaneArea('right');
    },
    { visibleInSearch: true },
  );

  commands.register('std.workbench.setPaneCollapsed', (paneId: string, collapsed: boolean) => {
    bifrost.panes.setPaneCollapsed(paneId, collapsed);
  });

  //#endregion Bars & Panels

  commands.register(
    'std.workbench.showEditorTabs',
    () => {
      bifrost.editors.setEditorTabsVisibility(true);
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.workbench.hideEditorTabs',
    () => {
      bifrost.editors.setEditorTabsVisibility(false);
    },
    { visibleInSearch: true },
  );

  commands.register('std.workbench.toggleTemporaryTabs', () => {
    const currentValue = bifrost.settings.get('workbench.editor.temporaryTabs');
    bifrost.settings.set('workbench.editor.temporaryTabs', !currentValue);
  });

  commands.register(
    'std.workbench.enableTemporaryTabs',
    () => bifrost.settings.set('workbench.editor.temporaryTabs', true),
    {
      visibleInSearch: true,
      description: 'Workbench: Enable Temporary Tabs',
      enabledWhen: () => bifrost.settings.get('workbench.editor.temporaryTabs') !== true,
    },
  );

  commands.register(
    'std.workbench.disableTemporaryTabs',
    () => bifrost.settings.set('workbench.editor.temporaryTabs', false),
    {
      visibleInSearch: true,
      description: 'Workbench: Disable Temporary Tabs',
      enabledWhen: () => bifrost.settings.get('workbench.editor.temporaryTabs') === true,
    },
  );

  commands.register('std.workbench.setTheme', (themeId: string) => {
    bifrost.theme.setTheme(themeId);
  });

  commands.register('std.workbench.registerTheme', (id: string, label: string, type?: 'light' | 'dark') => {
    bifrost.theme.registerTheme({
      id,
      label: label ?? id,
      type: type ?? 'dark',
    });
  });

  commands.register(
    'std.workbench.chooseTheme',
    () => {
      const themes = bifrost.theme.getRegisteredThemes();
      const entries = themes.map((theme) => ({
        type: 'command' as const,
        label: theme.label,
        icon: theme.type === 'dark' ? 'ph ph-moon' : 'ph ph-sun',
        command: 'std.workbench.setTheme',
        commandArgs: [theme.id],
      }));

      bifrost.quickJump.show({
        prompt: 'Select color theme ...',
        entries,
      });
    },
    { visibleInSearch: true, description: 'Workbench: Choose theme ...' },
  );

  commands.register(
    'std.workbench.reset',
    async () => {
      const dialogOptions: DialogOptions = {
        title: 'Reset appearance and layout',
        content: 'Do you want to proceed?',
        actions: [
          {
            label: 'cancel',
            response: 'cancel',
            cancel: true,
          },
          {
            label: 'Reset',
            response: 'reset',
            default: true,
          },
        ],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      if (dialogResult.response === 'reset') {
        bifrost.editors.reset();
        bifrost.panes.reset();
      }
    },
    { visibleInSearch: true, description: 'Workbench: Reset appearance and layout ...' },
  );
}
