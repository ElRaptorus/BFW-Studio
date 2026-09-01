import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useMemo } from 'react';

import type { PropertyValidationResult } from '@evil/bifrost_fw_sdk';
import { PaneProperty, validatePropertyNotEmpty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DmnElementType } from '../../../DmnElementTypes';
import {
  getDmnSelectionForPropertiesPane,
  getKeyForDmnPropertiesPane,
  getTypeRefSuggestions,
  shouldBeDisplayedForDmnDrdElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Input Data Properties';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdElementOfType(editorDocument, editorDocumentModel, DmnElementType.InputData);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/drd" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getDmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <InputDataProperties key={getKeyForDmnPropertiesPane(selection)} {...props} />;
}

function InputDataProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const element = model.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const businessObject = element.businessObject;
  const variable = businessObject?.variable;

  const validateIdIsUnique = (newId: string): PropertyValidationResult => {
    const allIds = model.elements.getAllIds();
    const filtered = allIds.filter((id) => id !== element.id);
    return filtered.includes(newId) ? ['ID must be unique'] : [];
  };

  const changeProperty = (propertyName: string, value: any): void => {
    model.elements.setElementProperty(element.id, propertyName, value);
  };

  const typeRefSuggestions = useMemo(() => Promise.resolve(getTypeRefSuggestions(model)), [model]);

  return (
    <PaneBody>
      <PaneProperty
        label="Name"
        type="text"
        value={businessObject?.name ?? ''}
        onCommit={(value: any) => changeProperty('name', value)}
        htmlAttributes={{ 'data-test--dmn-inputdata-name': true }}
      />
      <PaneProperty
        label="ID"
        type="text"
        value={element.id}
        onCommit={(value: any) => changeProperty('id', value)}
        onValidate={[validatePropertyNotEmpty('ID must not be empty'), validateIdIsUnique]}
        htmlAttributes={{ 'data-test--dmn-inputdata-id': true }}
      />
      <PaneProperty
        label="Variable Name"
        type="text"
        value={variable?.name ?? ''}
        onCommit={(value: any) => changeProperty('variable.name', value)}
        htmlAttributes={{ 'data-test--dmn-inputdata-variable-name': true }}
      />
      <PaneProperty
        htmlId="dmn-inputdata-variable-type-property"
        label="Type"
        type="text-with-suggestions"
        value={variable?.typeRef ?? ''}
        onCommit={(newValue: any) => changeProperty('variable.typeRef', newValue?.value ?? newValue ?? '')}
        suggestions={typeRefSuggestions}
        isClearable={true}
      />
    </PaneBody>
  );
}
