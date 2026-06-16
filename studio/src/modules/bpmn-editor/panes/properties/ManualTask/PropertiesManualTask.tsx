import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  Checkbox,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsManualTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const MANUAL_TASK_HELP_ID = 'bpmn/properties/manual_task';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Manual Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id={MANUAL_TASK_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ManualTask);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesManualTask key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesManualTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsManualTask(element);

  const requireConfirmation = element.requireConfirmation ?? false;

  const changeRequireConfirmation = (event): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'manualTask', {
      requireConfirmation: event.target.checked,
    });
  };

  return (
    <PaneBody>
      <div className="form-group">
        <Checkbox
          htmlId="bpmn-manual-task-require-confirmation-checkbox"
          key={requireConfirmation.toString()}
          checked={requireConfirmation}
          onChange={changeRequireConfirmation}
          label="Require Confirmation"
        />
      </div>
    </PaneBody>
  );
}
