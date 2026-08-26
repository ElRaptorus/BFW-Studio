import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { DmnDefinitions, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import type { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';

export function isDecisionViewerDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-decision://') === true;
}

export function getSelection(model: EditorDocumentModel | null | undefined): DrgSelection | null {
  return (model as DecisionViewerDocumentModel | null)?.getSelectedElement() ?? null;
}

export function getParsedModel(model: EditorDocumentModel | null | undefined): DmnDefinitions | null {
  return (model as DecisionViewerDocumentModel | null)?.getParsedModel() ?? null;
}
