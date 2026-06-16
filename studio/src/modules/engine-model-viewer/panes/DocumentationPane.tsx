import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { ModelViewerSelection } from '../types';
import { getSelection, isModelViewerDocument } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Documentation';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return selection != null && hasDocumentation(selection);
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
  const documentation = (selection.businessObject.documentation as { text?: string }[])?.[0]?.text;
  if (!documentation) {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="textarea" label="Text" value={documentation} disabled rows={3} />
    </div>
  );
}

function hasDocumentation(selection: ModelViewerSelection): boolean {
  const documentation = (selection.businessObject.documentation as { text?: string }[] | undefined)?.[0]?.text;
  return Boolean(documentation);
}
