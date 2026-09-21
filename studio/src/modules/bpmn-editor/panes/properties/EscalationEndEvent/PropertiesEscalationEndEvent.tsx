import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsEscalationEndEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const ESCALATION_END_EVENT_HELP_ID = 'bpmn/properties/escalation_end_event';

type EscalationEventToUpdate = EscalationEventToUpdate_Name | EscalationEventToUpdate_EscalationCode;

type EscalationEventToUpdate_Name = {
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
  return 'Escalation End Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={ESCALATION_END_EVENT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.EscalationEndEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesEscalationEndEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesEscalationEndEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsEscalationEndEvent(element);

  const updateEscalation = (escalationToUpdate: EscalationEventToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'escalation', escalationToUpdate);
  };

  const allUniqueEscalationCodes = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationCodes',
    [props.editorDocument.uri],
  );

  const allUniqueEscalationNames = props.studio.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueEscalationNames',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        htmlId="escalation-end-event-code"
        label="Escalation Code"
        type="text-with-suggestions"
        suggestions={allUniqueEscalationCodes}
        value={element.escalationCode}
        onCommit={(newValue: any) => updateEscalation({ escalationCode: newValue?.value ?? newValue ?? '' })}
        isClearable={true}
      />
      <PaneProperty
        htmlId="escalation-end-event-name"
        label="Escalation Name"
        type="text-with-suggestions"
        suggestions={allUniqueEscalationNames}
        placeholder="Type escalation name ..."
        value={element.name}
        onCommit={(newValue: any) => updateEscalation({ name: newValue?.value ?? newValue ?? '' })}
        isClearable={true}
      />
    </PaneBody>
  );
}
