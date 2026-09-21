import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import type { FlowNode as BpmnFlowNode, SequenceFlow } from '@elraptorus/bfw_engine_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs';
import { getAllFlowNodes, getAllSequenceFlows } from '../../libs/BpmnProcessHelpers';
import { getConditionExpressionText } from '../../libs/typeHelpers';
import { ConditionalSequenceFlowLink, DefaultSequenceFlowLink } from '../FlowNodeInstanceLinks';
import { ShouldDisplayOutgoingFlowsAndConditionsPane } from '../ShouldBeDisplayedConditions';

export type ExclusiveSplitGatewayPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: ShouldDisplayOutgoingFlowsAndConditionsPane,
  Pane: PaneFull,
  PaneContent: ExclusiveSplitGatewayPane,
};

function getPaneTitle(): string {
  return 'Outgoing Flows & Conditions';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <ExclusiveSplitGatewayPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function ExclusiveSplitGatewayPane(props: ExclusiveSplitGatewayPaneProps): React.JSX.Element | null {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const gatewayModel = flowNode.flowNodeModel as BpmnFlowNode;
  const processModel = props.model.processModel;
  if (!processModel) {
    return null;
  }

  const defaultFlowRef =
    gatewayModel.typeData.type === 'exclusive_gateway' || gatewayModel.typeData.type === 'inclusive_gateway'
      ? gatewayModel.typeData.defaultFlowRef
      : null;

  const allSequenceFlows = getAllSequenceFlows(processModel);
  const allFlowNodes = getAllFlowNodes(processModel);

  return (
    <PaneBody>
      {gatewayModel.outgoing.map((sequenceFlowId) => {
        const sequenceFlow = allSequenceFlows.find((flow) => flow.id === sequenceFlowId) as SequenceFlow | undefined;
        const targetFlowNode = allFlowNodes.find((node) => node.id === sequenceFlow?.targetRef);

        if (!sequenceFlow || !targetFlowNode) {
          return null;
        }

        return sequenceFlow.id === defaultFlowRef ? (
          <DefaultSequenceFlowLink
            key={`default_flow_link_${targetFlowNode.id}_${sequenceFlowId}`}
            targetFlowNodeId={targetFlowNode.id}
            targetFlowNodeName={targetFlowNode.name ?? targetFlowNode.id}
            targetFlowNodeType={targetFlowNode.type}
            iconComponent={Icon}
            sequenceFlowId={sequenceFlowId}
            model={props.model}
          />
        ) : (
          <ConditionalSequenceFlowLink
            key={`conditional_flow_link_${targetFlowNode.id}_${sequenceFlowId}`}
            targetFlowNodeId={targetFlowNode.id}
            targetFlowNodeName={targetFlowNode.name ?? targetFlowNode.id}
            targetFlowNodeType={targetFlowNode.type}
            condition={getConditionExpressionText(sequenceFlow.conditionExpression)}
            iconComponent={Icon}
            sequenceFlowId={sequenceFlowId}
            model={props.model}
          />
        );
      })}
    </PaneBody>
  );
}
