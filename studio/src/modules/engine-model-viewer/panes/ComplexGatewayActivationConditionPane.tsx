import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { ModelViewerSelection } from '../types';
import { getSelectedBpmnFlowNode, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Activation Condition';
}

function isComplexJoin(selection: ModelViewerSelection): boolean {
  const incoming = selection.businessObject.incoming as unknown[] | undefined;
  const outgoing = selection.businessObject.outgoing as unknown[] | undefined;
  const incomingCount = Array.isArray(incoming) ? incoming.length : 0;
  const outgoingCount = Array.isArray(outgoing) ? outgoing.length : 0;
  const isJoin = incomingCount > 1 && outgoingCount <= 1;
  const isMixed = incomingCount > 1 && outgoingCount > 1;
  return isJoin || isMixed;
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (!selection) {
    return false;
  }
  return matchesType(selection, [':ComplexGateway']) && isComplexJoin(selection);
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
  const modeled = getSelectedBpmnFlowNode(props.editorDocumentModel);
  if (!modeled || modeled.typeData.type !== 'complex_gateway') {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty
        type="textarea"
        label="Activation Condition"
        value={modeled.typeData.activationCondition ?? '—'}
        disabled
        rows={4}
      />
    </div>
  );
}
