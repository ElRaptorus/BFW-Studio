import React from 'react';

import type { DmnExpressionBody } from '../types/dmnModelTypes';

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

export function getExpressionPreview(expression: DmnExpressionBody | null): string | null {
  if (expression == null) {
    return null;
  }
  if ('text' in expression && typeof expression.text === 'string') {
    return expression.text;
  }
  if (isDecisionTable(expression)) {
    return `${expression.inputs.length} inputs, ${expression.rules.length} rules`;
  }
  return describeExpressionBody(expression);
}

/** Lightweight FEEL token highlighting for table cells. */
export function highlightFeelExpression(text: string): React.ReactNode {
  const parts = text.split(/(\b(?:if|then|else|not|and|or|true|false|null)\b|[+\-*/=<>!&|()[\],:{}"]|\d+(?:\.\d+)?)/g);
  return parts.map((part, index) => {
    if (/^(if|then|else|not|and|or|true|false|null)$/.test(part)) {
      return (
        <span key={index} className="engine-decision-table-viewer__feel-keyword">
          {part}
        </span>
      );
    }
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      return (
        <span key={index} className="engine-decision-table-viewer__feel-number">
          {part}
        </span>
      );
    }
    if (/^["']/.test(part)) {
      return (
        <span key={index} className="engine-decision-table-viewer__feel-string">
          {part}
        </span>
      );
    }
    return part;
  });
}
