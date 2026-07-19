import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { ModelViewerSelection } from '../types';
import { getExtensionValue, getSelection, isModelViewerDocument } from './paneHelpers';

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
  return selection != null && hasLoopCharacteristics(selection);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const selection = getSelection(props.editorDocumentModel);
  const title = getLoopTitle(selection);

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={title} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }
  const loop = selection.businessObject.loopCharacteristics as Record<string, unknown> | undefined;
  if (!loop) {
    return null;
  }

  const loopType = String(loop.$type ?? '');
  if (loopType.includes('StandardLoopCharacteristics')) {
    return <StandardLoopContent loop={loop} />;
  }
  return <MultiInstanceContent loop={loop} />;
}

function StandardLoopContent(props: { loop: Record<string, unknown> }): React.JSX.Element {
  const { loop } = props;
  const loopCondition = loop.loopCondition as Record<string, unknown> | undefined;
  const testBefore = loop.testBefore === true;
  const loopMaximum = loop.loopMaximum;
  const loopInterval = getExtensionValue(loop, ':loopInterval');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty
        type="text"
        label="Evaluation Mode"
        value={testBefore ? 'While-Do (test before)' : 'Do-While (test after)'}
        disabled
      />
      {loopCondition != null && (
        <PaneProperty
          type="text"
          label="Loop Condition"
          value={String(loopCondition.body ?? loopCondition.text ?? '—')}
          disabled
        />
      )}
      {loopMaximum != null && <PaneProperty type="text" label="Max Iterations" value={String(loopMaximum)} disabled />}
      {loopInterval != null && <PaneProperty type="text" label="Loop Interval" value={loopInterval} disabled />}
    </div>
  );
}

function MultiInstanceContent(props: { loop: Record<string, unknown> }): React.JSX.Element {
  const { loop } = props;
  const isSequential = loop.isSequential === true;
  const completionCondition = loop.completionCondition as Record<string, unknown> | undefined;

  const inputCollection = getExtensionValue(loop, ':inputCollection');
  const outputCollection = getExtensionValue(loop, ':outputCollection');
  const elementVariable = getExtensionValue(loop, ':elementVariable');
  const outputElementVariable = getExtensionValue(loop, ':outputElementVariable');
  const loopBreakCondition = getExtensionValue(loop, ':loopBreakCondition');
  const loopInterval = getExtensionValue(loop, ':loopInterval');
  const maxIterations = getExtensionValue(loop, ':maxIterations');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Sequential" value={isSequential ? 'Yes' : 'No'} disabled />
      {inputCollection != null && (
        <PaneProperty type="text" label="Input Collection" value={inputCollection} disabled />
      )}
      {elementVariable != null && (
        <PaneProperty type="text" label="Element Variable" value={elementVariable} disabled />
      )}
      {outputCollection != null && (
        <PaneProperty type="text" label="Output Collection" value={outputCollection} disabled />
      )}
      {outputElementVariable != null && (
        <PaneProperty type="text" label="Output Element Variable" value={outputElementVariable} disabled />
      )}
      {completionCondition != null && (
        <PaneProperty
          type="text"
          label="Completion Condition"
          value={String(completionCondition.body ?? completionCondition.text ?? '—')}
          disabled
        />
      )}
      {isSequential && loopBreakCondition != null && (
        <PaneProperty type="text" label="Loop Break Condition" value={loopBreakCondition} disabled />
      )}
      {isSequential && loopInterval != null && (
        <PaneProperty type="text" label="Loop Interval" value={loopInterval} disabled />
      )}
      {maxIterations != null && <PaneProperty type="text" label="Max Iterations" value={maxIterations} disabled />}
    </div>
  );
}

function hasLoopCharacteristics(selection: ModelViewerSelection): boolean {
  return Boolean(selection.businessObject.loopCharacteristics);
}

function getLoopTitle(selection: ModelViewerSelection | null): string {
  if (!selection) {
    return getPaneTitle();
  }
  const loop = selection.businessObject.loopCharacteristics as Record<string, unknown> | undefined;
  if (!loop) {
    return getPaneTitle();
  }
  const loopType = String(loop.$type ?? '');
  if (loopType.includes('StandardLoopCharacteristics')) {
    return 'Standard Loop';
  }
  const isSequential = loop.isSequential === true;
  return isSequential ? 'Multi-Instance (Sequential)' : 'Multi-Instance (Parallel)';
}
