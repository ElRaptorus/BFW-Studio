import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import { getSelectedSequenceFlow, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Sequence Flow';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':SequenceFlow']);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const sequenceFlow = getSelectedSequenceFlow(props.editorDocumentModel);
  assertNotNull(sequenceFlow, 'sequenceFlow');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Source" value={sequenceFlow.sourceRef ?? '—'} disabled />
      <PaneProperty type="text" label="Target" value={sequenceFlow.targetRef ?? '—'} disabled />
      {sequenceFlow.conditionExpression != null && sequenceFlow.conditionExpression !== '' && (
        <PaneProperty type="text" label="Condition" value={sequenceFlow.conditionExpression} disabled />
      )}
    </div>
  );
}
