import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { LoopCharacteristics } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Subprocess';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel;

  if (!bpmnDocumentModel.elements.isInsideSubprocessPlane()) {
    return false;
  }

  const selection = bpmnDocumentModel.selection.getElements();
  return selection.length === 0;
}

function getLoopCharacteristicsLabel(loopCharacteristics: LoopCharacteristics | undefined): string {
  if (loopCharacteristics == null) {
    return 'None';
  }
  return loopCharacteristics;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const rootElement = bpmnDocumentModel.elements.getCurrentRootElement();
  const subprocessId = rootElement?.businessObject?.id;
  assertNotNull(subprocessId, 'subprocessId');

  const subprocessElement = bpmnDocumentModel.elements.getById(subprocessId);
  assertNotNull(subprocessElement, 'subprocessElement');

  const isAdHoc = subprocessElement.type === BpmnElementType.AdHocSubprocess;
  const adHocElement = isAdHoc ? (subprocessElement as any) : null;

  const navigateToParent = (): void => {
    const canvas = bpmnDocumentModel.modelerAdapter.getCanvas();
    const elementRegistry = bpmnDocumentModel.modelerAdapter.getElementRegistry();
    const subprocessShape = elementRegistry.get(subprocessId);
    if (subprocessShape?.parent != null) {
      canvas.setRootElement(subprocessShape.parent);
    }
  };

  return (
    <PaneBody>
      <PaneProperty
        key={`subprocess-id-${subprocessElement.id}`}
        type="text"
        label="Subprocess ID"
        value={subprocessElement.id}
        disabled={true}
      />
      <PaneProperty
        key={`subprocess-name-${subprocessElement.name}`}
        type="text"
        label="Name"
        value={subprocessElement.name ?? ''}
        disabled={true}
      />
      <PaneProperty
        key={`subprocess-loop-${subprocessElement.loopCharacteristics}`}
        type="text"
        label="Loop"
        value={getLoopCharacteristicsLabel(subprocessElement.loopCharacteristics)}
        disabled={true}
      />
      {isAdHoc && (
        <>
          <PaneProperty
            key={`subprocess-adhoc-ordering-${adHocElement?.ordering}`}
            type="text"
            label="Ordering"
            value={adHocElement?.ordering ?? 'Parallel'}
            disabled={true}
          />
          <PaneProperty
            key={`subprocess-adhoc-completion-${adHocElement?.completionCondition}`}
            type="text"
            label="Completion Condition"
            value={adHocElement?.completionCondition ? adHocElement.completionCondition : '(all activities performed)'}
            disabled={true}
          />
        </>
      )}
      <div className="form-group">
        <button type="button" className="btn btn-sm btn-secondary" onClick={navigateToParent}>
          Back to parent
        </button>
      </div>
    </PaneBody>
  );
}
