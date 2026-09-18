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
  const startEventId =
    readFlowNodeString(props.editorDocumentModel, (flowNode) =>
      flowNode.typeData.type === 'call_activity' ? flowNode.typeData.startEventId : undefined,
    ) ?? '';
  const calledProcessVersion =
    readFlowNodeString(props.editorDocumentModel, (flowNode) =>
      flowNode.typeData.type === 'call_activity' ? flowNode.typeData.calledProcessVersion : undefined,
    ) ?? '';

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Called Element" value={calledElement} disabled />
      <PaneProperty type="text" label="Start Event ID" value={startEventId} disabled />
      <PaneProperty type="text" label="Called Process Version" value={calledProcessVersion} disabled />
    </div>
  );
}
