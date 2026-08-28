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
import { assertBpmnElementIsReceiveTask } from '../../BpmnElementTypeAssertionFunctions';
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
  return 'Receive Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id="bpmn/properties/receive_task" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ReceiveTask);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesReceiveTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesReceiveTask(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsReceiveTask(element);

  const onChange = (newValue: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'message', newValue ?? '');
  };

  const allUniqueMessageNamesInProjectPromise = bifrost.commands.executeCommand<Promise<string[]>>(
    'bpmn.project.getAllUniqueMessageNames',
    [props.editorDocument.uri],
  );

  return (
    <PaneBody>
      <PaneProperty
        type="text-with-suggestions"
        htmlId="receive-task-message-property"
        label="Message"
        placeholder="Type message name ..."
        value={element.message}
        onCommit={onChange}
        suggestions={allUniqueMessageNamesInProjectPromise}
        isClearable={true}
      />
    </PaneBody>
  );
}
