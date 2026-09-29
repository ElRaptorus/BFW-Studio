import type { DmnExpressionBody } from '#modules/engine-decision-viewer/types/dmnModelTypes';

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
