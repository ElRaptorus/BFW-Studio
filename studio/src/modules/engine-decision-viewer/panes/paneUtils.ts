import type { EditorDocument, EditorDocumentModel } from '@evil/bifrost_fw_sdk';

import type { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';
import type { DmnDefinitions, DrgSelection } from '../types/dmnModelTypes';

export function isDecisionViewerDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-decision://') === true;
}

export function getSelection(model: EditorDocumentModel | null | undefined): DrgSelection | null {
  return (model as DecisionViewerDocumentModel | null)?.getSelectedElement() ?? null;
}

export function getParsedModel(model: EditorDocumentModel | null | undefined): DmnDefinitions | null {
  return (model as DecisionViewerDocumentModel | null)?.getParsedModel() ?? null;
}
