import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@elraptorus/bfw_studio_sdk';
import { FeelEditor } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsConditionalFlow } from '../../BpmnElementTypeAssertionFunctions';
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
  return 'Conditional Flow';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  const { studio } = props;

  const editorDocument = props.editorDocument;

  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }

  const selectedElement = selection[0];

  const openConditionTabIcon = (
    <OpenInNewTabButton
      studio={studio}
      type="bpmn.sequence-flow.condition"
      parentUri={editorDocument.uri}
      fragmentId={selectedElement.id}
      dataTest="open-sequence-flow-condition-in-new-tab"
    />
  );

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <span className="pane-header__icon">
          <FeelExpressionHint studio={props.studio} />
        </span>
        <span className="pane-header__divider"></span>
        {openConditionTabIcon}
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/conditional_flow" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ConditionalFlow);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesConditionalFlow key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesConditionalFlow(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsConditionalFlow(element);

  const onChange = (newValue: any): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'condition', newValue);
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
        <label>Condition</label>
        <FeelEditor
          size="tall"
          fontSize={12}
          initialValue={element.condition}
          onChange={(value: string) => onChange(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--conditional-flow-condition': true }}
        />
      </div>
    </PaneBody>
  );
}
