import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { BpmnElementColorPicker, generateRandomColor } from '#components/BpmnElementColorPicker';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type { PropertyValidationResult, SelectOption } from '@evil/bifrost_fw_sdk';
import { PaneProperty, validatePropertyMatching, validatePropertyNotEmpty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { getBpmnSelectionForPropertiesPane, getKeyForPropertiesPane } from '../PropertiesPaneFunctions';

const ELEMENTS_WITHOUT_NAME_PROPERTY: string[] = [BpmnElementType.TextAnnotation, BpmnElementType.Group];
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Basic Properties';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id="bpmn/properties/basic" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel as BpmnDocumentModel;
  const selection = bpmnDocumentModel.selection.getElements();

  return selection.length === 1;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesBasic key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesBasic(props: PaneComponentProps): React.JSX.Element | null {
  const { editorDocument } = props;
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;

  const element = bpmnDocumentModel?.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const hasName = ELEMENTS_WITHOUT_NAME_PROPERTY.includes(element.type) === false;
  const elementColor = bpmnDocumentModel.elements.getColor(element.id);

  const validateIdIsUnique = (newId: string): PropertyValidationResult => {
    const allIds = bpmnDocumentModel.elements.getAllIds();
    const allIdsExceptPreviousOwnId = allIds.filter((id) => id !== element.id);

    if (allIdsExceptPreviousOwnId.includes(newId)) {
      return ['ID has to be unique'];
    } else {
      return [];
    }
  };

  const onElementColorChange = (newValue: SelectOption): void => {
    const colorOrString = newValue.value;
    if (colorOrString === 'custom') {
      /**
       * We have to keep this in mind when letting the user define colors himself.
       * If someone defines a color that happens to correspond to this color,
       * we will only be able to change it to "custom" by deleting it first.
       */
      bpmnDocumentModel.elements.setColor(element.id, {
        backgroundColor: generateRandomColor(),
        borderColor: generateRandomColor(),
      });
    } else if (colorOrString === 'no_color') {
      bpmnDocumentModel.elements.setColor(element.id, null);
    } else {
      bpmnDocumentModel.elements.setColor(element.id, newValue.value);
    }
  };

  const setBackgroundColor = (backgroundColor: string): void => {
    bpmnDocumentModel.elements.setBackgroundColor(element.id, backgroundColor);
  };

  const setBorderColor = (borderColor: string): void => {
    bpmnDocumentModel.elements.setBorderColor(element.id, borderColor);
  };

  const changeProperty = (name: string, value: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, name, value);
  };

  return (
    <PaneBody key={`element_id_${element.id}`}>
      <PaneProperty
        htmlId="element-id-property"
        label="Element ID"
        type="text"
        value={element.id}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: any) => changeProperty('id', value)}
        onValidate={[
          validatePropertyNotEmpty('ID must not be empty'),
          validatePropertyMatching('ID has to be QName compliant', QNAME_REGEX),
          validateIdIsUnique,
        ]}
        htmlAttributes={{ 'data-test--element-id-property': element.id }}
      />
      {hasName && (
        <PaneProperty
          key={`element_name_${element.name}`}
          label="Element Name"
          type="text"
          value={element.name}
          searchQuery={editorDocument.metadata.searchQuery}
          onCommit={(value: any) => changeProperty('name', value)}
          htmlAttributes={{ 'data-test--element-name-property': true }}
        />
      )}

      <BpmnElementColorPicker
        initialColor={elementColor}
        onElementColorChange={onElementColorChange}
        setBorderColor={setBorderColor}
        setBackgroundColor={setBackgroundColor}
        studio={props.studio}
      />
    </PaneBody>
  );
}
