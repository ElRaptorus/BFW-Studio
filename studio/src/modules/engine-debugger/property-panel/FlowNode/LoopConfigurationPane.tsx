import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayLoopConfigurationPane } from '../ShouldBeDisplayedConditions';

export type LoopConfigurationPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
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
