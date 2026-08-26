import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForPayloadContractElement,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Payload Contract';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/payload_contract" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForPayloadContractElement(editorDocument, editorDocumentModel);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return (
    <PaneBody>
      <PayloadContractContent key={getKeyForPropertiesPane(selection)} {...props} />
    </PaneBody>
  );
}

function PayloadContractContent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const dataPipeline = bpmnDocumentModel.elements.getElementPropertyValue(element.id, 'dataPipeline') as any;
  const payloadContract = dataPipeline?.payloadContract ?? '';

  const updateContract = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'updateContract',
      contractType: 'payload',
      value,
    });
  };

  return (
    <MultiLineCodeEditor
      studio={props.studio}
      htmlId="data-pipeline-payload-contract"
      initialValue={payloadContract}
      size="tall"
      fontSize={12}
      language="json"
      onChange={updateContract}
      htmlAttributes={{ 'data-test--payload-contract-input': true }}
    />
  );
}
