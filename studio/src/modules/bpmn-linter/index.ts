import type { Bifrost } from '#bifrost/Bifrost';

import { LintBridge } from './LintBridge';
import { LinterPaletteProvider } from './LinterPaletteProvider';
import { initializeCommands } from './initializers/initializeCommands';
import { initializeMenuBarItems } from './initializers/initializeMenuBarItems';
import { initializeMenus } from './initializers/initializeMenus';
import { initializePanes, linterCounts } from './initializers/initializePanes';
import { initializeSettings } from './initializers/initializeSettings';
import './styles/bpmn-linter.scss';

export function onLoad(bifrost: Bifrost): void {
  bifrost.helpTexts.registerHelpText('bpmn-linter/linter-score', require('./texts/linter-score.md'));

  initializeSettings(bifrost);
  initializeCommands(bifrost);
  initializeMenus(bifrost);
  initializePanes(bifrost);
  initializeMenuBarItems(bifrost);

  bifrost.icons.registerIcons({
    'bpmn-linter/severity/error': 'ph-fill ph-x-circle',
    'bpmn-linter/severity/warning': 'ph-fill ph-warning',
    'bpmn-linter/severity/info': 'ph-fill ph-info',
    'bpmn-linter/badge/check': 'ph ph-check-circle',
    'bpmn-linter/badge/error': 'ph ph-x-circle',
    'bpmn-linter/badge/warning': 'ph ph-warning',
    'bpmn-linter/badge/info': 'ph ph-info',
  });

  const diagnosticsAccessor = {
    setDiagnostics: (
      uri: string,
      owner: string,
      diagnostics: { severity: 'error' | 'warning' | 'info'; message: string; source: string }[],
    ) => bifrost.diagnostics.setDiagnostics(uri, owner, diagnostics),
    clearDiagnostics: (owner: string) => bifrost.diagnostics.clearDiagnostics(owner),
  };

  const editorsAccessor = {
    getFocusedEditorDocument: (): { uri: string } | null => bifrost.editors.getFocusedEditorDocument(),
  };

  const paneLayoutAccessor = {
    requestUpdate: () => bifrost.panes.requestPaneLayoutUpdate(),
    updateCounts: (counts: { errors: number; warnings: number; infos: number }) => {
      linterCounts.errors = counts.errors;
      linterCounts.warnings = counts.warnings;
      linterCounts.infos = counts.infos;
    },
    showProblemsPane: () => bifrost.commands.executeCommand('bpmn.linter.showProblemsPane'),
  };

  bifrost.commands.executeCommand('bpmn.modeler.registerModule', [
    {
      __init__: ['lintBridge', 'linterPaletteProvider'],
      lintBridge: ['type', LintBridge],
      linterPaletteProvider: ['type', LinterPaletteProvider],
      lintBridgeDiagnostics: ['value', diagnosticsAccessor],
      lintBridgeEditors: ['value', editorsAccessor],
      lintBridgePaneLayout: ['value', paneLayoutAccessor],
    },
  ]);
}
