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
import { assertBpmnElementIsSignalIntermediateCatchEvent } from '../../BpmnElementTypeAssertionFunctions';
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
  return 'Signal Intermediate Catch Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const { studio } = props;

  return (
    <Pane>
      <PaneHeader studio={studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={studio} id="bpmn/properties/signal_intermediate_catch_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.SignalIntermediateCatchEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesSignalIntermediateCatchEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesSignalIntermediateCatchEvent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsSignalIntermediateCatchEvent(element);

  const onSignalNameChange = (newValue: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'signal', newValue ?? '');
  };

  const allUniqueSignalNamesInProjectPromise = bifrost.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueSignalNames',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        key={`element_signal_name_${element.signal}`}
        type="text-with-suggestions"
        htmlId="signal-intermediate-catch-event-signal-property"
        label="Signal"
        placeholder="Type signal name ..."
        value={element.signal}
        onCommit={onSignalNameChange}
        suggestions={allUniqueSignalNamesInProjectPromise}
        isClearable={true}
      />
    </PaneBody>
  );
}
