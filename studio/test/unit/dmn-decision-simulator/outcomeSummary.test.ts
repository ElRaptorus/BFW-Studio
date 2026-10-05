import { describe, expect, it } from 'vitest';

import type { DmnServiceEvaluationResult, EvaluationResult } from '@elraptorus/bfw_engine_sdk';

import type { DmnSimulatorSnapshot } from '../../../src/modules/dmn-decision-simulator/DmnSimulatorSession';
import { summarizeOutcome } from '../../../src/modules/dmn-decision-simulator/components/outcomeSummary';

const idle: DmnSimulatorSnapshot = {
  status: 'idle',
  target: null,
  outcome: null,
  unresolvedImports: [],
  ambiguousImports: [],
  importedModelUris: {},
  importedInputs: [],
  replayIndex: null,
  stale: false,
};

const decisionResult = {
  decisionModelId: 'Decision_Simple',
  decisionName: 'Simple',
  hitPolicy: 'LITERAL',
  result: 'ok',
  durationMicroseconds: 1500,
} as unknown as EvaluationResult;

const done: DmnSimulatorSnapshot = {
  ...idle,
  status: 'done',
  target: { kind: 'decision', id: 'Decision_Simple' },
  outcome: { ok: true, kind: 'decision', result: decisionResult, steps: [] },
};

const describeElement = (elementId: string) => `name of ${elementId}`;

describe('summarizeOutcome', () => {
  it('shows the input hint before a run, mentioning Details only when imported inputs exist', () => {
    expect(summarizeOutcome(idle, describeElement)).toEqual({
      tone: 'hint',
      text: 'Set a value on each input with the wrench, then press ▶ on a decision.',
    });
    const withImports = { ...idle, importedInputs: [{ name: 'limit', namespace: 'shared' }] };
    expect(summarizeOutcome(withImports, describeElement).text).toContain('the inputs under Details');
  });

  it('shows that a run is in progress, even when an old outcome exists', () => {
    expect(summarizeOutcome({ ...done, status: 'running' }, describeElement)).toEqual({
      tone: 'hint',
      text: 'Evaluating…',
    });
  });

  it('points to the notification for a failed run, even when stale', () => {
    const failed: DmnSimulatorSnapshot = {
      ...done,
      stale: true,
      outcome: { ok: false, error: { code: 'missing_required_input', message: 'age is missing' }, steps: [] },
    };
    expect(summarizeOutcome(failed, describeElement)).toEqual({
      tone: 'error',
      text: 'The run failed. The notification and Details show why.',
    });
  });

  it('asks for a new run when a successful outcome is stale', () => {
    expect(summarizeOutcome({ ...done, stale: true }, describeElement).tone).toBe('stale');
  });

  it('shows the target name, the JSON value, the hit policy and the duration of a decision', () => {
    expect(summarizeOutcome(done, describeElement)).toEqual({
      tone: 'value',
      text: 'name of Decision_Simple = "ok"',
      tag: 'LITERAL',
      duration: '2ms',
    });
  });

  it('shows the outputs of a decision service as a boxed expression', () => {
    const service = {
      serviceId: 'Service_1',
      serviceName: 'Service',
      outputs: { total: 3 },
      trace: { decisions: [], inputCoercions: [] },
      evaluatedAt: '2026-10-05T00:00:00Z',
      durationMicroseconds: 400,
    } as unknown as DmnServiceEvaluationResult;
    const snapshot: DmnSimulatorSnapshot = {
      ...done,
      target: { kind: 'decisionService', id: 'Service_1' },
      outcome: { ok: true, kind: 'decisionService', result: service, steps: [] },
    };
    const summary = summarizeOutcome(snapshot, describeElement);
    expect(summary.text).toBe('name of Service_1 = {"total":3}');
    expect(summary.duration).toBe('400µs');
    expect(summary.tag).toBeDefined();
  });
});
