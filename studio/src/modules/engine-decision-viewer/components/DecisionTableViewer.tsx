import type { DmnDecision } from '#modules/engine-decision-viewer/types/dmnModelTypes';
import type { DmnExpressionBody } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import React from 'react';

import './DecisionTableViewer.scss';

interface DecisionTableViewerProps {
  decision: DmnDecision;
}

function isDecisionTable(
  expression: DmnExpressionBody | null,
): expression is Extract<DmnExpressionBody, { hitPolicy: string; inputs: unknown[]; rules: unknown[] }> {
  return expression != null && 'hitPolicy' in expression && 'inputs' in expression && 'rules' in expression;
}

function highlightFeelExpression(text: string): React.ReactNode {
  const tokenizer = /(\b(?:if|then|else|not|and|or|true|false|null)\b|[+\-*/=<>!&|()[\],:{}"]|\d+(?:\.\d+)?)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenizer.exec(text);

  while (match != null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const part = match[0];
    const offset = match.index;
    if (/^(if|then|else|not|and|or|true|false|null)$/.test(part)) {
      nodes.push(
        <span key={`kw-${offset}`} className="engine-decision-table-viewer__feel-keyword">
          {part}
        </span>,
      );
    } else if (/^\d+(?:\.\d+)?$/.test(part)) {
      nodes.push(
        <span key={`num-${offset}`} className="engine-decision-table-viewer__feel-number">
          {part}
        </span>,
      );
    } else if (/^["']/.test(part)) {
      nodes.push(
        <span key={`str-${offset}`} className="engine-decision-table-viewer__feel-string">
          {part}
        </span>,
      );
    } else {
      nodes.push(part);
    }

    lastIndex = match.index + part.length;
    match = tokenizer.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function DecisionTableViewer({ decision }: DecisionTableViewerProps): React.JSX.Element | null {
  const expression = decision.expression;
  if (!isDecisionTable(expression)) {
    return (
      <div className="engine-decision-table-viewer engine-decision-table-viewer--no-table">
        This decision does not contain a decision table.
      </div>
    );
  }

  return (
    <div className="engine-decision-table-viewer">
      <div className="engine-decision-table-viewer__header">
        <span className="engine-decision-table-viewer__hit-policy">{expression.hitPolicy}</span>
        <span className="engine-decision-table-viewer__meta">
          {expression.inputs.length} inputs · {expression.outputs.length} outputs · {expression.rules.length} rules
        </span>
      </div>

      <div className="engine-decision-table-viewer__section">
        <div className="engine-decision-table-viewer__section-title">Input Columns</div>
        <table className="engine-decision-table-viewer__columns-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Expression</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {expression.inputs.map((input) => (
              <tr key={input.id}>
                <td>{input.label ?? '—'}</td>
                <td className="engine-decision-table-viewer__feel-cell">
                  {input.inputExpression ? highlightFeelExpression(input.inputExpression) : '—'}
                </td>
                <td>{input.typeRef ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="engine-decision-table-viewer__section">
        <div className="engine-decision-table-viewer__section-title">Output Columns</div>
        <table className="engine-decision-table-viewer__columns-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Label</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {expression.outputs.map((output) => (
              <tr key={output.id}>
                <td>{output.name ?? '—'}</td>
                <td>{output.label ?? '—'}</td>
                <td>{output.typeRef ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="engine-decision-table-viewer__section">
        <div className="engine-decision-table-viewer__section-title">Rules</div>
        <div className="engine-decision-table-viewer__rules-scroll">
          <table className="engine-decision-table-viewer__rules-table">
            <thead>
              <tr>
                <th>#</th>
                {expression.inputs.map((input) => (
                  <th key={input.id}>{input.label ?? input.id}</th>
                ))}
                {expression.outputs.map((output) => (
                  <th key={output.id}>{output.label ?? output.name ?? output.id}</th>
                ))}
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {expression.rules.map((rule, ruleIndex) => (
                <tr key={rule.id}>
                  <td>{ruleIndex + 1}</td>
                  {rule.inputEntries.map((entry) => (
                    <td key={entry.id} className="engine-decision-table-viewer__feel-cell">
                      {highlightFeelExpression(entry.text || '-')}
                    </td>
                  ))}
                  {rule.outputEntries.map((entry) => (
                    <td key={entry.id} className="engine-decision-table-viewer__feel-cell">
                      {highlightFeelExpression(entry.text || '')}
                    </td>
                  ))}
                  <td>{rule.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expression.aggregation && (
        <div className="engine-decision-table-viewer__aggregation">Aggregation: {expression.aggregation}</div>
      )}
    </div>
  );
}
