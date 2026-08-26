import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  SUBPROCESS_SHELL_TYPES,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
  readFlowNodeString,
} from './paneHelpers';

const PAYLOAD_CONTRACT_TASK_TYPES = [
  ':UserTask',
  ':ServiceTask',
  ':ScriptTask',
  ':BusinessRuleTask',
  ':SendTask',
  ...SUBPROCESS_SHELL_TYPES,
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
  const contract = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    const typeData = flowNode.typeData as { payloadContract?: Record<string, unknown> | null };
    if (!('payloadContract' in typeData)) {
      return undefined;
    }
    return typeData.payloadContract != null ? JSON.stringify(typeData.payloadContract, null, 2) : null;
  });

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="textarea" label="Payload Contract" value={contract ?? '—'} disabled rows={6} />
    </div>
  );
}
