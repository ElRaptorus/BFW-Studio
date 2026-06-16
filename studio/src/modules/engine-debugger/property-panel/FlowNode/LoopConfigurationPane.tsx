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
  return 'Loop Configuration';
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
  const multiInstance = flowNodeModel.multiInstance;

  return (
    <PaneBody>
      {multiInstance?.loopBreakCondition && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={flowNodeInstance.id}
          flowNodeId={flowNodeInstance.flowNodeId}
          flowNodeName={flowNode.name ?? flowNodeInstance.flowNodeId}
          language="json"
          propertyName="Break Condition"
          studio={props.studio}
          value={multiInstance.loopBreakCondition}
        />
      )}
      <PaneProperty
        type="text"
        label="Timeout between iterations (Definition)"
        disabled={true}
        value={multiInstance?.loopInterval ?? ''}
      />
      <PaneProperty
        type="text"
        label="Maximum Number of iterations (Definition)"
        disabled={true}
        value={multiInstance?.maxIterations != null ? String(multiInstance.maxIterations) : ''}
      />
    </PaneBody>
  );
}
