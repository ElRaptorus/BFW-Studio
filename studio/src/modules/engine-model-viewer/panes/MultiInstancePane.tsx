import type { MultiInstance, StandardLoop } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import { getSelectedBpmnFlowNode, getSelection, isModelViewerDocument } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Loop Configuration';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return selection != null && hasLoopCharacteristics(editorDocumentModel);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const title = getLoopTitle(props.editorDocumentModel);

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={title} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const modeled = getSelectedBpmnFlowNode(props.editorDocumentModel);
  assertNotNull(modeled, 'flowNode');
  if (modeled.standardLoop) {
    return <StandardLoopFromSdk loop={modeled.standardLoop} />;
  }
  if (modeled.multiInstance) {
    return <MultiInstanceFromSdk loop={modeled.multiInstance} />;
  }
  throw new Error('Unexpected value: loop characteristics should be present here.');
}

function StandardLoopFromSdk(props: { loop: StandardLoop }): React.JSX.Element {
  const { loop } = props;
  return (
    <div className="engine-pane-process-info">
      <PaneProperty
        type="text"
        label="Evaluation Mode"
        value={loop.testBefore ? 'While-Do (test before)' : 'Do-While (test after)'}
        disabled
      />
      {loop.loopCondition != null && (
        <PaneProperty type="text" label="Loop Condition" value={loop.loopCondition} disabled />
      )}
      {loop.loopMaximum != null && (
        <PaneProperty type="text" label="Max Iterations" value={String(loop.loopMaximum)} disabled />
      )}
      {loop.loopInterval != null && (
        <PaneProperty type="text" label="Loop Interval" value={loop.loopInterval} disabled />
      )}
    </div>
  );
}

function MultiInstanceFromSdk(props: { loop: MultiInstance }): React.JSX.Element {
  const { loop } = props;
  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Sequential" value={loop.isSequential ? 'Yes' : 'No'} disabled />
      {loop.collectionExpression != null && (
        <PaneProperty type="text" label="Input Collection" value={loop.collectionExpression} disabled />
      )}
      {loop.elementVariable != null && (
        <PaneProperty type="text" label="Element Variable" value={loop.elementVariable} disabled />
      )}
      {loop.outputCollection != null && (
        <PaneProperty type="text" label="Output Collection" value={loop.outputCollection} disabled />
      )}
      {loop.outputElementVariable != null && (
        <PaneProperty type="text" label="Output Element Variable" value={loop.outputElementVariable} disabled />
      )}
      {loop.completionCondition != null && (
        <PaneProperty type="text" label="Completion Condition" value={loop.completionCondition} disabled />
      )}
      {loop.isSequential && loop.loopBreakCondition != null && (
        <PaneProperty type="text" label="Loop Break Condition" value={loop.loopBreakCondition} disabled />
      )}
      {loop.isSequential && loop.loopInterval != null && (
        <PaneProperty type="text" label="Loop Interval" value={loop.loopInterval} disabled />
      )}
      {loop.maxIterations != null && (
        <PaneProperty type="text" label="Max Iterations" value={String(loop.maxIterations)} disabled />
      )}
    </div>
  );
}

function hasLoopCharacteristics(model: EditorDocumentModel): boolean {
  const modeled = getSelectedBpmnFlowNode(model);
  return modeled?.multiInstance != null || modeled?.standardLoop != null;
}

function getLoopTitle(model: EditorDocumentModel): string {
  const modeled = getSelectedBpmnFlowNode(model);
  if (modeled?.standardLoop) {
    return 'Standard Loop';
  }
  if (modeled?.multiInstance) {
    return modeled.multiInstance.isSequential ? 'Multi-Instance (Sequential)' : 'Multi-Instance (Parallel)';
  }
  return getPaneTitle();
}
