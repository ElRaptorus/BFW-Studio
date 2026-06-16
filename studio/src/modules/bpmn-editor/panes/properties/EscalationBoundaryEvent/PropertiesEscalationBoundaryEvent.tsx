import React, { useState } from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsEscalationBoundaryEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

type EscalationEventToUpdate = EscalationEventToUpdate_EscalationName | EscalationEventToUpdate_EscalationCode;

type EscalationEventToUpdate_EscalationName = {
  name: string;
};

type EscalationEventToUpdate_EscalationCode = {
  escalationCode: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Escalation Boundary Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/escalation_boundary_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.EscalationBoundaryEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesEscalationBoundaryEvent key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesEscalationBoundaryEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsEscalationBoundaryEvent(element);

  const allUniqueEscalationCodes = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationCodes',
    [props.editorDocument.uri],
  );

  const allUniqueEscalationNames = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationNames',
    [props.editorDocument.uri],
  );

  return (
    <EscalationEventPropertiesRenderer
      key={`element_code_${element.escalationCode}_element_name_${element.name}`}
      element={element}
      bpmnDocumentModel={bpmnDocumentModel}
      escalationCodes={allUniqueEscalationCodes}
      escalationNames={allUniqueEscalationNames}
    />
  );
}

const EscalationEventPropertiesRenderer = (props) => {
  const { element, bpmnDocumentModel, escalationCodes, escalationNames } = props;

  const [matchAllEscalations, setMatchAllEscalations] = useState(() => {
    return (
      (element.escalationCode == null || element.escalationCode.trim() === '') &&
      (element.name == null || element.name.trim() === '')
    );
  });

  const updateEscalation = (newEscalation: EscalationEventToUpdate) => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'escalation', newEscalation);
  };

  const matchAllEscalationsChanged = (value) => {
    if (value) {
      updateEscalation({
        escalationCode: '',
        name: '',
      });
      setMatchAllEscalations(true);
    } else {
      setMatchAllEscalations(false);
    }
  };

  return (
    <PaneBody>
      <fieldset className="form-group d-flex flex-column">
        <div className="form-check form-check-inline">
          <input
            type="radio"
            id="escalation-boundary-event-match-all-escalations"
            className="form-check-input"
            name="optionsRadios"
            defaultChecked={matchAllEscalations}
            onClick={() => matchAllEscalationsChanged(true)}
            data-test--escalation-end-event-match-all-radio
          />
          <label className="form-check-label" htmlFor="escalation-boundary-event-match-all-escalations">
            Match all escalations
          </label>
        </div>
        <div className="form-check form-check-inline">
          <input
            type="radio"
            id="escalation-boundary-event-match-a-specific-escalation"
            className="form-check-input"
            name="optionsRadios"
            defaultChecked={!matchAllEscalations}
            onClick={() => matchAllEscalationsChanged(false)}
            data-test--escalation-boundary-event-specific-escalation-radio
          />
          <label className="form-check-label" htmlFor="escalation-boundary-event-match-a-specific-escalation">
            Match a specific escalation
          </label>
        </div>
      </fieldset>

      {!matchAllEscalations && (
        <fieldset>
          <PaneProperty
            key={`escalation-code_${element.escalationCode}`}
            htmlId="escalation-boundary-event-code"
            label="Escalation Code"
            type="text-with-suggestions"
            suggestions={escalationCodes}
            value={element.escalationCode}
            onCommit={(newValue) => updateEscalation({ escalationCode: newValue?.value ?? '' })}
            isClearable={true}
          />
          <PaneProperty
            key={`escalation-name_${element.name}`}
            htmlId="escalation-boundary-event-name"
            label="Escalation Name"
            type="text-with-suggestions"
            suggestions={escalationNames}
            placeholder="Type escalation name ..."
            value={element.name}
            onCommit={(newValue) => updateEscalation({ name: newValue?.value ?? '' })}
            isClearable={true}
          />
        </fieldset>
      )}
    </PaneBody>
  );
};
