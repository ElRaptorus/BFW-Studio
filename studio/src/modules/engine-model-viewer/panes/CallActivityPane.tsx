import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType, readFlowNodeString } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Call Activity';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':CallActivity']);
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
  const calledElement =
    readFlowNodeString(props.editorDocumentModel, (flowNode) =>
      flowNode.typeData.type === 'call_activity' ? flowNode.typeData.calledElement : undefined,
    ) ?? '—';
  const startEventId = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'call_activity' ? flowNode.typeData.startEventId : undefined,
  );

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Called Element" value={calledElement} disabled />
      {startEventId != null && <PaneProperty type="text" label="Start Event ID" value={startEventId} disabled />}
    </div>
  );
}
