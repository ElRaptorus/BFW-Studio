import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';

import type { DmnViewType } from '../../dmn-core/DmnModelerComponentAdapter';
import type DmnDocumentModel from '../DmnDocumentModel';
import { type DmnElement, DmnElementType } from '../DmnElementTypes';
import { DMN_DOCUMENT_TYPE } from '../index';

const DRD_CONNECTION_TYPES: Set<string> = new Set([
  DmnElementType.InformationRequirement,
  DmnElementType.KnowledgeRequirement,
  DmnElementType.AuthorityRequirement,
  DmnElementType.Association,
]);

export function isDmnDocument(editorDocument: EditorDocument): boolean {
  return editorDocument?.documentType === DMN_DOCUMENT_TYPE;
}

export function getDmnModel(editorDocumentModel: EditorDocumentModel): DmnDocumentModel | null {
  return (editorDocumentModel as DmnDocumentModel) ?? null;
}

export function shouldBeDisplayedForDmnDrdView(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  if (!isDmnDocument(editorDocument)) {
    return false;
  }

  const model = getDmnModel(editorDocumentModel);
  if (!model) {
    return false;
  }

  return model.getActiveViewType() === 'drd';
}

export function shouldBeDisplayedForDmnViewType(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  viewType: DmnViewType,
): boolean {
  if (!isDmnDocument(editorDocument)) {
    return false;
  }

  const model = getDmnModel(editorDocumentModel);
  if (!model) {
    return false;
  }

  return model.getActiveViewType() === viewType;
}

export function shouldBeDisplayedForDmnDrdElementOfType(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  selectionType: string,
): boolean {
  if (!shouldBeDisplayedForDmnDrdView(editorDocument, editorDocumentModel)) {
    return false;
  }

  const model = getDmnModel(editorDocumentModel);
  const selectedElements = model?.selection?.getElements();

  return selectedElements?.length === 1 && selectedElements[0]?.type === selectionType;
}

export function shouldBeDisplayedForDmnDrdNoSelection(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  if (!shouldBeDisplayedForDmnDrdView(editorDocument, editorDocumentModel)) {
    return false;
  }

  const model = getDmnModel(editorDocumentModel);
  const selectedElements = model?.selection?.getElements();

  if (selectedElements == null || selectedElements.length === 0) {
    return true;
  }

  if (selectedElements.length === 1 && DRD_CONNECTION_TYPES.has(selectedElements[0]?.type)) {
    return true;
  }

  return false;
}

export function getDmnSelectionForPropertiesPane(props: PaneComponentProps): DmnElement[] | null {
  const editorDocument = props.editorDocument;
  const dmnDocumentModel = props.editorDocumentModel as DmnDocumentModel;

  if (
    editorDocument == null ||
    editorDocument.modelKey !== 'DmnDocumentModel' ||
    dmnDocumentModel == null ||
    !dmnDocumentModel.isReadyForInteraction()
  ) {
    return null;
  }

  const selection = dmnDocumentModel.selection.getElements();
  if (selection.length === 0) {
    return null;
  }

  return selection;
}

export function getKeyForDmnPropertiesPane(selection: DmnElement[]): string {
  const selectedElement = selection[0];
  if (!selectedElement) {
    return 'empty';
  }

  // type + id only. Including `name` remounts the pane when the Name field
  // commits (that field is the value being edited) and re-initializes
  // uncontrolled controls (selects, documentation editor).
  return `${selectedElement.type}__${selectedElement.id}`;
}

export function getActiveViewElementKey(model: DmnDocumentModel): string {
  const view = model.modelerAdapter.getActiveView();
  if (!view) {
    return 'no-view';
  }
  // type + id only. `view.name` is the DRG element name; renaming the
  // decision remounts expression-view panes (Hit Policy select, FEEL editor).
  return `${view.type}__${view.id}`;
}
