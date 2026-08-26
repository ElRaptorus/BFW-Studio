import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getExpressionTypeLabel } from '../../../DmnElementTypes';
import { getActiveViewElementKey, getDmnModel, shouldBeDisplayedForDmnViewType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Boxed Expression';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnViewType(editorDocument, editorDocumentModel, 'boxedExpression');
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/boxed-expressions" />
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

  return <BoxedExpressionProperties key={getActiveViewElementKey(model)} {...props} />;
}

const MODDLE_TYPE_TO_EXPRESSION_TYPE: Record<string, string> = {
  'dmn:Context': 'context',
  'dmn:Invocation': 'invocation',
  'dmn:List': 'list',
  'dmn:Relation': 'relation',
  'dmn:Conditional': 'conditional',
  'dmn:Filter': 'filter',
  'dmn:For': 'for',
  'dmn:Every': 'every',
  'dmn:Some': 'some',
  'dmn:FunctionDefinition': 'functionDefinition',
};

function BoxedExpressionProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const expressionInfo = model.elements.getActiveViewExpression();
  if (!expressionInfo) {
    return null;
  }

  const decisionElement = model.elements.getActiveViewDecisionElement();
  const variable = decisionElement?.variable;
  const expressionType = MODDLE_TYPE_TO_EXPRESSION_TYPE[expressionInfo.type] ?? 'none';
  const expressionTypeLabel = getExpressionTypeLabel(expressionType as any);
  const outputType = variable?.typeRef ?? '';

  const contextEntries = expressionInfo.businessObject?.contextEntry;
  const invocationCalledFunction = expressionInfo.businessObject?.calledExpression?.text;
  const invocationBindings = expressionInfo.businessObject?.binding;
  const listElements = expressionInfo.businessObject?.expression;
  const relationColumns = expressionInfo.businessObject?.column;
  const iteratorVariable = expressionInfo.businessObject?.iteratorVariable;

  return (
    <PaneBody>
      <PaneProperty
        label="Expression Type"
        type="text"
        value={expressionTypeLabel}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-be-expression-type': true }}
      />
      <PaneProperty
        label="Output Type"
        type="text"
        value={outputType}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-be-output-type': true }}
      />

      {expressionType === 'context' && contextEntries && (
        <PaneProperty
          label="Context Entries"
          type="text"
          value={String(contextEntries.length)}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-context-entry-count': true }}
        />
      )}

      {expressionType === 'invocation' && invocationCalledFunction && (
        <PaneProperty
          label="Called Function"
          type="text"
          value={invocationCalledFunction}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-invocation-function': true }}
        />
      )}

      {expressionType === 'invocation' && invocationBindings && (
        <PaneProperty
          label="Bindings"
          type="text"
          value={String(invocationBindings.length)}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-invocation-binding-count': true }}
        />
      )}

      {expressionType === 'list' && Array.isArray(listElements) && (
        <PaneProperty
          label="Elements"
          type="text"
          value={String(listElements.length)}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-list-element-count': true }}
        />
      )}

      {expressionType === 'relation' && relationColumns && (
        <PaneProperty
          label="Columns"
          type="text"
          value={String(relationColumns.length)}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-relation-column-count': true }}
        />
      )}

      {(expressionType === 'for' || expressionType === 'every' || expressionType === 'some') && iteratorVariable && (
        <PaneProperty
          label="Iterator Variable"
          type="text"
          value={iteratorVariable}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-be-iterator-variable': true }}
        />
      )}
    </PaneBody>
  );
}
