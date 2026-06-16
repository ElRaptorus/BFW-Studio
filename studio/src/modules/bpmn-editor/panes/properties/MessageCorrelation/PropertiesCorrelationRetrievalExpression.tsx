import React, { useEffect, useState } from 'react';

import type { EditorDocument, FeelEditorVariable, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  LabelWithFeelExpressionHint,
  OneLineFeelEditor,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  isMessageThrowEventType,
} from '../../PropertiesPaneFunctions';

const HELP_ID = 'bpmn/properties/correlation_retrieval_expression';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Correlation Retrieval Expression';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return isMessageThrowEventType(editorDocument, editorDocumentModel);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <CorrelationRetrievalExpression key={getKeyForPropertiesPane(selection)} {...props} />;
}

function CorrelationRetrievalExpression(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const currentValue =
    (bpmnDocumentModel.elements.getElementPropertyValue(element.id, 'correlationRetrievalExpression') as string) ?? '';

  const onChange = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'correlationRetrievalExpression', value || null);
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
        <label className="d-block">
          <LabelWithFeelExpressionHint studio={props.studio} label="Correlation Retrieval Expression" />
        </label>
        <OneLineFeelEditor
          studio={props.studio}
          htmlId="correlation-retrieval-expression-property"
          initialValue={currentValue}
          onChange={onChange}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--correlation-retrieval-expression-input': true }}
          placeholder="payload.orderId"
        />
      </div>
    </PaneBody>
  );
}
