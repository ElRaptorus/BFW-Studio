import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, hasEventDefinition, isModelViewerDocument, matchesType } from './paneHelpers';

const PAYLOAD_CONTRACT_TASK_TYPES = [
  ':UserTask',
  ':ServiceTask',
  ':ScriptTask',
  ':BusinessRuleTask',
  ':CallActivity',
  ':SendTask',
];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Payload Contract';
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
    matchesType(selection, PAYLOAD_CONTRACT_TASK_TYPES) ||
    (matchesType(selection, [':EndEvent', ':IntermediateThrowEvent']) &&
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

  const contract = getExtensionValue(selection.businessObject, ':payloadContract');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="textarea" label="Payload Contract" value={contract ?? '—'} disabled rows={6} />
    </div>
  );
}
