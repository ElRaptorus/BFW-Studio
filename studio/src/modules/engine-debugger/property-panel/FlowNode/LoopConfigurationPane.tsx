import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayLoopConfigurationPane } from '../ShouldBeDisplayedConditions';

export type LoopConfigurationPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayLoopConfigurationPane,
  Pane: PaneFull,
  PaneContent: LoopConfigurationPane,
};

function getPaneTitle(): string {
  return 'Standard Loop Configuration';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/loop" />
      </PaneHeader>
      {props.collapsed !== true && <LoopConfigurationPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function LoopConfigurationPane(props: LoopConfigurationPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;
  const standardLoop = flowNodeModel.standardLoop;

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Test Before (while-do)"
        disabled={true}
        value={standardLoop?.testBefore ? 'Yes' : 'No'}
      />
      {standardLoop?.loopCondition && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={flowNodeInstance.id}
          flowNodeId={flowNodeInstance.flowNodeId}
          flowNodeName={flowNode.name ?? flowNodeInstance.flowNodeId}
          language="json"
          propertyName="Loop Condition"
          studio={props.studio}
          value={standardLoop.loopCondition}
        />
      )}
      <PaneProperty
        type="text"
        label="Maximum Iterations"
        disabled={true}
        value={standardLoop?.loopMaximum != null ? String(standardLoop.loopMaximum) : ''}
      />
      <PaneProperty
        type="text"
        label="Interval between Iterations"
        disabled={true}
        value={standardLoop?.loopInterval ?? ''}
      />
    </PaneBody>
  );
}
