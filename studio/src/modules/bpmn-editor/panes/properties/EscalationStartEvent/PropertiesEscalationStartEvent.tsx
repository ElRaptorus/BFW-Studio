import React from 'react';

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
import { assertBpmnElementIsEscalationStartEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

type EscalationEventToUpdate =
  EscalationEventToUpdate_Name | EscalationEventToUpdate_EscalationCode | EscalationEventToUpdate_Variable;

type EscalationEventToUpdate_Name = {
  name: string;
};

type EscalationEventToUpdate_EscalationCode = {
  escalationCode: string;
};

type EscalationEventToUpdate_Variable = {
  variable: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Escalation Start Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/escalation_start_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.EscalationStartEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesEscalationStartEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesEscalationStartEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsEscalationStartEvent(element);

  const updateEscalation = (escalationToUpdate: EscalationEventToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'escalation', escalationToUpdate);
  };

  const allUniqueNames = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationNames',
    [props.editorDocument.uri],
  );

  const allUniqueEscalationCodes = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationCodes',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        key={`escalation-name_${element.name}`}
        htmlId="escalation-start-event-name"
        label="Name"
        type="text-with-suggestions"
        suggestions={allUniqueNames}
        value={element.name}
        onCommit={(newValue: any) => updateEscalation({ name: newValue?.value ?? '' })}
        isClearable={true}
      />
      <PaneProperty
        key={`escalation-code_${element.escalationCode}`}
        htmlId="escalation-start-event-code"
        label="Escalation Code"
        type="text-with-suggestions"
        suggestions={allUniqueEscalationCodes}
        value={element.escalationCode}
        onCommit={(newValue: any) => updateEscalation({ escalationCode: newValue?.value ?? '' })}
        isClearable={true}
      />
    </PaneBody>
  );
}
