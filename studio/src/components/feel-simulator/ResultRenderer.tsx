import React from 'react';

import type { EvalResult } from './types';

type ResultRendererProps = {
  result: EvalResult | null;
  source: 'multi' | 'single' | null;
  isLoading: boolean;
};

export function ResultRenderer(props: ResultRendererProps): React.JSX.Element {
  const { result, source, isLoading } = props;

  let sourceLabel: string | null = null;
  if (source === 'multi') {
    sourceLabel = 'Multi-line';
  } else if (source === 'single') {
    sourceLabel = 'Single-line';
  }

  if (isLoading) {
    return (
      <div className="feel-simulator__result-box feel-simulator__result-box--loading" data-test--feel-result="loading">
        <span className="feel-simulator__result-pulse">Evaluating expression…</span>
      </div>
    );
  }

  if (result == null) {
    return (
      <div className="feel-simulator__result-box feel-simulator__result-box--idle" data-test--feel-result="idle">
        Click ▶ next to the editor to evaluate the expression.
      </div>
    );
  }

  if (result.status === 'success') {
    const formatted = formatValue(result.value);
    const typeLabel = getTypeLabel(result.value);
    return (
      <div className="feel-simulator__result-box feel-simulator__result-box--success" data-test--feel-result="success">
        <div className="feel-simulator__result-header">
          <span className="feel-simulator__result-status feel-simulator__result-status--success">✓ Result</span>
          <span className="feel-simulator__result-meta">
            {sourceLabel != null ? `${sourceLabel} · ` : ''}
            {result.elapsed.toFixed(1)} ms
          </span>
        </div>
        <pre className="feel-simulator__result-value" data-test--feel-result-value="">
          {formatted}
        </pre>
        <div className="feel-simulator__result-type">{typeLabel}</div>
        {result.warnings.length > 0 && (
          <div className="feel-simulator__result-warnings">
            {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}:
            <ul className="feel-simulator__result-warnings-list">
              {result.warnings.map((warning, idx) => (
                <li key={idx}>{warning.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="feel-simulator__result-box feel-simulator__result-box--error" data-test--feel-result="error">
        <div className="feel-simulator__result-header">
          <span className="feel-simulator__result-status feel-simulator__result-status--error">✗ Error</span>
          <span className="feel-simulator__result-meta">
            {sourceLabel != null ? `${sourceLabel}` : ''}
            {result.elapsed > 0 ? ` · ${result.elapsed.toFixed(1)} ms` : ''}
          </span>
        </div>
        <pre
          className="feel-simulator__result-value feel-simulator__result-value--error"
          data-test--feel-result-value=""
        >
          {result.error}
        </pre>
      </div>
    );
  }

  return (
    <div className="feel-simulator__result-box feel-simulator__result-box--timeout" data-test--feel-result="timeout">
      <div className="feel-simulator__result-header">
        <span className="feel-simulator__result-status feel-simulator__result-status--timeout">⏱ Timeout</span>
        <span className="feel-simulator__result-meta">{sourceLabel}</span>
      </div>
      <p className="feel-simulator__result-timeout-message">
        Evaluation timed out after {result.timeout / 1000} s — the expression may be too complex or contain an infinite
        loop.
      </p>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function getTypeLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  if (typeof value === 'object') {
    return 'context';
  }
  return typeof value;
}
