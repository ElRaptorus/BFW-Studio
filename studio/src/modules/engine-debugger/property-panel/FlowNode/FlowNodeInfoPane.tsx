import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getEventDefinition } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { JumpToSymbolInSolutionLink } from '../JumpToSymbolInSolutionLink';
import { shouldDisplayFlowNodeInfoPane } from '../ShouldBeDisplayedConditions';

type FlowNodePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayFlowNodeInfoPane,
  Pane: PaneFull,
  PaneContent: FlowNodePane,
};

function getPaneTitle(): string {
  return 'Flow Node';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <FlowNodePane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function FlowNodePane(props: FlowNodePaneProps): React.JSX.Element {
  const flowNode = props.flowNode;

  return (
    <PaneBody>
      <label>
        Flow Node ID{' '}
        {props.model.processInstance?.processModelId && (
          <JumpToSymbolInSolutionLink
            definitionId={props.model.processInstance?.processModelId}
            elementId={flowNode.id}
            studio={props.studio}
          />
        )}
      </label>
      <PaneProperty type="text" disabled={true} value={flowNode.id} />
      <PaneProperty type="text" label="Flow Node Name" disabled={true} value={flowNode.name || ''} />
      <PaneProperty
        type="text"
        label="Flow Node Type"
        disabled={true}
        value={flowNode.shapeType?.replace('bpmn:', '') ?? ''}
      />
      {flowNode.flowNodeModel && (
        <PaneProperty
          type="text"
          label="Event Type"
          disabled={true}
          value={getEventTypeDisplayName(flowNode.flowNodeModel as BpmnFlowNode)}
        />
      )}
      {flowNode.flowNodeInstances.length > 0 && (
        <PaneProperty
          type="text"
          label="Flow Node Lane"
          disabled={true}
          value={flowNode.flowNodeInstances[0].laneName ?? ''}
        />
      )}
      {flowNode.flowNodeModel && flowNode.flowNodeInstances.length === 0 && <FlowNodeNotExecutedHint />}
      {!flowNode.flowNodeModel && <FlowNodeNotPartOfExecutedProcessHint />}
    </PaneBody>
  );
}

function FlowNodeNotPartOfExecutedProcessHint(): React.JSX.Element {
  return <p>This Flow Node is not part of the executed process.</p>;
}

function FlowNodeNotExecutedHint(): React.JSX.Element {
  return <p>This Flow Node was not executed.</p>;
}

function getEventTypeDisplayName(flowNode: BpmnFlowNode): string {
  const eventDefinition = getEventDefinition(flowNode);
  if (!eventDefinition || eventDefinition.type === 'none') {
    return 'None';
  }
  switch (eventDefinition.type) {
    case 'error':
      return 'Error Event';
    case 'link':
      return 'Link Event';
    case 'message':
      return 'Message Event';
    case 'signal':
      return 'Signal Event';
    case 'terminate':
      return 'Termination Event';
    case 'timer':
      return 'Timer Event';
    case 'escalation':
      return 'Escalation Event';
    case 'conditional':
      return 'Conditional Event';
    case 'compensation':
      return 'Compensation Event';
    case 'cancel':
      return 'Cancel Event';
    default:
      return 'None';
  }
}
