import React from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  PaneComponentProps,
  PaneProvider,
  PropertyValidationResult,
} from '@evil/bifrost_fw_sdk';
import {
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
  validatePropertyNotEmpty,
} from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DmnElementType } from '../../../DmnElementTypes';
import {
  getDmnSelectionForPropertiesPane,
  getKeyForDmnPropertiesPane,
  shouldBeDisplayedForDmnDrdElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Service';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdElementOfType(editorDocument, editorDocumentModel, DmnElementType.DecisionService);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/decision-services" />
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
  return <DecisionServiceProperties key={getKeyForDmnPropertiesPane(selection)} {...props} />;
}

function resolveRefName(reference: any): string {
  if (!reference) {
    return '(unknown)';
  }
  if (reference.name) {
    return reference.name;
  }
  const href = reference.href ?? reference.$ref ?? '';
  const fragmentIndex = href.indexOf('#');
  return fragmentIndex >= 0 ? href.substring(fragmentIndex + 1) : href || '(unknown)';
}

function DecisionServiceProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const element = model.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const businessObject = element.businessObject;
  const outputDecisions: any[] = businessObject?.outputDecision ?? [];
  const encapsulatedDecisions: any[] = businessObject?.encapsulatedDecision ?? [];
  const inputDecisions: any[] = businessObject?.inputDecision ?? [];
  const inputData: any[] = businessObject?.inputData ?? [];

  const validateIdIsUnique = (newId: string): PropertyValidationResult => {
    const allIds = model.elements.getAllIds();
    const filtered = allIds.filter((id) => id !== element.id);
    return filtered.includes(newId) ? ['ID must be unique'] : [];
  };

  const changeProperty = (propertyName: string, value: any): void => {
    model.elements.setElementProperty(element.id, propertyName, value);
  };

  return (
    <PaneBody>
      <PaneProperty
        label="Name"
        type="text"
        value={businessObject?.name ?? ''}
        onCommit={(value: any) => changeProperty('name', value)}
        htmlAttributes={{ 'data-test--dmn-decision-service-name': true }}
      />
      <PaneProperty
        label="ID"
        type="text"
        value={element.id}
        onCommit={(value: any) => changeProperty('id', value)}
        onValidate={[validatePropertyNotEmpty('ID must not be empty'), validateIdIsUnique]}
        htmlAttributes={{ 'data-test--dmn-decision-service-id': true }}
      />
      <PaneProperty
        label="Output Decisions"
        type="text"
        value={outputDecisions.map(resolveRefName).join(', ') || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-decision-service-output-decisions': true }}
      />
      <PaneProperty
        label="Encapsulated Decisions"
        type="text"
        value={encapsulatedDecisions.map(resolveRefName).join(', ') || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-decision-service-encapsulated-decisions': true }}
      />
      <PaneProperty
        label="Input Decisions"
        type="text"
        value={inputDecisions.map(resolveRefName).join(', ') || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-decision-service-input-decisions': true }}
      />
      <PaneProperty
        label="Input Data"
        type="text"
        value={inputData.map(resolveRefName).join(', ') || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-decision-service-input-data': true }}
      />
    </PaneBody>
  );
}
