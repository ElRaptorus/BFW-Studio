import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

const GATEWAY_TYPES = [
  ':ExclusiveGateway',
  ':InclusiveGateway',
  ':ParallelGateway',
  ':EventBasedGateway',
  ':ComplexGateway',
];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Gateway';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), GATEWAY_TYPES);
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

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Gateway type" value={selection.elementType.replace('bpmn:', '')} disabled />
      {'default' in selection.businessObject && (
        <PaneProperty
          type="text"
          label="Default flow"
          value={String(selection.businessObject.default ?? '—')}
          disabled
        />
      )}
    </div>
  );
}
