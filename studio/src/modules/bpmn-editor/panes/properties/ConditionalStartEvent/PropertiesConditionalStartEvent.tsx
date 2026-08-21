import React, { useEffect, useState } from 'react';

import type { EditorDocument, FeelEditorVariable, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  FeelEditor,
  FeelExpressionHint,
  OpenInNewTabButton,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsConditionalStartEvent } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

type ConditionalEventToUpdate =
  ConditionalEventToUpdate_Condition | ConditionalEventToUpdate_VariableName | ConditionalEventToUpdate_VariableEvent;

type ConditionalEventToUpdate_Condition = {
  condition: string;
};

type ConditionalEventToUpdate_VariableName = {
  variableName: string;
};

type ConditionalEventToUpdate_VariableEvent = {
  variableEvent: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Conditional Start Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/conditional_start_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.ConditionalStartEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesConditionalStartEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesConditionalStartEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsConditionalStartEvent(element);

  const updateConditionalEvent = (conditionToUpdate: ConditionalEventToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'conditionalEvent', conditionToUpdate);
  };

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;
  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  return (
    <PaneBody>
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Condition{' '}
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
            <OpenInNewTabButton
              studio={props.studio}
              type="bpmn.conditional-event"
              parentUri={props.editorDocument.uri}
              fragmentId={element.id}
              dataTest="open-conditional-start-event-condition-new-tab"
            />
          </span>
        </label>

        <FeelEditor
          studio={props.studio}
          size="medium"
          fontSize={12}
          initialValue={element.condition}
          onChange={(value: string) => updateConditionalEvent({ condition: value })}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--conditional-start-event-condition': true }}
        />
      </div>
    </PaneBody>
  );
}
