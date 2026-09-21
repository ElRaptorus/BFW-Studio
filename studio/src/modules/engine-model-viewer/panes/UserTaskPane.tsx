import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import { getSelection, isModelViewerDocument, matchesType, readFlowNodeString } from './paneHelpers';

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
  const assignees = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'user_task' ? flowNode.typeData.assigneesExpression : undefined,
  );
  const dueDate = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'user_task' ? flowNode.typeData.dueDate : undefined,
  );
  const priority = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    if (flowNode.typeData.type !== 'user_task') {
      return undefined;
    }
    return flowNode.typeData.priority != null ? String(flowNode.typeData.priority) : null;
  });
  const formFields = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    if (flowNode.typeData.type !== 'user_task') {
      return undefined;
    }
    return flowNode.typeData.formSchema != null ? JSON.stringify(flowNode.typeData.formSchema) : null;
  });

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Assignees" value={assignees ?? '—'} disabled />
      <PaneProperty type="text" label="Due Date" value={dueDate ?? '—'} disabled />
      <PaneProperty type="text" label="Priority" value={priority ?? '—'} disabled />
      {formFields != null && <PaneProperty type="textarea" label="Form Fields" value={formFields} disabled rows={4} />}
    </div>
  );
}
