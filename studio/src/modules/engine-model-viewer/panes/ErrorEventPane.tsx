import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  getEventDefinition,
  getExtensionValue,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
  moddleRefName,
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

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }
  const errorDef = getEventDefinition(selection.businessObject, 'ErrorEventDefinition');
  if (!errorDef) {
    return null;
  }

  const errorRef = moddleRefName(errorDef.errorRef);
  const errorCode = getExtensionValue(errorDef, ':errorCode');
  const errorMessage = getExtensionValue(errorDef, ':errorMessage');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Error" value={errorRef} disabled />
      {errorCode != null && <PaneProperty type="text" label="Error Code" value={errorCode} disabled />}
      {errorMessage != null && <PaneProperty type="text" label="Error Message" value={errorMessage} disabled />}
    </div>
  );
}
