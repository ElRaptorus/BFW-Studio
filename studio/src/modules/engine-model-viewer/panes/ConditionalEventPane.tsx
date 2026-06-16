import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  getEventDefinition,
  getSelection,
  hasEventDefinition,
  isModelViewerDocument,
  matchesType,
} from './paneHelpers';

const CONDITIONAL_EVENT_POSITION_TYPES = [':StartEvent', ':BoundaryEvent', ':IntermediateCatchEvent'];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Conditional Event';
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
    matchesType(selection, CONDITIONAL_EVENT_POSITION_TYPES) &&
    hasEventDefinition(selection, 'ConditionalEventDefinition')
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
  const conditionalDef = getEventDefinition(selection.businessObject, 'ConditionalEventDefinition');
  if (!conditionalDef) {
    return null;
  }

  const condition = conditionalDef.condition as Record<string, unknown> | undefined;
  const conditionBody = condition?.body ?? condition?.text;

  return (
    <div className="engine-pane-process-info">
      <PaneProperty
        type="textarea"
        label="Condition"
        value={conditionBody != null ? String(conditionBody) : '—'}
        disabled
        rows={4}
      />
    </div>
  );
}
