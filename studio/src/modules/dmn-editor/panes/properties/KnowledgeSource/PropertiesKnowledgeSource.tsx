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
  return 'Knowledge Source';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdElementOfType(editorDocument, editorDocumentModel, DmnElementType.KnowledgeSource);
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
  if (selection == null || selection.length !== 1) {
    return null;
  }
  return <KnowledgeSourceProperties key={getKeyForDmnPropertiesPane(selection)} {...props} />;
}

function KnowledgeSourceProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const element = model?.selection.getOnlyElementOrNull();
  if (!element) {
    return null;
  }

  const businessObject = element.businessObject;
  const authorityRequirements: any[] = businessObject?.authorityRequirement ?? [];

  const validateIdIsUnique = (newId: string): PropertyValidationResult => {
    const allIds = model.elements.getAllIds();
    const filtered = allIds.filter((id) => id !== element.id);
    return filtered.includes(newId) ? ['ID must be unique'] : [];
  };

  const changeProperty = (propertyName: string, value: any): void => {
    model.elements.setElementProperty(element.id, propertyName, value);
  };

  const authorityRequirementsSummary = authorityRequirements
    .map((requirement: any) => {
      const target =
        requirement.requiredAuthority?.name ??
        requirement.requiredDecision?.name ??
        requirement.requiredInput?.name ??
        requirement.requiredAuthority?.href ??
        requirement.requiredDecision?.href ??
        requirement.requiredInput?.href ??
        '(unknown)';
      return target;
    })
    .join(', ');

  return (
    <PaneBody>
      <PaneProperty
        label="Name"
        type="text"
        value={businessObject?.name ?? ''}
        onCommit={(value: any) => changeProperty('name', value)}
        htmlAttributes={{ 'data-test--dmn-knowledge-source-name': true }}
      />
      <PaneProperty
        label="ID"
        type="text"
        value={element.id}
        onCommit={(value: any) => changeProperty('id', value)}
        onValidate={[validatePropertyNotEmpty('ID must not be empty'), validateIdIsUnique]}
        htmlAttributes={{ 'data-test--dmn-knowledge-source-id': true }}
      />
      <PaneProperty
        label="Type"
        type="text"
        value={businessObject?.type ?? ''}
        onCommit={(value: any) => changeProperty('type', value)}
        htmlAttributes={{ 'data-test--dmn-knowledge-source-type': true }}
      />
      <PaneProperty
        label="Authority Requirements"
        type="text"
        value={authorityRequirementsSummary || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-knowledge-source-authority-requirements': true }}
      />
    </PaneBody>
  );
}
