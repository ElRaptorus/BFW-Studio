import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';
import { FeelEditor, PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import {
  getActiveViewElementKey,
  getDmnModel,
  getTypeRefSuggestions,
  shouldBeDisplayedForDmnViewType,
} from '../../PropertiesPaneFunctions';

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
  if (!model || !model.isReadyForInteraction()) {
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

  const decisionElement = model.elements.getActiveViewDecisionElement();
  const decisionElementId = decisionElement?.id as string | undefined;

  const onOutputTypeCommit = useCallback(
    (newValue: any): void => {
      if (!decisionElementId) {
        return;
      }
      model.elements.setElementProperty(decisionElementId, 'variable.typeRef', newValue?.value ?? newValue ?? '');
    },
    [model, decisionElementId],
  );

  const typeRefSuggestions = useMemo(() => Promise.resolve(getTypeRefSuggestions(model)), [model]);

  const literalExpression = model.elements.getActiveViewLiteralExpression();
  if (!literalExpression) {
    return null;
  }

  const variable = decisionElement?.variable;
  const expressionText = literalExpression.text ?? '';
  const typeRef = variable?.typeRef ?? literalExpression.typeRef ?? '';

  return (
    <PaneBody>
      <PaneProperty
        htmlId="dmn-le-type-ref-property"
        label="Output Type"
        type="text-with-suggestions"
        value={typeRef}
        onCommit={onOutputTypeCommit}
        suggestions={typeRefSuggestions}
        isClearable={true}
      />
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Expression
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
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
