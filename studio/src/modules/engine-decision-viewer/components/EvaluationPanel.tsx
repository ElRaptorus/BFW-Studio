import { getHumanizedDuration } from '#modules/engine-core';
import type { BkmTrace, DecisionTrace, EvaluationResult, ImportTrace, RuleTrace } from '@elraptorus/daemonengine_sdk';

import React, { useState } from 'react';

import { Icon } from '@evil/bifrost_fw_sdk';

import './EvaluationPanel.scss';

interface EvaluationPanelProps {
  open: boolean;
  inputJson: string;
  loading: boolean;
  error: string | null;
  result: EvaluationResult | null;
  onInputChange: (value: string) => void;
  onEvaluate: () => void;
  onClose: () => void;
  onOpenImportedModel?: (modelId: string) => void;
}

export function EvaluationPanel(props: EvaluationPanelProps): React.JSX.Element | null {
  if (!props.open) {
    return null;
  }

  return (
    <div className="engine-evaluation-panel">
      <div className="engine-evaluation-panel__header">
        <span className="engine-evaluation-panel__title">Test Decision</span>
        <button className="engine-evaluation-panel__close" onClick={props.onClose} title="Close">
          <Icon id="ph ph-x" />
        </button>
      </div>

      <div className="engine-evaluation-panel__body">
        <label className="engine-evaluation-panel__label" htmlFor="evaluation-input">
          Input JSON
        </label>
        <textarea
          id="evaluation-input"
          className="engine-evaluation-panel__textarea"
          value={props.inputJson}
          onChange={(event) => props.onInputChange(event.target.value)}
          rows={6}
          spellCheck={false}
        />

        <button
          className={`engine-evaluation-panel__evaluate${props.loading ? ' engine-evaluation-panel__evaluate--loading' : ''}`}
          onClick={props.onEvaluate}
          disabled={props.loading}
        >
          <Icon id="ph ph-play" /> {props.loading ? 'Evaluating...' : 'Evaluate'}
        </button>

        {props.error && <div className="engine-evaluation-panel__error">{props.error}</div>}

        {props.result && <EvaluationResultView result={props.result} onOpenImportedModel={props.onOpenImportedModel} />}
      </div>
    </div>
  );
}

