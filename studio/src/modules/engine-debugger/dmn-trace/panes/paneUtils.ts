import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';

import type { DmnTraceFragmentModel } from '../DmnTraceFragmentModel';
import type { DmnFlowNodeTypeProperties, DrgSelection } from '../DmnTraceTypes';

export function isDmnTraceDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.includes('engine-debug.dmn-trace:') === true;
}

export function getTraceDataFromDocument(
  editorDocumentModel: EditorDocumentModel | null | undefined,
): DmnFlowNodeTypeProperties | null {
  return (editorDocumentModel as DmnTraceFragmentModel | null)?.getTraceProperties() ?? null;
}

export function getSelectionFromDocument(
  editorDocumentModel: EditorDocumentModel | null | undefined,
): DrgSelection | null {
  return (editorDocumentModel as DmnTraceFragmentModel | null)?.getSelectedElement() ?? null;
}
