import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayBusinessRuleTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type BusinessRuleTaskTopicPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayBusinessRuleTaskInstancePane,
  Pane: PaneFull,
  PaneContent: BusinessRuleTaskTopicPane,
};

function getPaneTitle(): string {
  return 'Business Rule Task Topic';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/business_rule_task" />
      </PaneHeader>
      {props.collapsed !== true && <BusinessRuleTaskTopicPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function getEvaluatedDecisionRef(flowNodeInstance: FlowNodeInstance): string {
  const typeProperties = flowNodeInstance.typeProperties;
  if (typeof typeProperties?.['decision_ref'] === 'string') {
    return typeProperties['decision_ref'];
  }
  if (typeof typeProperties?.['implementation'] === 'string') {
    return typeProperties['implementation'];
  }
  return '';
}

function BusinessRuleTaskTopicPane(props: BusinessRuleTaskTopicPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const businessRuleTaskModel = flowNode.flowNodeModel as BpmnFlowNode;
  const businessRuleTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const evaluatedDecisionRef = getEvaluatedDecisionRef(businessRuleTaskInstance);
  const isDmnMode = resolveIsDmnMode(businessRuleTaskModel, businessRuleTaskInstance);
  const decisionModelId = evaluatedDecisionRef || getDefinitionDecisionRef(businessRuleTaskModel);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Decision Ref (Evaluated)" disabled={true} value={evaluatedDecisionRef} />
      <PaneProperty
        type="text"
        label="Decision Ref (Definition)"
        disabled={true}
        value={getDefinitionDecisionRef(businessRuleTaskModel)}
      />
      {isDmnMode && decisionModelId && (
        <OpenInDecisionViewerLink model={props.model} studio={props.studio} decisionModelId={decisionModelId} />
      )}
    </PaneBody>
  );
}

function getDefinitionDecisionRef(businessRuleTaskModel: BpmnFlowNode): string {
  if (businessRuleTaskModel.typeData.type === 'business_rule_task') {
    return businessRuleTaskModel.typeData.ruleRef ?? businessRuleTaskModel.typeData.implementation ?? '';
  }
  return '';
}

function resolveIsDmnMode(businessRuleTaskModel: BpmnFlowNode, instance: FlowNodeInstance): boolean {
  const runtimeMode = instance.typeProperties?.['mode'];
  if (typeof runtimeMode === 'string') {
    return runtimeMode === 'dmn';
  }
  if (businessRuleTaskModel.typeData.type === 'business_rule_task') {
    return businessRuleTaskModel.typeData.implementation === 'dmn';
  }
  return false;
}

function OpenInDecisionViewerLink(props: {
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  decisionModelId: string;
}): React.JSX.Element {
  const cmd = props.studio.commands.getClickHandler();
  const isEnabled = props.studio.commands.isCommandEnabled('engine.workspace.openDecisionViewer', [
    props.model.engineId,
    props.decisionModelId,
  ]);

  return (
    <div
      className={`pane-item pane-item--hoverable${isEnabled ? '' : ' pane-item--disabled'}`}
      title="Open decision model in Decision Viewer"
      data-bs-toggle="tooltip"
      onClick={
        isEnabled
          ? cmd('engine.workspace.openDecisionViewer', [props.model.engineId, props.decisionModelId])
          : undefined
      }
    >
      <div className="pane-item__text">Open in Decision Viewer</div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
