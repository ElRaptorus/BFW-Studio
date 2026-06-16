import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type { SnakeCaseDecisionTrace } from '../DmnTraceTypes';
import './DmnTracePanes.scss';
import { getSelectionFromDocument, getTraceDataFromDocument, isDmnTraceDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: DecisionTraceDetailPane,
};

function getPaneTitle(): string {
  return 'Decision Trace';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDmnTraceDocument(editorDocument)) {
    return false;
  }
  return getSelectionFromDocument(editorDocumentModel)?.type === 'decision';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <DecisionTraceDetailPane {...props} />}
    </Pane>
  );
}

function DecisionTraceDetailPane(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelectionFromDocument(props.editorDocumentModel);
  const traceData = getTraceDataFromDocument(props.editorDocumentModel);
  if (!selection || !traceData) {
    return null;
  }

  const decisionTrace = traceData.trace.decisions.find(
    (decision) => decision.decision_model_id === selection.elementId,
  );

  if (!decisionTrace) {
    return (
      <PaneBody>
        <PaneProperty type="text" label="Status" disabled={true} value="Not evaluated in this execution" />
      </PaneBody>
    );
  }

  const durationMs = (decisionTrace.duration_microseconds / 1000).toFixed(1);

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Decision"
        disabled={true}
        value={decisionTrace.decision_name ?? decisionTrace.decision_model_id}
      />
      <PaneProperty type="text" label="Hit Policy" disabled={true} value={decisionTrace.hit_policy} />
      <PaneProperty type="text" label="Duration" disabled={true} value={`${durationMs} ms`} />
      <PaneProperty
        type="text"
        label="Matched Rules"
        disabled={true}
        value={String(decisionTrace.matched_rules.length)}
      />
      {decisionTrace.unmatched_rules_count > 0 && (
        <PaneProperty
          type="text"
          label="Unmatched Rules"
          disabled={true}
          value={String(decisionTrace.unmatched_rules_count)}
        />
      )}
      {decisionTrace.warnings.length > 0 && (
        <PaneProperty type="text" label="Warnings" disabled={true} value={String(decisionTrace.warnings.length)} />
      )}
      {decisionTrace.result != null && (
        <PaneProperty type="text" label="Result" disabled={true} value={formatResult(decisionTrace.result)} />
      )}

      <InputsSection decisionTrace={decisionTrace} />
      <MatchedRulesSection decisionTrace={decisionTrace} />
    </PaneBody>
  );
}

function InputsSection(props: { decisionTrace: SnakeCaseDecisionTrace }): React.JSX.Element | null {
  const { decisionTrace } = props;
  if (decisionTrace.inputs.length === 0) {
    return null;
  }

  return (
    <div className="dmn-trace-pane-section">
      <div className="dmn-trace-pane-section__title">Inputs</div>
      <table className="dmn-trace-pane-section__table">
        <thead>
          <tr>
            <th>Input</th>
            <th>Expression</th>
            <th>Resolved Value</th>
          </tr>
        </thead>
        <tbody>
          {decisionTrace.inputs.map((input) => (
            <tr key={input.input_id}>
              <td>{input.input_label ?? input.input_id}</td>
              <td className="dmn-trace-pane-section__monospace">{input.expression}</td>
              <td className="dmn-trace-pane-section__monospace">{formatValue(input.resolved_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchedRulesSection(props: { decisionTrace: SnakeCaseDecisionTrace }): React.JSX.Element | null {
  const { decisionTrace } = props;
  if (decisionTrace.matched_rules.length === 0) {
    return null;
  }

  return (
    <div className="dmn-trace-pane-section">
      <div className="dmn-trace-pane-section__title">Matched Rules</div>
      <table className="dmn-trace-pane-section__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rule</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          {decisionTrace.matched_rules.map((rule) => (
            <tr key={rule.rule_id}>
              <td>{rule.rule_index + 1}</td>
              <td>{rule.description ?? rule.rule_id}</td>
              <td className="dmn-trace-pane-section__monospace">{formatValue(rule.output_values)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatResult(result: Record<string, unknown> | Record<string, unknown>[] | null): string {
  if (result == null) {
    return '—';
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function formatValue(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
