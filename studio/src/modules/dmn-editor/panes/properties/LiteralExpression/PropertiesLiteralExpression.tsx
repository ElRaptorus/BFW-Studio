import React, { useCallback, useEffect, useState } from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  FeelEditorVariable,
  PaneComponentProps,
  PaneProvider,
} from '@evil/bifrost_fw_sdk';
import {
  FeelEditor,
  FeelExpressionHint,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
} from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getActiveViewElementKey, getDmnModel, shouldBeDisplayedForDmnViewType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Literal Expression';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnViewType(editorDocument, editorDocumentModel, 'literalExpression');
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/literal-expressions" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = getDmnModel(props.editorDocumentModel);
  if (!model) {
    return null;
  }

  return <LiteralExpressionProperties key={getActiveViewElementKey(model)} {...props} />;
}

function LiteralExpressionProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;

  useEffect(() => {
    if (!commands.isRegistered('dmn.feel.getExpressionContext')) {
      return;
    }
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('dmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables)
      .catch(() => setFeelVariables([]));
  }, [editorDocument, commands]);

  const onExpressionChange = useCallback(
    (newText: string): void => {
      model.elements.setLiteralExpressionText(newText);
    },
    [model],
  );

  const literalExpression = model.elements.getActiveViewLiteralExpression();
  if (!literalExpression) {
    return null;
  }

  const decisionElement = model.elements.getActiveViewDecisionElement();
  const variable = decisionElement?.variable;
  const expressionText = literalExpression.text ?? '';
  const typeRef = variable?.typeRef ?? literalExpression.typeRef ?? '';
  const expressionLanguage = literalExpression.expressionLanguage ?? 'FEEL';

  return (
    <PaneBody>
      <PaneProperty
        label="Expression Language"
        type="text"
        value={expressionLanguage}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-le-language': true }}
      />
      <PaneProperty
        label="Output Type"
        type="text"
        value={typeRef}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-le-type-ref': true }}
      />
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Expression
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
          studio={props.studio}
          htmlId="dmn-le-expression-text"
          size="tall"
          fontSize={12}
          initialValue={expressionText}
          onChange={onExpressionChange}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--dmn-le-expression-text': true }}
        />
      </div>
    </PaneBody>
  );
}
