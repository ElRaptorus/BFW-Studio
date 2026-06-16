import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { DmnExpressionBody, DrgSelection } from '../types/dmnModelTypes';
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

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection || selection.type !== 'decision') {
    return null;
  }

  const parsedModel = getParsedModel(props.editorDocumentModel);
  if (!parsedModel) {
    return null;
  }

  const decision = parsedModel.decisions.find((entry) => entry.id === selection.elementId);
  const expression = decision?.expression;
  if (!decision || !isLiteralExpression(expression)) {
    return null;
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
