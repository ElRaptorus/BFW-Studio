import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsErrorEndEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const ERROR_END_EVENT_HELP_ID = 'bpmn/properties/error_end_event';

type ErrorEventToUpdate = ErrorEventToUpdate_ErrorName | ErrorEventToUpdate_ErrorCode | ErrorEventToUpdate_ErrorMessage;

type ErrorEventToUpdate_ErrorName = {
  errorName: string;
};

type ErrorEventToUpdate_ErrorCode = {
  errorCode: string;
};

type ErrorEventToUpdate_ErrorMessage = {
  errorMessage: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Error End Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={ERROR_END_EVENT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ErrorEndEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesErrorEndEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesErrorEndEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsErrorEndEvent(element);

  const allUniqueErrorCodes = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueErrorCodes',
    [props.editorDocument.uri],
  );

  const allUniqueErrorMessages = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueErrorMessages',
    [props.editorDocument.uri],
  );

  const updateError = (newError: ErrorEventToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'error', newError);
  };

  return (
    <PaneBody>
      <PaneProperty
        key={`element_code_${element.errorCode}`}
        type="text-with-suggestions"
        htmlId="error-end-event-code-property"
        label="Error Code"
        placeholder="Type error code ..."
        value={element.errorCode}
        onCommit={(newValue: any) => updateError({ errorCode: newValue?.value ?? '' })}
        suggestions={allUniqueErrorCodes}
        isClearable={true}
      />
      <PaneProperty
        key={`element_message_${element.errorMessage}`}
        type="text-with-suggestions"
        htmlId="error-end-event-message-property"
        label="Error Message"
        placeholder="Type error message ..."
        value={element.errorMessage}
        onCommit={(newValue: any) => updateError({ errorMessage: newValue?.value ?? '' })}
        suggestions={allUniqueErrorMessages}
        isClearable={true}
      />
    </PaneBody>
  );
}
