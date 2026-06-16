import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  MultiLineCodeEditor,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsDataObject } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const DATA_OBJECT_HELP_ID = 'bpmn/properties/data_object';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Data Object';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id={DATA_OBJECT_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.DataObject);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesDataObject key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesDataObject(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsDataObject(element);

  return (
    <PaneBody>
      <div className="form-group">
        <label className="d-block">Value Contract (JSON Schema)</label>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="data-object-value-contract"
          initialValue={element.valueContract ?? ''}
          size="tall"
          fontSize={12}
          language="json"
          onChange={(value: string) => {
            bpmnDocumentModel.elements.setElementProperty(element.id, 'dataObject', { valueContract: value });
          }}
          htmlAttributes={{ 'data-test--data-object-value-contract-input': true }}
        />
      </div>
    </PaneBody>
  );
}
