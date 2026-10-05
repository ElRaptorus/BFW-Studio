import { describe, expect, it } from 'vitest';

import type { DmnDecisionTable } from '@elraptorus/bfw_engine_sdk';

import { applyHitPolicy } from '../../../src/modules/dmn-decision-simulator/core/hitPolicies';

function table(hitPolicy: string, aggregation?: string): DmnDecisionTable {
  return { hitPolicy, aggregation, outputs: [] } as unknown as DmnDecisionTable;
}

const NO_DEFAULT = () => null;

describe('applyHitPolicy', () => {
  it('unique accepts at most one match and rejects several', () => {
    expect(applyHitPolicy(table('unique'), [{ amount: 1 }], NO_DEFAULT)).toEqual({ amount: 1 });
    expect(() => applyHitPolicy(table('unique'), [{ amount: 1 }, { amount: 2 }], NO_DEFAULT)).toThrow();
  });

  it('unique falls back to the default output when nothing matches', () => {
    expect(applyHitPolicy(table('unique'), [], () => ({ amount: 0 }))).toEqual({ amount: 0 });
  });

  it('first returns the first match', () => {
    expect(applyHitPolicy(table('first'), [{ amount: 1 }, { amount: 2 }], NO_DEFAULT)).toEqual({ amount: 1 });
  });

  it('any accepts equal outputs and rejects differing ones', () => {
    expect(applyHitPolicy(table('any'), [{ amount: 1 }, { amount: 1 }], NO_DEFAULT)).toEqual({ amount: 1 });
    expect(() => applyHitPolicy(table('any'), [{ amount: 1 }, { amount: 2 }], NO_DEFAULT)).toThrow();
  });

  it('collect without aggregation and rule order keep every match in rule order', () => {
    const matches = [{ amount: 2 }, { amount: 1 }];
    expect(applyHitPolicy(table('collect'), matches, NO_DEFAULT)).toEqual(matches);
    expect(applyHitPolicy(table('rule_order'), matches, NO_DEFAULT)).toEqual(matches);
  });

  it('collect aggregates SUM, MIN, MAX and COUNT of a single output', () => {
    const matches = [{ amount: 2 }, { amount: 5 }, { amount: 3 }];
    expect(applyHitPolicy(table('collect', 'SUM'), matches, NO_DEFAULT)).toBe(10);
    expect(applyHitPolicy(table('collect', 'MIN'), matches, NO_DEFAULT)).toBe(2);
    expect(applyHitPolicy(table('collect', 'MAX'), matches, NO_DEFAULT)).toBe(5);
    expect(applyHitPolicy(table('collect', 'COUNT'), matches, NO_DEFAULT)).toBe(3);
  });

  it('rejects an unknown hit policy', () => {
    expect(() => applyHitPolicy(table('bogus'), [], NO_DEFAULT)).toThrow();
  });
});
