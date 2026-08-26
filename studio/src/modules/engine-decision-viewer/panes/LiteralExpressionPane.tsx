import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { DmnExpressionBody, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Literal Expression';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (selection?.type !== 'decision') {
    return false;
  }

  const decision = findSelectedDecision(editorDocumentModel, selection);
  return isLiteralExpression(decision?.expression);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const selection = getSelection(props.editorDocumentModel);
  assertNotNull(selection, 'selection');

  const parsedModel = getParsedModel(props.editorDocumentModel);
  assertNotNull(parsedModel, 'parsedModel');

  const decision = parsedModel.decisions.find((entry) => entry.id === selection.elementId);
  assertNotNull(decision, 'decision');
  const expression = decision.expression;
  if (!isLiteralExpression(expression)) {
    throw new Error('Unexpected value: expression should be a literal expression here.');
  }

  return (
    <div className="engine-pane-literal-expression">
      <PaneProperty type="text" label="Type" value={decision.variable?.typeRef ?? '—'} disabled />
      <PaneProperty type="textarea" label="FEEL Expression" value={expression.text} disabled rows={4} />
    </div>
  );
}

function isLiteralExpression(
  expression: DmnExpressionBody | null | undefined,
): expression is Extract<DmnExpressionBody, { text: string }> {
  return (
    expression != null &&
    'text' in expression &&
    typeof expression.text === 'string' &&
    !('hitPolicy' in expression) &&
    !('contextEntries' in expression)
  );
}

function findSelectedDecision(editorDocumentModel: EditorDocumentModel | null | undefined, selection: DrgSelection) {
  const parsedModel = getParsedModel(editorDocumentModel);
  if (!parsedModel) {
    return null;
  }
  return parsedModel.decisions.find((entry) => entry.id === selection.elementId) ?? null;
}
