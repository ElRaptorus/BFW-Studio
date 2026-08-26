import { assertNotNull } from '#bifrost/common/AssertionFunctions';
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
import { assertBpmnElementIsMessageIntermediateThrowEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Message Intermediate Throw Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const { studio } = props;

  return (
    <Pane>
      <PaneHeader studio={studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={studio} id="bpmn/properties/message_intermediate_throw_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.MessageIntermediateThrowEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesMessageIntermediateThrowEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesMessageIntermediateThrowEvent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsMessageIntermediateThrowEvent(element);

  const changeMessage = (newValue: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'message', newValue ?? '');
  };

  const allUniqueMessageNamesInProjectPromise = bifrost.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueMessageNames',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        key={`element_message_name_${element.message}`}
        type="text-with-suggestions"
        htmlId="message-intermediate-throw-event-message-property"
        label="Message"
        placeholder="Type message name ..."
        value={element.message}
        onCommit={changeMessage}
        suggestions={allUniqueMessageNamesInProjectPromise}
        isClearable={true}
      />
    </PaneBody>
  );
}