function EvaluationResultView(props: {
  result: EvaluationResult;
  onOpenImportedModel?: (modelId: string) => void;
}): React.JSX.Element {
  const { result } = props;

  return (
    <div className="engine-evaluation-panel__result">
      <div className="engine-evaluation-panel__result-header">
        <span className="engine-evaluation-panel__hit-policy">{result.hitPolicy}</span>
        <span className="engine-evaluation-panel__duration">
          {getHumanizedDuration(result.durationMicroseconds / 1000)}
        </span>
      </div>

      <div className="engine-evaluation-panel__section">
        <div className="engine-evaluation-panel__section-title">Result</div>
        <pre className="engine-evaluation-panel__json">{JSON.stringify(result.result, null, 2)}</pre>
      </div>

      {result.trace.decisions.map((decision) => (
        <DecisionTraceSection
          key={decision.decisionModelId}
          decision={decision}
          onOpenImportedModel={props.onOpenImportedModel}
        />
      ))}

      {result.trace.inputCoercions.length > 0 && (
        <div className="engine-evaluation-panel__section">
          <div className="engine-evaluation-panel__section-title">Input Coercions</div>
          <table className="engine-evaluation-panel__trace-table">
            <thead>
              <tr>
                <th>Input</th>
                <th>Target Type</th>
                <th>Original</th>
                <th>Coerced</th>
              </tr>
            </thead>
            <tbody>
              {result.trace.inputCoercions.map((coercion) => (
                <tr key={coercion.inputName} className={coercion.coerced ? 'coerced' : ''}>
                  <td>{coercion.inputName}</td>
                  <td>
                    <code>{coercion.targetType}</code>
                  </td>
                  <td>
                    <code>{formatValue(coercion.originalValue)}</code>
                  </td>
                  <td>{coercion.coerced ? <code>{formatValue(coercion.coercedValue)}</code> : <span>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DecisionTraceSection(props: {
  decision: DecisionTrace;
  onOpenImportedModel?: (modelId: string) => void;
}): React.JSX.Element {
  const { decision } = props;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="engine-evaluation-panel__decision-trace">
      <button
        className="engine-evaluation-panel__decision-trace-header"
        onClick={() => setExpanded((previous) => !previous)}
      >
        <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-right'} />
        <span className="engine-evaluation-panel__decision-trace-name">
          {decision.decisionName ?? decision.decisionModelId}
        </span>
        <span className="engine-evaluation-panel__hit-policy engine-evaluation-panel__hit-policy--small">
          {decision.hitPolicy}
        </span>
        <span className="engine-evaluation-panel__duration">
          {getHumanizedDuration(decision.durationMicroseconds / 1000)}
        </span>
      </button>

      {expanded && (
        <div className="engine-evaluation-panel__decision-trace-body">
          {decision.inputs.length > 0 && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title">Inputs</div>
              <table className="engine-evaluation-panel__trace-table">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Expression</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {decision.inputs.map((input) => (
                    <tr key={input.inputId}>
                      <td>{input.inputLabel ?? input.inputId}</td>
                      <td>
                        <code>{input.expression}</code>
                      </td>
                      <td>
                        <code>{formatValue(input.resolvedValue)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {decision.matchedRules.length > 0 && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title">
                Matched Rules ({decision.matchedRules.length})
              </div>
              {decision.matchedRules.map((rule) => (
                <RuleTraceRow key={rule.ruleId} rule={rule} matched={true} />
              ))}
            </div>
          )}

          {decision.unmatchedRules && decision.unmatchedRules.length > 0 && (
            <UnmatchedRulesSection rules={decision.unmatchedRules} total={decision.unmatchedRulesCount} />
          )}

          {decision.unmatchedRulesCount > 0 && !decision.unmatchedRules?.length && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title engine-evaluation-panel__subsection-title--muted">
                {decision.unmatchedRulesCount} unmatched rule{decision.unmatchedRulesCount !== 1 ? 's' : ''} (enable
                &ldquo;includeUnmatchedDetails&rdquo; for detail)
              </div>
            </div>
          )}

          <pre className="engine-evaluation-panel__json engine-evaluation-panel__json--compact">
            {JSON.stringify(decision.result, null, 2)}
          </pre>

          {decision.bkmTraces.length > 0 && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title">BKM Invocations</div>
              {decision.bkmTraces.map((bkm) => (
                <BkmTraceNode key={bkm.bkmId} bkm={bkm} depth={0} />
              ))}
            </div>
          )}

          {decision.importTraces.length > 0 && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title">Imports</div>
              {decision.importTraces.map((importTrace) => (
                <ImportTraceNode
                  key={importTrace.namespace + ':' + importTrace.decisionId}
                  importTrace={importTrace}
                  onOpenImportedModel={props.onOpenImportedModel}
                />
              ))}
            </div>
          )}

          {decision.warnings.length > 0 && (
            <div className="engine-evaluation-panel__subsection">
              <div className="engine-evaluation-panel__subsection-title engine-evaluation-panel__subsection-title--warn">
                Warnings ({decision.warnings.length})
              </div>
              <pre className="engine-evaluation-panel__json">{JSON.stringify(decision.warnings, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RuleTraceRow(props: { rule: RuleTrace; matched: boolean }): React.JSX.Element {
  const { rule, matched } = props;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`engine-evaluation-panel__rule ${matched ? 'matched' : 'unmatched'}`}>
      <button className="engine-evaluation-panel__rule-header" onClick={() => setExpanded((previous) => !previous)}>
        <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-right'} />
        <span className="engine-evaluation-panel__rule-index">Rule {rule.ruleIndex + 1}</span>
        {rule.description && <span className="engine-evaluation-panel__rule-desc">{rule.description}</span>}
        {matched && Object.keys(rule.outputValues).length > 0 && (
          <code className="engine-evaluation-panel__rule-output">{formatValue(rule.outputValues)}</code>
        )}
      </button>

      {expanded && (
        <div className="engine-evaluation-panel__rule-detail">
          {rule.inputEvaluations.length > 0 && (
            <table className="engine-evaluation-panel__trace-table">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {rule.inputEvaluations.map((entry) => (
                  <tr key={entry.inputId} className={entry.matched ? '' : 'entry-miss'}>
                    <td>{entry.inputId}</td>
                    <td>
                      <code>{entry.expression}</code>
                    </td>
                    <td>
                      <code>{formatValue(entry.testedValue)}</code>
                    </td>
                    <td>{entry.matched ? <Icon id="ph ph-check-circle" /> : <Icon id="ph ph-x-circle" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {Object.keys(rule.outputValues).length > 0 && (
            <pre className="engine-evaluation-panel__json engine-evaluation-panel__json--compact">
              {JSON.stringify(rule.outputValues, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function UnmatchedRulesSection(props: { rules: RuleTrace[]; total: number }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="engine-evaluation-panel__subsection">
      <button
        className="engine-evaluation-panel__subsection-toggle"
        onClick={() => setExpanded((previous) => !previous)}
      >
        <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-right'} />
        <span className="engine-evaluation-panel__subsection-title engine-evaluation-panel__subsection-title--muted">
          Unmatched Rules ({props.total})
        </span>
      </button>

      {expanded && props.rules.map((rule) => <RuleTraceRow key={rule.ruleId} rule={rule} matched={false} />)}
    </div>
  );
}

function BkmTraceNode(props: { bkm: BkmTrace; depth: number }): React.JSX.Element {
  const { bkm, depth } = props;
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div className="engine-evaluation-panel__bkm" style={{ marginLeft: depth * 12 }}>
      <button className="engine-evaluation-panel__bkm-header" onClick={() => setExpanded((previous) => !previous)}>
        <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-right'} />
        <Icon id="ph-duotone ph-function" />
        <span className="engine-evaluation-panel__bkm-name">{bkm.bkmName ?? bkm.bkmId}</span>
        <span className="engine-evaluation-panel__duration">
          {getHumanizedDuration(bkm.durationMicroseconds / 1000)}
        </span>
      </button>

      {expanded && (
        <div className="engine-evaluation-panel__bkm-body">
          {bkm.formalParameters.length > 0 && (
            <table className="engine-evaluation-panel__trace-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {bkm.formalParameters.map((parameter) => (
                  <tr key={parameter.name}>
                    <td>{parameter.name}</td>
                    <td>
                      <code>{formatValue(parameter.boundValue)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <pre className="engine-evaluation-panel__json engine-evaluation-panel__json--compact">
            {formatValue(bkm.result)}
          </pre>
          {bkm.dependentBkmTraces.map((child) => (
            <BkmTraceNode key={child.bkmId} bkm={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportTraceNode(props: {
  importTrace: ImportTrace;
  onOpenImportedModel?: (modelId: string) => void;
}): React.JSX.Element {
  const { importTrace } = props;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="engine-evaluation-panel__import">
      <div className="engine-evaluation-panel__import-header">
        <button className="engine-evaluation-panel__import-toggle" onClick={() => setExpanded((previous) => !previous)}>
          <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-right'} />
          <Icon id="ph-duotone ph-arrow-square-out" />
          <span>
            {importTrace.namespace}:{importTrace.decisionId}
          </span>
          <span className="engine-evaluation-panel__duration">
            {getHumanizedDuration(importTrace.durationMicroseconds / 1000)}
          </span>
        </button>
        {props.onOpenImportedModel && (
          <button
            className="engine-evaluation-panel__import-open"
            title="Open imported model in a new tab"
            onClick={() => props.onOpenImportedModel!(importTrace.sourceDefinitionsId)}
          >
            <Icon id="ph ph-arrow-square-out" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="engine-evaluation-panel__import-body">
          <pre className="engine-evaluation-panel__json engine-evaluation-panel__json--compact">
            Result: {formatValue(importTrace.result)}
          </pre>
          {importTrace.evaluationTrace.decisions.map((decision) => (
            <DecisionTraceSection
              key={decision.decisionModelId}
              decision={decision}
              onOpenImportedModel={props.onOpenImportedModel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
