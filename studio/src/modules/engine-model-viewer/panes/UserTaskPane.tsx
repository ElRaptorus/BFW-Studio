import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'User Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':UserTask']);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }

  const businessObject = selection.businessObject;
  const assignees = getExtensionValue(businessObject, ':assignees');
  const dueDate = getExtensionValue(businessObject, ':dueDate');
  const priority = getExtensionValue(businessObject, ':priority');
  const formFields = getExtensionValue(businessObject, ':formFields');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Assignees" value={assignees ?? '—'} disabled />
      <PaneProperty type="text" label="Due Date" value={dueDate ?? '—'} disabled />
      <PaneProperty type="text" label="Priority" value={priority ?? '—'} disabled />
      {formFields != null && <PaneProperty type="textarea" label="Form Fields" value={formFields} disabled rows={4} />}
    </div>
  );
}
