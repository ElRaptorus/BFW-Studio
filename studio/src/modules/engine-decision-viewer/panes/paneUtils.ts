import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { DmnDefinitions, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';
import type { DmnExpressionBody } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import type { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';

export function isDecisionViewerDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-decision://') === true;
}

export function getSelection(model: EditorDocumentModel | null | undefined): DrgSelection | null {
  return (model as DecisionViewerDocumentModel | null)?.getSelectedElement() ?? null;
}

export function getParsedModel(model: EditorDocumentModel | null | undefined): DmnDefinitions | null {
  return (model as DecisionViewerDocumentModel | null)?.getParsedModel() ?? null;
}

export function isDecisionTable(
  expression: DmnExpressionBody | null,
): expression is Extract<DmnExpressionBody, { hitPolicy: string; inputs: unknown[]; rules: unknown[] }> {
  return expression != null && 'hitPolicy' in expression && 'inputs' in expression && 'rules' in expression;
}

export function describeExpressionBody(expression: DmnExpressionBody | null): string {
  if (expression == null) {
    return 'None';
  }
  if (isDecisionTable(expression)) {
    return `Decision Table (${expression.hitPolicy})`;
  }
  if ('text' in expression && typeof expression.text === 'string') {
    return 'Literal Expression';
  }
  if ('contextEntries' in expression) {
    return 'Context';
  }
  if ('calledFunction' in expression) {
    return 'Invocation';
  }
  if ('elements' in expression) {
    return 'List';
  }
  if ('columns' in expression) {
    return 'Relation';
  }
  if ('ifExpression' in expression) {
    return 'Conditional';
  }
  if ('inExpression' in expression && 'matchExpression' in expression) {
    return 'Filter';
  }
  if ('iteratorVariable' in expression && 'returnExpression' in expression) {
    return 'For';
  }
  if ('iteratorVariable' in expression && 'satisfiesExpression' in expression) {
    return 'Every/Some';
  }
  if ('formalParameters' in expression) {
    return 'Function Definition';
  }
  return 'Expression';
}
