import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { FlowNodeInstanceState } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { hasLoopCharacteristics } from '../../libs/BpmnProcessHelpers';
import type { FlowNode, MultiInstanceGroup } from '../../libs/SelectableElement';

export type MultiInstanceProgressPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

function shouldDisplayMultiInstanceProgressPane(
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
  return hasLoopCharacteristics(flowNode.flowNodeModel) && flowNode.multiInstanceGroups.length > 0;
}

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayMultiInstanceProgressPane,
  Pane: PaneFull,
  PaneContent: MultiInstanceProgressPane,
};

function getPaneTitle(): string {
  return 'Iteration Progress';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <MultiInstanceProgressPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function MultiInstanceProgressPane(props: MultiInstanceProgressPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const groups = flowNode.multiInstanceGroups;
  const selectedMiId = props.model.selectedMultiInstanceId;

  const selectedFni = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const activeGroup: MultiInstanceGroup | undefined =
    groups.find((group) => group.shellFni.id === selectedMiId) ??
    groups.find(
      (group) => group.shellFni.id === selectedFni.id || group.iterationFnis.some((iter) => iter.id === selectedFni.id),
    ) ??
    groups[groups.length - 1];

  if (!activeGroup) {
    return (
      <PaneBody>
        <p className="text-muted">No iteration data available.</p>
      </PaneBody>
    );
  }

  const iterations = activeGroup.iterationFnis;
  const totalIterations = iterations.length;
  const completedIterations = iterations.filter((fni) => fni.state === FlowNodeInstanceState.Finished).length;
  const activeIterations = iterations.filter(
    (fni) => fni.state === FlowNodeInstanceState.Active || fni.state === FlowNodeInstanceState.Waiting,
  ).length;
  const failedIterations = iterations.filter(
    (fni) =>
      fni.state === FlowNodeInstanceState.Fatal ||
      fni.state === FlowNodeInstanceState.Error ||
      fni.state === FlowNodeInstanceState.Aborted,
  ).length;

  let loopLabel = 'Parallel Multi-Instance';
  if (activeGroup.loopType === 'standard_loop') {
    loopLabel = 'Standard Loop';
  } else if (activeGroup.loopType === 'sequential_mi') {
    loopLabel = 'Sequential Multi-Instance';
  }

  return (
    <PaneBody>
      <PaneProperty type="text" label="Type" disabled={true} value={loopLabel} />
      <PaneProperty type="text" label="Shell State" disabled={true} value={activeGroup.shellFni.state} />
      <PaneProperty type="text" label="Total Iterations" disabled={true} value={String(totalIterations)} />
      <PaneProperty type="text" label="Completed" disabled={true} value={String(completedIterations)} />
      <PaneProperty type="text" label="Active / Waiting" disabled={true} value={String(activeIterations)} />
      {failedIterations > 0 && (
        <PaneProperty type="text" label="Failed" disabled={true} value={String(failedIterations)} />
      )}
    </PaneBody>
  );
}
