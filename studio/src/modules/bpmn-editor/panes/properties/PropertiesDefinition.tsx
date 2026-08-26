import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_Definition } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type { PropertyValidationResult } from '@evil/bifrost_fw_sdk';
import { PaneProperty, validatePropertyMatching, validatePropertyNotEmpty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';

const DEFINITION_HELP_ID = 'bpmn/properties/definition';
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Definition';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id={DEFINITION_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel;

  if (bpmnDocumentModel.elements.isInsideSubprocessPlane()) {
    return false;
  }

  const selection = bpmnDocumentModel.selection.getElements();
  if (selection.length === 0) {
    return true;
  }

  return false;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const editorDocument: EditorDocument = props.editorDocument;
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;

  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || bpmnDocumentModel == null) {
    return null;
  }

  const allDefinitions = bpmnDocumentModel.elements.getByType<BpmnElement_Definition>(BpmnElementType.Definition);
  assertNotNull(allDefinitions, 'allDefinitions');
  const element: BpmnElement_Definition = allDefinitions[0];

  const updateDefinitionId = (newId: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'definition', newId);
  };

  const validateIdIsUnique = (newId: string): PropertyValidationResult => {
    const allIds = bpmnDocumentModel.elements.getAllIds();
    const allIdsExceptPreviousOwnId = allIds.filter((id) => id !== element.id);

    if (allIdsExceptPreviousOwnId.includes(newId)) {
      return ['ID has to be unique'];
    } else {
      return [];
    }
  };

  return (
    <PaneBody>
      <PaneProperty
        key={`definition_id_${element.id}`}
        type="text"
        label="Definition ID"
        value={element.id}
        onCommit={(value: string) => updateDefinitionId(value)}
        htmlAttributes={{ 'data-test--definition-id-property': true }}
        onValidate={[
          validatePropertyNotEmpty('ID must not be empty'),
          validatePropertyMatching('ID has to be QName compliant', QNAME_REGEX),
          validateIdIsUnique,
        ]}
      />
      <PaneProperty
        key={`exporter_${element.id}`}
        type="text"
        label="Exported by"
        value={element.exporter ?? ''}
        disabled={true}
        htmlAttributes={{ 'data-test--exporter-property': true }}
      />
      <PaneProperty
        key={`exporter_version_${element.id}`}
        type="text"
        label="Exporter Version"
        value={element.exporterVersion ?? ''}
        disabled={true}
        htmlAttributes={{ 'data-test--exporter-version-property': true }}
      />
    </PaneBody>
  );
}
