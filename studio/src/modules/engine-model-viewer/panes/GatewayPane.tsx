import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelectedBpmnFlowNode, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

const GATEWAY_TYPES = [
  ':ExclusiveGateway',
  ':InclusiveGateway',
  ':ParallelGateway',
  ':EventBasedGateway',
  ':ComplexGateway',
];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Gateway';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), GATEWAY_TYPES);
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
  assertNotNull(selection, 'selection');

  const modeled = getSelectedBpmnFlowNode(props.editorDocumentModel);
  const defaultFlowRef =
    modeled?.typeData.type === 'exclusive_gateway' || modeled?.typeData.type === 'inclusive_gateway'
      ? modeled.typeData.defaultFlowRef
      : undefined;

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Gateway type" value={selection.elementType.replace('bpmn:', '')} disabled />
      {defaultFlowRef != null && <PaneProperty type="text" label="Default flow" value={defaultFlowRef} disabled />}
    </div>
  );
}
