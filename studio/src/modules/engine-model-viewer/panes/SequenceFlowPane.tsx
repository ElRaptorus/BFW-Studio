import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

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
