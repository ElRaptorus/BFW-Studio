import {
  formatDeployErrorMessage,
  formatRulesetFailure,
  remapFailuresToFileNames,
} from '#modules/engine-core/commands/registerDeployCommands';
import { describe, expect, it } from 'vitest';

const rulesetFailure = { rulesetId: 'bpmn-production-ready', check: 'minScorePercent', expected: 90, actual: 80.5 };

describe('remapFailuresToFileNames', () => {
  it('maps source_N files to the real names and keeps the ruleset failures', () => {
    const error = {
      rawBody: {
        failures: [
          { file: 'source_2.bpmn', rulesetFailures: [rulesetFailure] },
          { file: 'source_1.bpmn', details: ['broken'] },
        ],
      },
    };

    expect(remapFailuresToFileNames(error, ['a.bpmn', 'b.bpmn'])).toEqual([
      {
        fileName: 'b.bpmn',
        details: [formatRulesetFailure(rulesetFailure)],
        rulesetFailures: [rulesetFailure],
      },
      { fileName: 'a.bpmn', details: ['broken'], rulesetFailures: [] },
    ]);
  });

  it('returns null when the body carries no failures', () => {
    expect(remapFailuresToFileNames({ rawBody: {} }, ['a.bpmn'])).toBeNull();
    expect(remapFailuresToFileNames(new Error('x'), ['a.bpmn'])).toBeNull();
  });

  it('shows the ruleset checks in the deploy error message', () => {
    const failures = remapFailuresToFileNames(
      { rawBody: { failures: [{ file: 'source_1.bpmn', rulesetFailures: [rulesetFailure] }] } },
      ['a.bpmn'],
    );

    expect(formatDeployErrorMessage({ message: 'x', _deployFailures: failures })).toBe(
      'Deploy failed:\na.bpmn: bpmn-production-ready: minScorePercent expected 90, actual 80.5',
    );
  });
});
