import { getHumanizedDateTime } from '#modules/engine-core/Formatters';

import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { ModelViewerModelData } from '../types';
import { getSelection, isModelViewerDocument } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Process Model';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel) == null;
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
  const data = props.editorDocument?.data?.current as ModelViewerModelData | null;
  if (!data) {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Process Model ID" value={data.processModelId} disabled />
      {data.name && <PaneProperty type="text" label="Name" value={data.name} disabled />}
      <PaneProperty type="text" label="Version" value={data.version ?? '—'} disabled />
      <PaneProperty type="text" label="Enabled" value={data.enabled ? 'Yes' : 'No'} disabled />
      {data.deployedAt && (
        <PaneProperty type="text" label="Deployed at" value={getHumanizedDateTime(data.deployedAt)} disabled />
      )}
    </div>
  );
}
