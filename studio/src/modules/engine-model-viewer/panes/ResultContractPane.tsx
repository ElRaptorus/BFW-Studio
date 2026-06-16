import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, hasEventDefinition, isModelViewerDocument, matchesType } from './paneHelpers';

const RESULT_CONTRACT_TASK_TYPES = [
  ':UserTask',
  ':ServiceTask',
  ':ScriptTask',
  ':BusinessRuleTask',
  ':CallActivity',
  ':ReceiveTask',
];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Result Contract';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (!selection) {
    return false;
  }
  return (
    matchesType(selection, RESULT_CONTRACT_TASK_TYPES) ||
    (matchesType(selection, [':IntermediateCatchEvent', ':BoundaryEvent', ':StartEvent']) &&
      hasEventDefinition(selection, 'MessageEventDefinition'))
  );
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

  const contract = getExtensionValue(selection.businessObject, ':resultContract');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="textarea" label="Result Contract" value={contract ?? '—'} disabled rows={6} />
    </div>
  );
}
