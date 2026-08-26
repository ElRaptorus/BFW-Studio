import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';
import type { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';
import { isModelViewerDocument } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Subprocess';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const model = editorDocumentModel as ModelViewerDocumentModel | null;
  if (model == null || !model.isInsideSubprocessPlane()) {
    return false;
  }
  return model.getSelectedElement() == null;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as ModelViewerDocumentModel | null;
  assertNotNull(model, 'model');

  const rootElement = model.getCurrentRootElement();
  const businessObject = rootElement?.businessObject;
  assertNotNull(businessObject, 'businessObject');

  const subprocessId: string = businessObject.id ?? '';
  const subprocessName: string = businessObject.name ?? '(unnamed)';

  const loopCharacteristics = businessObject.loopCharacteristics;
  let loopLabel = 'None';
  if (loopCharacteristics != null) {
    if (loopCharacteristics.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
      loopLabel = loopCharacteristics.isSequential ? 'Sequential Multi-Instance' : 'Parallel Multi-Instance';
    } else {
      loopLabel = 'Standard Loop';
    }
  }

  const isAdHoc = businessObject.$type === 'bpmn:AdHocSubProcess';
  const adHocOrdering = isAdHoc ? (businessObject.ordering ?? 'Parallel') : null;
  const adHocCompletionCondition = isAdHoc ? (businessObject.completionCondition?.body ?? null) : null;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Subprocess ID" value={subprocessId} disabled />
      <PaneProperty type="text" label="Name" value={subprocessName} disabled />
      <PaneProperty type="text" label="Loop" value={loopLabel} disabled />
      {isAdHoc && (
        <>
          <PaneProperty type="text" label="Ordering" value={adHocOrdering} disabled />
          <PaneProperty
            type="text"
            label="Completion Condition"
            value={adHocCompletionCondition ?? '(all activities performed)'}
            disabled
          />
        </>
      )}
      <div className="form-group">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => props.studio.commands.executeCommand(MODEL_VIEWER_COMMANDS.drillUp)}
        >
          Back to parent
        </button>
      </div>
    </PaneBody>
  );
}
