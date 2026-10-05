import { getHumanizedDuration } from '#bifrost/common/DurationFunctions';

import type { EvaluationResult } from '@elraptorus/bfw_engine_sdk';
import { DmnHitPolicy } from '@elraptorus/bfw_engine_sdk';

import type { DmnSimulatorSnapshot } from '../DmnSimulatorSession';
import type { SimulationOutcome } from '../core/types';

export type OutcomeSummary = {
  tone: 'hint' | 'value' | 'error' | 'stale';
  text: string;
  tag?: string;
  duration?: string;
};

/** A successful outcome as an `EvaluationResult`; decision services are shown like a boxed expression. */
export function toEvaluationResult(outcome: Extract<SimulationOutcome, { ok: true }>): EvaluationResult {
  if (outcome.kind === 'decision') {
    return outcome.result;
  }
  const service = outcome.result;
  return {
    decisionModelId: service.serviceId,
    decisionName: service.serviceName,
    hitPolicy: DmnHitPolicy.BoxedExpression,
    result: service.outputs,
    matchedRules: [],
    trace: service.trace,
    evaluatedAt: service.evaluatedAt,
    durationMicroseconds: service.durationMicroseconds,
    definitionsId: null,
    definitionsNamespace: null,
    decisionVersionId: null,
  };
}

/** The one-line text of the control pad's result strip. */
export function summarizeOutcome(
  snapshot: DmnSimulatorSnapshot,
  describeElement: (elementId: string) => string,
): OutcomeSummary {
  const { outcome } = snapshot;
  if (snapshot.status === 'running') {
    return { tone: 'hint', text: 'Evaluating…' };
  }
  if (outcome == null) {
    const where = snapshot.importedInputs.length > 0 ? 'each input and the inputs under Details' : 'each input';
    return { tone: 'hint', text: `Set a value on ${where} with the wrench, then press ▶ on a decision.` };
  }
  if (!outcome.ok) {
    return { tone: 'error', text: 'The run failed. The notification and Details show why.' };
  }
  if (snapshot.stale) {
    return { tone: 'stale', text: 'The model changed after this run — run again.' };
  }
  const result = toEvaluationResult(outcome);
  const name =
    snapshot.target == null ? (result.decisionName ?? result.decisionModelId) : describeElement(snapshot.target.id);
  return {
    tone: 'value',
    text: `${name} = ${JSON.stringify(result.result) ?? 'null'}`,
    tag: result.hitPolicy,
    duration: getHumanizedDuration(result.durationMicroseconds / 1000),
  };
}
