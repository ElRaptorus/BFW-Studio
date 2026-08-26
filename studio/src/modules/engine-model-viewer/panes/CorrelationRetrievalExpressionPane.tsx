import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  getSelectedEventDefinition,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
} from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Correlation Retrieval Expression';
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
    matchesType(selection, [':SendTask']) ||
    (matchesType(selection, [':IntermediateThrowEvent', ':EndEvent']) &&
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
  const expression = getCorrelationExpression(props.editorDocumentModel);

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Expression" value={expression ?? '—'} disabled />
    </div>
  );
}

function getCorrelationExpression(model: EditorDocumentModel): string | null {
  const modeled = getSelectedEventDefinition(model);
  if (modeled?.type === 'message') {
    return modeled.correlationRetrievalExpression ?? null;
  }
  return null;
}
