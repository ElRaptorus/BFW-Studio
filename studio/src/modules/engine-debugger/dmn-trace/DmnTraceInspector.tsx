import React, { useMemo } from 'react';

import type { DocumentInspectorProps } from '@evil/bifrost_fw_sdk';

import type { DmnTraceFragmentModel } from './DmnTraceFragmentModel';
import './DmnTraceInspector.scss';
import type { DmnTraceFragmentData, SnakeCaseDecisionTrace } from './DmnTraceTypes';

export function DmnTraceInspector(props: DocumentInspectorProps): React.JSX.Element | null {
  const data = props.editorDocument?.data?.current as DmnTraceFragmentData | null;
  const traceProperties = (props.editorDocumentModel as DmnTraceFragmentModel | null)?.getTraceProperties() ?? null;

  if (!traceProperties) {
    return (
      <div className="dmn-trace-inspector dmn-trace-inspector--empty">
        {data?.loading ? 'Loading trace data...' : 'No evaluation trace available.'}
      </div>
    );
  }

  const decisions = traceProperties.trace.decisions;

  return (
    <div className="dmn-trace-inspector">
      <div className="dmn-trace-inspector__title">Evaluation Order</div>
      <div className="dmn-trace-inspector__description">
        Decisions are listed in the order they were evaluated by the DRG dependency resolver.
      </div>
      <table className="dmn-trace-inspector__table">
        <thead>
          <tr>
            <th className="dmn-trace-inspector__col-order">#</th>
            <th>Decision</th>
            <th>Hit Policy</th>
            <th>Rules</th>
            <th>Duration</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((decision, index) => (
            <EvaluationOrderRow key={decision.decision_model_id} decision={decision} order={index + 1} />
          ))}
        </tbody>
      </table>
      {decisions.length === 0 && <div className="dmn-trace-inspector__empty-hint">No decisions were evaluated.</div>}
    </div>
  );
}

function EvaluationOrderRow(props: { decision: SnakeCaseDecisionTrace; order: number }): React.JSX.Element {
  const { decision, order } = props;
  const durationMs = (decision.duration_microseconds / 1000).toFixed(1);
  const matchedCount = decision.matched_rules.length;
  const totalCount = matchedCount + decision.unmatched_rules_count;
  const resultPreview = useMemo(() => formatResultPreview(decision.result), [decision.result]);

  return (
    <tr>
      <td className="dmn-trace-inspector__col-order">{order}</td>
      <td title={decision.decision_model_id}>{decision.decision_name ?? decision.decision_model_id}</td>
      <td>{decision.hit_policy}</td>
      <td>
        {matchedCount}/{totalCount}
      </td>
      <td className="dmn-trace-inspector__col-duration">{durationMs} ms</td>
      <td className="dmn-trace-inspector__col-result" title={resultPreview}>
        {resultPreview}
      </td>
    </tr>
  );
}

function formatResultPreview(result: Record<string, unknown> | Record<string, unknown>[] | null): string {
  if (result == null) {
    return '—';
  }
  try {
    const json = JSON.stringify(result);
    return json.length > 80 ? json.substring(0, 77) + '...' : json;
  } catch {
    return String(result);
  }
}
