import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseDmn } from '@elraptorus/bfw_engine_sdk';

import { evaluateDmnSimulation } from '../../../src/modules/dmn-decision-simulator/core/evaluateDmnSimulation';
import { PARITY_CASES } from './parityCases';

const FIXTURE_DIRECTORY = join(__dirname, '../../fixtures/dmn-simulator-parity');

describe('Engine conformance parity (C40-C61)', () => {
  it.each(PARITY_CASES)('$caseId', (parityCase) => {
    const parsed = new Map(
      parityCase.fixtures.map((fixture) => [fixture, parseDmn(readFileSync(join(FIXTURE_DIRECTORY, fixture), 'utf8'))]),
    );
    const model = parsed.get(parityCase.mainFixture)!;
    const importedModels = new Map(
      [...parsed]
        .filter(([fixture]) => fixture !== parityCase.mainFixture)
        .map(([, definitions]) => [definitions.namespace, definitions]),
    );
    const targetId = parityCase.target.id ?? model.decisions[0].id;

    const outcome = evaluateDmnSimulation({
      model,
      importedModels,
      target: { kind: parityCase.target.kind, id: targetId },
      inputs: parityCase.inputs,
    });

    if (parityCase.expectedErrorCode != null) {
      expect(outcome.ok).toBe(false);
      expect(!outcome.ok && outcome.error.code).toBe(parityCase.expectedErrorCode);
      return;
    }
    expect(outcome.ok, JSON.stringify(!outcome.ok && outcome.error)).toBe(true);
    if (outcome.ok) {
      const actual = outcome.kind === 'decision' ? outcome.result.result : outcome.result.outputs;
      expect(actual).toEqual(parityCase.expectedResult);
    }
  });
});
