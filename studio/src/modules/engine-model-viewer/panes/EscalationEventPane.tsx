import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  getEventDefinition,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
  moddleRefName,
} from './paneHelpers';

const ESCALATION_EVENT_POSITION_TYPES = [':BoundaryEvent', ':StartEvent', ':IntermediateThrowEvent', ':EndEvent'];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Escalation Event';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (!selection) {
    return false;
  }
  return (
    matchesType(selection, ESCALATION_EVENT_POSITION_TYPES) &&
    hasEventDefinition(selection, 'EscalationEventDefinition')
  );
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
  const escalationDef = getEventDefinition(selection.businessObject, 'EscalationEventDefinition');
  if (!escalationDef) {
    return null;
  }

  const escalationRef = moddleRefName(escalationDef.escalationRef);
  const escalation = escalationDef.escalationRef as Record<string, unknown> | undefined;
  const escalationCode = escalation?.escalationCode as string | undefined;

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Escalation" value={escalationRef} disabled />
      {escalationCode != null && <PaneProperty type="text" label="Escalation Code" value={escalationCode} disabled />}
    </div>
  );
}
