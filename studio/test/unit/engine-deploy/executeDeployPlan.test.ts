import {
  executeDeployPlan,
  extractRulesetFailures,
  toFailedResult,
} from '#modules/engine-deploy/analysis/executeDeployPlan';
import type { DeployItemResult } from '#modules/engine-deploy/analysis/types';
import { describe, expect, it } from 'vitest';

const deployed = (uri: string): DeployItemResult => ({ uri, status: 'deployed', message: null, rulesetFailures: [] });

describe('executeDeployPlan', () => {
  it('deploys DMN files before BPMN files and keeps the plan order otherwise', async () => {
    const order: string[] = [];

    await executeDeployPlan(
      [
        { uri: 'a.bpmn', kind: 'bpmn' },
        { uri: 'b.dmn', kind: 'dmn' },
        { uri: 'c.bpmn', kind: 'bpmn' },
        { uri: 'd.dmn', kind: 'dmn' },
      ],
      async (file) => {
        order.push(file.uri);
        return deployed(file.uri);
      },
    );

    expect(order).toEqual(['b.dmn', 'd.dmn', 'a.bpmn', 'c.bpmn']);
  });

  it('continues after a failed or cancelled file and turns a thrown error into a failed result', async () => {
    const results = await executeDeployPlan(
      [
        { uri: 'a.bpmn', kind: 'bpmn' },
        { uri: 'b.bpmn', kind: 'bpmn' },
        { uri: 'c.bpmn', kind: 'bpmn' },
      ],
      async (file) => {
        if (file.uri === 'a.bpmn') {
          throw new Error('boom');
        }
        if (file.uri === 'b.bpmn') {
          return { uri: file.uri, status: 'cancelled', message: null, rulesetFailures: [] };
        }
        return deployed(file.uri);
      },
    );

    expect(results.map((result) => [result.uri, result.status])).toEqual([
      ['a.bpmn', 'failed'],
      ['b.bpmn', 'cancelled'],
      ['c.bpmn', 'deployed'],
    ]);
    expect(results[0].message).toContain('boom');
  });

  it('returns no results for an empty plan', async () => {
    expect(await executeDeployPlan([], async (file) => deployed(file.uri))).toEqual([]);
  });
});

describe('extractRulesetFailures', () => {
  const rulesetFailure = { rulesetId: 'bpmn-production-ready', check: 'minScorePercent', expected: 90, actual: 80 };

  it('flattens the ruleset failures of every failed file', () => {
    const error = {
      message: 'gate',
      _deployFailures: [
        { fileName: 'a.bpmn', details: [], rulesetFailures: [rulesetFailure] },
        { fileName: 'b.bpmn', details: [], rulesetFailures: [] },
      ],
    };

    expect(extractRulesetFailures(error)).toEqual([rulesetFailure]);
    expect(toFailedResult('a.bpmn', error)).toMatchObject({ status: 'failed', rulesetFailures: [rulesetFailure] });
  });

  it('returns nothing for errors without failure details', () => {
    expect(extractRulesetFailures(new Error('x'))).toEqual([]);
    expect(extractRulesetFailures(null)).toEqual([]);
  });
});
