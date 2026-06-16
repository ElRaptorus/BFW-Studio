/** Module-specific command IDs for the engine-model-viewer module. */
export const MODEL_VIEWER_COMMANDS = {
  refresh: 'engine.modelViewer.refresh',
  fit: 'engine.modelViewer.fit',
  zoomActualSize: 'engine.modelViewer.zoomActualSize',
  exportPng: 'engine.modelViewer.exportPng',
  exportSvg: 'engine.modelViewer.exportSvg',
  downloadXml: 'engine.modelViewer.downloadXml',
  startProcessAtStartEvent: 'engine.modelViewer.startProcessAtStartEventAndOpenDebugger',
  openCallActivityTarget: 'engine.modelViewer.openCallActivityTargetProcess',
} as const;

export type ModelViewerCommandId = (typeof MODEL_VIEWER_COMMANDS)[keyof typeof MODEL_VIEWER_COMMANDS];
