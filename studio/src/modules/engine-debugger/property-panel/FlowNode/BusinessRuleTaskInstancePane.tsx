import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableFlowNodeErrorRenderer, CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayBusinessRuleTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type BusinessRuleTaskInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayBusinessRuleTaskInstancePane,
  Pane: PaneFull,
  PaneContent: BusinessRuleTaskInstancePane,
};

function getPaneTitle(): string {
  return 'Business Rule Task Instance';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/business_rule_task" />
      </PaneHeader>
      {props.collapsed !== true && <BusinessRuleTaskInstancePane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function BusinessRuleTaskInstancePane(props: BusinessRuleTaskInstancePaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const businessRuleTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const typeProperties = businessRuleTaskInstance.typeProperties ?? {};

  return (
    <PaneBody>
      <PaneProperty type="text" label="State" disabled={true} value={businessRuleTaskInstance.state} />
      {businessRuleTaskInstance.finishedAt && (
        <PaneProperty type="text" label="Finished At" disabled={true} value={businessRuleTaskInstance.finishedAt} />
      )}
      {typeof typeProperties['hit_policy'] === 'string' && (
        <PaneProperty type="text" label="Hit Policy" disabled={true} value={typeProperties['hit_policy']} />
      )}
      {businessRuleTaskInstance.errorInfo && (
        <CopyableFlowNodeErrorRenderer
          editorDocument={props.editorDocument}
          id={businessRuleTaskInstance.id}
          flowNodeId={businessRuleTaskInstance.flowNodeId}
          flowNodeName={flowNode.name ?? businessRuleTaskInstance.flowNodeId}
          error={businessRuleTaskInstance.errorInfo}
          studio={props.studio}
        />
      )}
      {businessRuleTaskInstance.outputToken && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={businessRuleTaskInstance.id}
          flowNodeId={businessRuleTaskInstance.flowNodeId}
          flowNodeName={flowNode.name ?? businessRuleTaskInstance.flowNodeId}
          language="json"
          propertyName="Result"
          studio={props.studio}
          value={businessRuleTaskInstance.outputToken}
        />
      )}
      {typeProperties['evaluation_trace'] != null && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={businessRuleTaskInstance.id}
          flowNodeId={businessRuleTaskInstance.flowNodeId}
          flowNodeName={flowNode.name ?? businessRuleTaskInstance.flowNodeId}
          language="json"
          propertyName="Evaluation Trace"
          studio={props.studio}
          value={typeProperties['evaluation_trace']}
        />
      )}
    </PaneBody>
  );
}
