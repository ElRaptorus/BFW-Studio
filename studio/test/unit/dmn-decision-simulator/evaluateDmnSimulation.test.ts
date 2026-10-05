import { describe, expect, it } from 'vitest';

import { parseDmn } from '@elraptorus/bfw_engine_sdk';

import { evaluateDmnSimulation } from '../../../src/modules/dmn-decision-simulator/core/evaluateDmnSimulation';
import { serializeFeelValue } from '../../../src/modules/dmn-decision-simulator/core/serializeFeelValue';
import type { SimulationOutcome } from '../../../src/modules/dmn-decision-simulator/core/types';

const DISCOUNT_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="defs" name="d" namespace="urn:test:discount">
  <inputData id="in_age" name="age"/>
  <decision id="dec_discount" name="Discount">
    <informationRequirement id="r1"><requiredInput href="#in_age"/></informationRequirement>
    <decisionTable id="t1" hitPolicy="UNIQUE">
      <input id="i1"><inputExpression id="ie1"><text>age</text></inputExpression></input>
      <output id="o1" name="discount"/>
      <rule id="rule_young"><inputEntry id="e1"><text>&lt; 18</text></inputEntry><outputEntry id="oe1"><text>10</text></outputEntry></rule>
      <rule id="rule_adult"><inputEntry id="e2"><text>&gt;= 18</text></inputEntry><outputEntry id="oe2"><text>0</text></outputEntry></rule>
    </decisionTable>
  </decision>
</definitions>`;

function simulate(xml: string, targetId: string, inputs: Record<string, unknown>): SimulationOutcome {
  return evaluateDmnSimulation({
    model: parseDmn(xml),
    importedModels: new Map(),
    target: { kind: 'decision', id: targetId },
    inputs,
  });
}

describe('evaluateDmnSimulation', () => {
  it('evaluates a unique decision table and reports the matched rule', () => {
    const outcome = simulate(DISCOUNT_DMN, 'dec_discount', { age: 12 });
    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.kind === 'decision') {
      expect(outcome.result.result).toEqual({ discount: 10 });
      expect(outcome.result.matchedRules).toEqual(['rule_young']);
      const decisionStep = outcome.steps.find((step) => step.elementId === 'dec_discount');
      expect(decisionStep?.rules).toEqual([
        { ruleId: 'rule_young', matched: true },
        { ruleId: 'rule_adult', matched: false },
      ]);
      expect(outcome.steps.map((step) => step.elementId)).toEqual(['in_age', 'dec_discount']);
    }
  });

  it('fails with missing_required_input when the input is absent', () => {
    const outcome = simulate(DISCOUNT_DMN, 'dec_discount', {});
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('missing_required_input');
      expect(outcome.steps.at(-1)?.error?.code).toBe('missing_required_input');
    }
  });
});

describe('serializeFeelValue', () => {
  it('drops undefined object properties like JSON and keeps null elsewhere', () => {
    expect(serializeFeelValue({ kept: 1, dropped: undefined, nested: { inner: undefined } })).toEqual({
      kept: 1,
      nested: {},
    });
    expect(serializeFeelValue([undefined])).toEqual([null]);
    expect(serializeFeelValue(undefined)).toBeNull();
  });
});
