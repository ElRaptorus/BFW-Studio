import { FlowNodeInstanceState } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayCompensationBoundaryEventPane } from '../ShouldBeDisplayedConditions';

type CompensationBoundaryEventPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCompensationBoundaryEventPane,
  Pane: PaneFull,
  PaneContent: CompensationBoundaryEventPane,
};

function getPaneTitle(): string {
  return 'Compensation Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <CompensationBoundaryEventPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function CompensationBoundaryEventPane(props: CompensationBoundaryEventPaneProps): React.JSX.Element {
  const { model, flowNode } = props;
  const selectedFni = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  const attachedToId =
    flowNode.flowNodeModel?.typeData?.type === 'boundary_event' ? flowNode.flowNodeModel.typeData.attachedToRef : null;

  const compensatedEntry = model.compensatedActivities.find((entry) => entry.flowNodeId === attachedToId);

  const handlerWasExecuted = compensatedEntry != null;
  const handlerActivityId = compensatedEntry?.handlerActivityId ?? null;

  const fniState = selectedFni?.state ?? 'unknown';
  const wasTriggered = fniState === FlowNodeInstanceState.Finished;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Attached To" disabled={true} value={attachedToId ?? ''} />
      <PaneProperty type="text" label="Handler Activity" disabled={true} value={handlerActivityId ?? 'N/A'} />
      <PaneProperty type="text" label="Triggered" disabled={true} value={wasTriggered ? 'Yes' : 'No'} />
      <PaneProperty type="text" label="Handler Executed" disabled={true} value={handlerWasExecuted ? 'Yes' : 'No'} />
    </PaneBody>
  );
}
