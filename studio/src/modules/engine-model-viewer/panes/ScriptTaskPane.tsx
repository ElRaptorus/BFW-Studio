import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Script Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':ScriptTask']);
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

  const businessObject = selection.businessObject;
  const scriptRef = getExtensionValue(businessObject, ':scriptRef');
  const scriptFormat = businessObject.scriptFormat as string | undefined;
  const script = businessObject.script as string | undefined;

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Script Ref" value={scriptRef ?? '—'} disabled />
      <PaneProperty type="text" label="Script Format" value={scriptFormat ?? '—'} disabled />
      {script != null && <PaneProperty type="textarea" label="Script" value={script} disabled rows={6} />}
    </div>
  );
}
