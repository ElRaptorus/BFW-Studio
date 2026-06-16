import type { Bifrost } from '#bifrost/Bifrost';

import EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import EngineBpmnDebuggerRenderer from '../EngineBpmnDebuggerRenderer';
import { EngineBpmnDebuggerDocumentInspector } from '../inspector/DebuggerInspectorPane';

/** Document type registration is centralized in index.ts per Wave 2 pattern. */
export default function initializeDocumentTypes(_bifrost: Bifrost): void {
  // Document types registered in index.ts onLoad
}

export { EngineBpmnDebuggerEditorDocumentModel, EngineBpmnDebuggerRenderer, EngineBpmnDebuggerDocumentInspector };
