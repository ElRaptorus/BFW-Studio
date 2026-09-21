import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import {
  assertEventDefinitionType,
  getSelectedEventDefinition,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
} from './paneHelpers';

const ERROR_EVENT_POSITION_TYPES = [':EndEvent', ':BoundaryEvent', ':StartEvent'];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Error Event';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (!selection) {
    return false;
  }
  return matchesType(selection, ERROR_EVENT_POSITION_TYPES) && hasEventDefinition(selection, 'ErrorEventDefinition');
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
  const modeled = getSelectedEventDefinition(props.editorDocumentModel);
  assertEventDefinitionType(modeled, 'error');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Error" value={modeled.errorRef ?? '—'} disabled />
      {modeled.errorCode != null && <PaneProperty type="text" label="Error Code" value={modeled.errorCode} disabled />}
      {modeled.errorMessage != null && (
        <PaneProperty type="text" label="Error Message" value={modeled.errorMessage} disabled />
      )}
    </div>
  );
}
