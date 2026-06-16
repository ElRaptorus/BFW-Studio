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
  return 'Multi-Instance';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return selection != null && hasMultiInstance(selection);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
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

  const isSequential = loop.isSequential === true;
  const loopCardinality = loop.loopCardinality as Record<string, unknown> | undefined;
  const completionCondition = loop.completionCondition as Record<string, unknown> | undefined;

  const inputCollection = getExtensionValue(loop, ':inputCollection');
  const outputCollection = getExtensionValue(loop, ':outputCollection');
  const loopBreakCondition = getExtensionValue(loop, ':loopBreakCondition');
  const loopInterval = getExtensionValue(loop, ':loopInterval');
  const maxIterations = getExtensionValue(loop, ':maxIterations');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Sequential" value={isSequential ? 'Yes' : 'No'} disabled />
      {loopCardinality != null && (
        <PaneProperty
          type="text"
          label="Loop Cardinality"
          value={String(loopCardinality.body ?? loopCardinality.text ?? '—')}
          disabled
        />
      )}
      {completionCondition != null && (
        <PaneProperty
          type="text"
          label="Completion Condition"
          value={String(completionCondition.body ?? completionCondition.text ?? '—')}
          disabled
        />
      )}
      {inputCollection != null && (
        <PaneProperty type="text" label="Input Collection" value={inputCollection} disabled />
      )}
      {outputCollection != null && (
        <PaneProperty type="text" label="Output Collection" value={outputCollection} disabled />
      )}
      {loopBreakCondition != null && (
        <PaneProperty type="text" label="Loop Break Condition" value={loopBreakCondition} disabled />
      )}
      {loopInterval != null && <PaneProperty type="text" label="Loop Interval" value={loopInterval} disabled />}
      {maxIterations != null && <PaneProperty type="text" label="Max Iterations" value={maxIterations} disabled />}
    </div>
  );
}

function hasMultiInstance(selection: ModelViewerSelection): boolean {
  return Boolean(selection.businessObject.loopCharacteristics);
}
