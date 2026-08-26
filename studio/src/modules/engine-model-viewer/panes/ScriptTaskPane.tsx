import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType, readFlowNodeString } from './paneHelpers';

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
  const scriptRef = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'script_task' ? flowNode.typeData.scriptRef : undefined,
  );
  const scriptFormat = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'script_task' ? flowNode.typeData.scriptFormat : undefined,
  );
  const script = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'script_task' ? flowNode.typeData.script : undefined,
  );

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Script Ref" value={scriptRef ?? '—'} disabled />
      <PaneProperty type="text" label="Script Format" value={scriptFormat ?? '—'} disabled />
      {script != null && <PaneProperty type="textarea" label="Script" value={script} disabled rows={6} />}
    </div>
  );
}
