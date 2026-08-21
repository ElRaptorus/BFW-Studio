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
  return 'Manual Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':ManualTask']);
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
  const requireConfirmation = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    if (flowNode.typeData.type !== 'manual_task') {
      return undefined;
    }
    return flowNode.typeData.requireConfirmation ? 'true' : 'false';
  });

  return (
    <div className="engine-pane-process-info">
      <PaneProperty
        type="text"
        label="Require Confirmation"
        value={requireConfirmation === 'true' ? 'Yes' : 'No'}
        disabled
      />
    </div>
  );
}
