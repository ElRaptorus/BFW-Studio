import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DmnElementType } from '../../../DmnElementTypes';
import {
  getDmnSelectionForPropertiesPane,
  getKeyForDmnPropertiesPane,
  shouldBeDisplayedForDmnDrdElementOfTypes,
} from '../../PropertiesPaneFunctions';

const REQUIREMENT_ELEMENT_TYPES = [DmnElementType.Decision, DmnElementType.BusinessKnowledgeModel];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Requirements';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdElementOfTypes(editorDocument, editorDocumentModel, REQUIREMENT_ELEMENT_TYPES);
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
  return <RequirementsProperties key={getKeyForDmnPropertiesPane(selection)} {...props} />;
}

function resolveRequirementTarget(requirement: any, targetProperty: string): string {
  const target = requirement?.[targetProperty];
  if (!target) {
    return '(unknown)';
  }
  if (target.name) {
    return target.name;
  }
  const href = target.href ?? target.$ref ?? '';
  const fragmentIndex = href.indexOf('#');
  return fragmentIndex >= 0 ? href.substring(fragmentIndex + 1) : href || '(unknown)';
}

function RequirementsProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const element = model.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const informationRequirements: any[] = model.elements.getInformationRequirements(element.id);
  const knowledgeRequirements: any[] = model.elements.getKnowledgeRequirements(element.id);
  const authorityRequirements: any[] = model.elements.getAuthorityRequirements(element.id);

  const informationRequirementsSummary = informationRequirements
    .map((requirement: any) => {
      if (requirement.requiredDecision) {
        return `Decision: ${resolveRequirementTarget(requirement, 'requiredDecision')}`;
      }
      if (requirement.requiredInput) {
        return `Input: ${resolveRequirementTarget(requirement, 'requiredInput')}`;
      }
      return '(unknown)';
    })
    .join('\n');

  const knowledgeRequirementsSummary = knowledgeRequirements
    .map((requirement: any) => resolveRequirementTarget(requirement, 'requiredKnowledge'))
    .join('\n');

  const authorityRequirementsSummary = authorityRequirements
    .map((requirement: any) => {
      if (requirement.requiredAuthority) {
        return `Authority: ${resolveRequirementTarget(requirement, 'requiredAuthority')}`;
      }
      if (requirement.requiredDecision) {
        return `Decision: ${resolveRequirementTarget(requirement, 'requiredDecision')}`;
      }
      if (requirement.requiredInput) {
        return `Input: ${resolveRequirementTarget(requirement, 'requiredInput')}`;
      }
      return '(unknown)';
    })
    .join('\n');

  return (
    <PaneBody>
      <PaneProperty
        label={`Information Requirements (${informationRequirements.length})`}
        type="text"
        value={informationRequirementsSummary || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-info-requirements': true }}
      />
      <PaneProperty
        label={`Knowledge Requirements (${knowledgeRequirements.length})`}
        type="text"
        value={knowledgeRequirementsSummary || '(none)'}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-knowledge-requirements': true }}
      />
      {authorityRequirements.length > 0 && (
        <PaneProperty
          label={`Authority Requirements (${authorityRequirements.length})`}
          type="text"
          value={authorityRequirementsSummary}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-authority-requirements': true }}
        />
      )}
    </PaneBody>
  );
}
