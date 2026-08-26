import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Checkbox } from '#components/Checkbox';
import { LabelWithFeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_Participant, BpmnElement_Process } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import {
  type FeelEditorVariable,
  OneLineFeelEditor,
  PaneProperty,
  type PropertyValidationResult,
  validatePropertyMatching,
  validatePropertyNotEmpty,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { assertBpmnElementIsParticipant } from '../BpmnElementTypeAssertionFunctions';
import { shouldBeDisplayedForBpmnElementOfType } from '../PropertiesPaneFunctions';

const PROCESS_HELP_ID = 'bpmn/properties/process';
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

type ProcessToUpdate =
  | ProcessToUpdate_Name
  | ProcessToUpdate_Version
  | ProcessToUpdate_CorrelationKey
  | ProcessToUpdate_Executable
  | ProcessToUpdate_Id;

type ProcessToUpdate_Name = {
  name: string;
};

type ProcessToUpdate_Version = {
  version: string;
};

type ProcessToUpdate_CorrelationKey = {
  correlationKey: string;
};

type ProcessToUpdate_Executable = {
  isExecutable: boolean;
};

type ProcessToUpdate_Id = {
  id: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFullPropertiesProcess,
  PaneContent: PaneContentPropertiesProcess,
};

function getPaneTitle(): string {
  return 'Process';
}

function PaneFullPropertiesProcess(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id={PROCESS_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContentPropertiesProcess {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel as BpmnDocumentModel;

  if (bpmnDocumentModel.elements.isInsideSubprocessPlane()) {
    return false;
  }

  const selection = bpmnDocumentModel.selection.getElements();

  const visibleElements = bpmnDocumentModel.elements.getVisibleElements();

  const participantExist = visibleElements?.find((element) => element.type === BpmnElementType.Participant);

  if (participantExist == null && selection.length === 0) {
    return true;
  } else {
    const shouldBeDisplayed = shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.Participant,
    );
    if (!shouldBeDisplayed) {
      return false;
    }

    const participant = bpmnDocumentModel.selection.getOnlyElementOrNull() as BpmnElement_Participant;
    return participant.collapsed === false;
  }
}

function PaneContentPropertiesProcess(props: PaneComponentProps): React.JSX.Element | null {
  const editorDocument: EditorDocument = props.editorDocument;
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { commands } = props.studio;
  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || bpmnDocumentModel == null) {
    return null;
  }

  const participant = bpmnDocumentModel.selection.getOnlyElementOrNull();

  let element: BpmnElement_Process;
  if (participant == null) {
    const allElements = bpmnDocumentModel.elements.getByType<BpmnElement_Process>(BpmnElementType.Process);
    assertNotNull(allElements, 'allElements');
    element = allElements[0];
  } else {
    assertBpmnElementIsParticipant(participant);
    // should not be null because the pane content is only displayed if the participant is not collapsed (collapsed is true if the participant has no process)
    assertNotNull(participant.process, 'participant.process');
    element = participant.process;
  }

  const updateProcess = (processToUpdate: ProcessToUpdate): void => {
    const idToUse = participant == null ? element.id : participant.id;
    bpmnDocumentModel.elements.setElementProperty(idToUse, 'process', processToUpdate);
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
    <PaneBody key={element.id}>
      <PaneProperty
        htmlId="process-id-property"
        label="Process ID"
        type="text"
        value={element.id}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: string) => updateProcess({ id: value })}
        onValidate={[
          validatePropertyNotEmpty('ID must not be empty'),
          validatePropertyMatching('ID has to be QName compliant', QNAME_REGEX),
          validateIdIsUnique,
        ]}
      />
      {participant == null && (
        <PaneProperty
          htmlId="process-name-property"
          key={`process-name-${element.name}`}
          label="Process Name"
          type="text"
          value={element.name}
          searchQuery={editorDocument.metadata.searchQuery}
          onCommit={(value: string) => updateProcess({ name: value })}
        />
      )}
      <PaneProperty
        htmlId="process-version-property"
        key={`process-version-${element.version ?? ''}`}
        label="Version"
        type="text"
        value={element.version ?? ''}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: string) => updateProcess({ version: value })}
        onValidate={[validatePropertyNotEmpty('Version is required by the engine')]}
      />
      <div className="form-group" key={`process-correlation-key-${element.correlationKey ?? ''}`}>
        <label className="d-block">
          <LabelWithFeelExpressionHint studio={props.studio} label="Correlation Key" />
        </label>
        <OneLineFeelEditor
          htmlId="process-correlation-key-property"
          initialValue={element.correlationKey ?? ''}
          onChange={(value: string) => updateProcess({ correlationKey: value })}
          variables={feelVariables}
        />
      </div>
      <div className="form-group">
        <Checkbox
          key={`process-executable-${element.isExecutable}`}
          htmlId="process-executable-checkbox"
          checked={element.isExecutable}
          onChange={(event) => updateProcess({ isExecutable: event.target.checked })}
          label="Executable"
        />
      </div>
    </PaneBody>
  );
}
