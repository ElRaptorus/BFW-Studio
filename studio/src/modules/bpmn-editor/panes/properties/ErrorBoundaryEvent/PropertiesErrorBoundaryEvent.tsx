import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_ErrorBoundaryEvent } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsErrorBoundaryEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

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

type ErrorEventPropertiesRendererProps = {
  element: BpmnElement_ErrorBoundaryEvent;
  bpmnDocumentModel: BpmnDocumentModel;
  errorCodes: Promise<string[]>;
  errorMessages: Promise<string[]>;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Error Boundary Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/error_boundary_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ErrorBoundaryEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesErrorBoundaryEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesErrorBoundaryEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsErrorBoundaryEvent(element);

  const allUniqueErrorCodes = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueErrorCodes',
    [props.editorDocument.uri],
  );

  const allUniqueErrorMessages = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueErrorMessages',
    [props.editorDocument.uri],
  );

  return (
    <ErrorEventPropertiesRenderer
      element={element}
      bpmnDocumentModel={bpmnDocumentModel}
      errorCodes={allUniqueErrorCodes}
      errorMessages={allUniqueErrorMessages}
    />
  );
}

class ErrorEventPropertiesRenderer extends React.Component<ErrorEventPropertiesRendererProps, any> {
  constructor(props: ErrorEventPropertiesRendererProps) {
    super(props);

    this.state = {
      matchAllErrors: this.matchAllErrors(),
    };
  }

  render(): React.JSX.Element {
    const element = this.props.element;

    const updateError = (newError: ErrorEventToUpdate): void => {
      this.props.bpmnDocumentModel.elements.setElementProperty(element.id, 'error', newError);
    };

    const matchAllErrorsChanged = (value: boolean): void => {
      if (value === true) {
        updateError({
          errorCode: '',
          errorMessage: '',
        });
        this.setState({ matchAllErrors: true });
      } else {
        this.setState({ matchAllErrors: false });
      }
    };

    return (
      <PaneBody>
        <fieldset className="form-group d-flex flex-column">
          <div className="form-check form-check-inline">
            <input
              type="radio"
              id="error-boundary-event-match-all-errors"
              className="form-check-input"
              name="optionsRadios"
              defaultChecked={this.matchAllErrors()}
              onClick={() => matchAllErrorsChanged(true)}
              data-test--error-end-event-match-all-radio
            />
            <label className="form-check-label" htmlFor="error-boundary-event-match-all-errors">
              Match all errors
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              type="radio"
              id="error-boundary-event-match-a-specific-error"
              className="form-check-input"
              name="optionsRadios"
              defaultChecked={!this.matchAllErrors()}
              onClick={() => matchAllErrorsChanged(false)}
              data-test--error-boundary-event-specific-error-radio
            />
            <label className="form-check-label" htmlFor="error-boundary-event-match-a-specific-error">
              Match a specific error
            </label>
          </div>
        </fieldset>

        {!this.state.matchAllErrors && (
          <fieldset>
            <PaneProperty
              label="Error Code"
              type="text-with-suggestions"
              htmlId="error-boundary-event-code-property"
              placeholder="Type error code ..."
              value={element.errorCode}
              onCommit={(newValue: any) => updateError({ errorCode: newValue?.value ?? '' })}
              suggestions={this.props.errorCodes}
              isClearable={true}
            />

            <PaneProperty
              label="Error Message"
              type="text-with-suggestions"
              htmlId="error-boundary-event-message-property"
              placeholder="Type error message ..."
              value={element.errorMessage}
              onCommit={(newValue: any) => updateError({ errorMessage: newValue?.value ?? '' })}
              suggestions={this.props.errorMessages}
              isClearable={true}
            />
          </fieldset>
        )}
      </PaneBody>
    );
  }

  private matchAllErrors(): boolean {
    const matchAllErrors =
      (this.props.element.errorCode == null || this.props.element.errorCode.trim() === '') &&
      (this.props.element.errorMessage == null || this.props.element.errorMessage.trim() === '');

    return matchAllErrors;
  }
}
