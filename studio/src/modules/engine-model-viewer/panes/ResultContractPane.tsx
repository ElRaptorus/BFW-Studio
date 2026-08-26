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

const RESULT_CONTRACT_TASK_TYPES = [
  ':UserTask',
  ':ServiceTask',
  ':ScriptTask',
  ':BusinessRuleTask',
  ':ReceiveTask',
  ...SUBPROCESS_SHELL_TYPES,
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
  const contract = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    const typeData = flowNode.typeData as { resultContract?: Record<string, unknown> | null };
    if (!('resultContract' in typeData)) {
      return undefined;
    }
    return typeData.resultContract != null ? JSON.stringify(typeData.resultContract, null, 2) : null;
  });

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="textarea" label="Result Contract" value={contract ?? '—'} disabled rows={6} />
    </div>
  );
}
