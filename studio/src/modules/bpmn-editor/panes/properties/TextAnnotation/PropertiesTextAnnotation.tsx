import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  OpenInNewTabButton,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
} from '@evil/bifrost_fw_sdk';

import { assertBpmnElementIsTextAnnotation } from '../../BpmnElementTypeAssertionFunctions';
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
  return 'Text Annotation';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  const { studio } = props;

  const editorDocument = props.editorDocument;

  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }

  const selectedElement = selection[0];

  const openTextIcon = (
    <OpenInNewTabButton
      studio={studio}
      type="bpmn.text"
      parentUri={editorDocument.uri}
      fragmentId={selectedElement.id}
      id="text-annotation-open-text-tab"
    />
  );

  return (
    <Pane>
      <PaneHeader studio={studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {openTextIcon}
        <PaneHeaderHelpIcon studio={studio} id="bpmn/properties/text_annotation" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.TextAnnotation);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesTextAnnotation key={getKeyForPropertiesPane(selection)} {...props} />;
}

export function PropertiesTextAnnotation(props: PaneComponentProps): React.JSX.Element {
  const element = props.editorDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsTextAnnotation(element);

  const updateTextAnnotation = (newText: string): void => {
    props.editorDocumentModel.elements.setElementProperty(element.id, 'textAnnotation', newText);
  };

  return (
    <PaneBody>
      <div className="form-group">
        <label>Text</label>
        <PaneProperty
          htmlId="text-annotation-text-property"
          type="textarea"
          label="Text"
          value={element.text}
          onChange={(value: string) => updateTextAnnotation(value)}
        />
      </div>
    </PaneBody>
  );
}
