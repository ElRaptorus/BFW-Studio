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
import { assertBpmnElementIsSignalEndEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const SIGNAL_END_EVENT_HELP_ID = 'bpmn/properties/signal_end_event';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Signal End Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const { studio } = props;

  return (
    <Pane>
      <PaneHeader studio={studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={studio} id={SIGNAL_END_EVENT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalEndEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesSignalEndEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesSignalEndEvent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsSignalEndEvent(element);

  const onChangeSignal = (newValue: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'signal', newValue ?? '');
  };

  const allUniqueSignalNamesInProjectPromise = bifrost.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueSignalNames',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        type="text-with-suggestions"
        htmlId="signal-end-event-signal-property"
        label="Signal"
        placeholder="Type signal name ..."
        value={element.signal}
        onCommit={onChangeSignal}
        suggestions={allUniqueSignalNamesInProjectPromise}
        isClearable={true}
      />
    </PaneBody>
  );
}
