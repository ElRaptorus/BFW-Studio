/** Debugger viewer settings — keys must be registered in engine-core `registerSettings.ts`. */
export const DEBUGGER_SETTINGS_KEYS = {
  autoFollow: 'engineDebugger.viewer.autoFollow',
  showDocumentationMarker: 'engineDebugger.viewer.showDocumentationMarker',
  showMultipleOutgoingSequenceFlowsMarkers: 'engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers',
  dataObjectDetailLevel: 'engineDebugger.viewer.dataObjectDetailLevel',
} as const;
