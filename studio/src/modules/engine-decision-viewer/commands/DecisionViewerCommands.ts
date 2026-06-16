/** Module-specific command IDs for the engine-decision-viewer module. */
export const DECISION_VIEWER_COMMANDS = {
  open: 'engine.decisionViewer.open',
  refresh: 'engine.decisionViewer.refresh',
  downloadXml: 'engine.decisionViewer.downloadXml',
  exportPng: 'engine.decisionViewer.exportPng',
  exportSvg: 'engine.decisionViewer.exportSvg',
  toggleEvaluation: 'engine.decisionViewer.toggleEvaluation',
  evaluate: 'engine.decisionViewer.evaluate',
  openImportedModel: 'engine.decisionViewer.openImportedModel',
  switchVersion: 'engine.decisionViewer.switchVersion',
} as const;

export type DecisionViewerCommandId = (typeof DECISION_VIEWER_COMMANDS)[keyof typeof DECISION_VIEWER_COMMANDS];
