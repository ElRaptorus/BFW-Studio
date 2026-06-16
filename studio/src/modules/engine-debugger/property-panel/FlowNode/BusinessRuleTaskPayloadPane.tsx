import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayBusinessRuleTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type BusinessRuleTaskPayloadPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayBusinessRuleTaskInstancePane,
  Pane: PaneFull,
  PaneContent: BusinessRuleTaskPayloadPane,
};

function getPaneTitle(): string {
  return 'Business Rule Task Payload';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/business_rule_task" />
      </PaneHeader>
      {props.collapsed !== true && <BusinessRuleTaskPayloadPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function BusinessRuleTaskPayloadPane(props: BusinessRuleTaskPayloadPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const businessRuleTaskModel = flowNode.flowNodeModel as BpmnFlowNode;
  const businessRuleTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  return (
    <PaneBody>
      <CopyableJsonDataRenderer
        editorDocument={props.editorDocument}
        id={businessRuleTaskInstance.id}
        flowNodeId={businessRuleTaskInstance.flowNodeId}
        flowNodeName={businessRuleTaskInstance.flowNodeId}
        language="json"
        propertyName="Payload (Evaluated)"
        size="medium"
        studio={props.studio}
        value={businessRuleTaskInstance.typeProperties?.payload ?? ''}
      />
      <CopyableJsonDataRenderer
        editorDocument={props.editorDocument}
        id={businessRuleTaskInstance.id}
        flowNodeId={businessRuleTaskInstance.flowNodeId}
        flowNodeName={businessRuleTaskInstance.flowNodeId}
        language="javascript"
        propertyName="Payload (Definition)"
        size="medium"
        studio={props.studio}
        value={businessRuleTaskModel.typeData.type === 'business_rule_task' ? '' : ''}
      />
    </PaneBody>
  );
}
