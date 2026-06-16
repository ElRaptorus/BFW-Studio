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
} from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Correlation Retrieval Expression';
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
    matchesType(selection, [':SendTask']) ||
    (matchesType(selection, [':IntermediateThrowEvent', ':EndEvent']) &&
      hasEventDefinition(selection, 'MessageEventDefinition'))
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

  const expression = getCorrelationExpression(selection.businessObject);

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Expression" value={expression ?? '—'} disabled />
    </div>
  );
}

function getCorrelationExpression(businessObject: Record<string, unknown>): string | null {
  const messageDef = getEventDefinition(businessObject, 'MessageEventDefinition');
  if (messageDef) {
    return getExtensionValue(messageDef, ':correlationRetrievalExpression');
  }
  return getExtensionValue(businessObject, ':correlationRetrievalExpression');
}
