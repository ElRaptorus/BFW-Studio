import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { hasMultiInstance, isSequentialMultiInstance } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';

export type MultiInstanceConfigPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

function shouldDisplayMultiInstanceConfigPane(
  document: { documentType: string },
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!model?.engineIsOnline) {
    return false;
  }
  const selectedElements = model.selectedElements;
  if (!selectedElements || selectedElements.length !== 1 || selectedElements[0].type !== 'FlowNode') {
    return false;
  }
  const flowNode = selectedElements[0];
  if (flowNode.flowNodeInstances.length === 0 || !flowNode.flowNodeModel) {
    return false;
  }
  return hasMultiInstance(flowNode.flowNodeModel);
}

function resolveTitle(model: EngineBpmnDebuggerEditorDocumentModel): string {
  const selectedElements = model?.selectedElements;
  if (selectedElements?.length === 1 && selectedElements[0].type === 'FlowNode') {
    const flowNodeModel = selectedElements[0].flowNodeModel;
    if (flowNodeModel && isSequentialMultiInstance(flowNodeModel)) {
      return 'Sequential Multi-Instance Configuration';
    }
  }
  return 'Parallel Multi-Instance Configuration';
}

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Multi-Instance Configuration',
  shouldBeDisplayed: shouldDisplayMultiInstanceConfigPane,
  Pane: PaneFull,
  PaneContent: MultiInstanceConfigPane,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const title = resolveTitle(props.editorDocumentModel);
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={title} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/sequential-multi-instance'} />
      </PaneHeader>
      {props.collapsed !== true && <MultiInstanceConfigPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function MultiInstanceConfigPane(props: MultiInstanceConfigPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;
  const multiInstance = flowNodeModel.multiInstance;
  const isSequential = isSequentialMultiInstance(flowNodeModel);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Mode" disabled={true} value={isSequential ? 'Sequential' : 'Parallel'} />
      {multiInstance?.collectionExpression && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={flowNodeInstance.id}
          flowNodeId={flowNodeInstance.flowNodeId}
          flowNodeName={flowNode.name ?? flowNodeInstance.flowNodeId}
          language="json"
          propertyName="Input Collection"
          studio={props.studio}
          value={multiInstance.collectionExpression}
        />
      )}
      {multiInstance?.outputCollection && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={flowNodeInstance.id}
          flowNodeId={flowNodeInstance.flowNodeId}
          flowNodeName={flowNode.name ?? flowNodeInstance.flowNodeId}
          language="json"
          propertyName="Output Collection"
          studio={props.studio}
          value={multiInstance.outputCollection}
        />
      )}
      <PaneProperty type="text" label="Element Variable" disabled={true} value={multiInstance?.elementVariable ?? ''} />
      <PaneProperty
        type="text"
        label="Output Element Variable"
        disabled={true}
        value={multiInstance?.outputElementVariable ?? ''}
      />
      {multiInstance?.completionCondition && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={flowNodeInstance.id}
          flowNodeId={flowNodeInstance.flowNodeId}
          flowNodeName={flowNode.name ?? flowNodeInstance.flowNodeId}
          language="json"
          propertyName="Completion Condition"
          studio={props.studio}
          value={multiInstance.completionCondition}
        />
      )}
      {isSequential && multiInstance?.loopBreakCondition && (
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
      {isSequential && (
        <PaneProperty
          type="text"
          label="Interval between Iterations"
          disabled={true}
          value={multiInstance?.loopInterval ?? ''}
        />
      )}
      <PaneProperty
        type="text"
        label="Maximum Iterations"
        disabled={true}
        value={multiInstance?.maxIterations != null ? String(multiInstance.maxIterations) : ''}
      />
    </PaneBody>
  );
}
