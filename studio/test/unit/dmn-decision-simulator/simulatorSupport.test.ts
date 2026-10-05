import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseDmn } from '@elraptorus/bfw_engine_sdk';

import { DmnSimulatorSession } from '../../../src/modules/dmn-decision-simulator/DmnSimulatorSession';
import { resolveEvaluationOrder } from '../../../src/modules/dmn-decision-simulator/core/dependencyResolver';
import { evaluateDmnSimulation } from '../../../src/modules/dmn-decision-simulator/core/evaluateDmnSimulation';
import { loadSimulationModels } from '../../../src/modules/dmn-decision-simulator/core/loadSimulationModels';

const FIXTURE_DIRECTORY = join(__dirname, '../../fixtures/dmn-simulator-parity');
const readFixture = (name: string) => readFileSync(join(FIXTURE_DIRECTORY, name), 'utf8');

describe('dependency resolver', () => {
  it('orders a diamond so every decision follows its requirements', () => {
    const order = resolveEvaluationOrder(parseDmn(readFixture('drg_diamond.dmn')), 'Decision_A').map(
      (decision) => decision.id,
    );
    expect(order.at(-1)).toBe('Decision_A');
    expect(new Set(order).size).toBe(4);
  });

  it('rejects a cycle', () => {
    expect(() => resolveEvaluationOrder(parseDmn(readFixture('drg_cycle.dmn')), 'Decision_A')).toThrow();
  });
});

describe('import resolution', () => {
  it('reports import_not_found when the imported model is not supplied', () => {
    const model = parseDmn(readFixture('importing_model.dmn'));
    const outcome = evaluateDmnSimulation({
      model,
      importedModels: new Map(),
      target: { kind: 'decision', id: 'Decision_final' },
      inputs: { base: 5 },
    });
    expect(!outcome.ok && outcome.error.code).toBe('import_not_found');
  });

  it('loads imported models from the solution and lists unresolved ones', async () => {
    const helperText = readFixture('imported_helper.dmn');
    const helper = parseDmn(helperText);
    const loaded = await loadSimulationModels(readFixture('importing_model.dmn'), {
      listDecisionModels: async () => [{ uri: 'helper.dmn', namespace: helper.namespace }],
      loadText: async () => helperText,
    });
    expect(loaded.importedModels.has(helper.namespace)).toBe(true);
    expect(loaded.unresolvedImports).toEqual([]);

    const missing = await loadSimulationModels(readFixture('importing_model.dmn'), {
      listDecisionModels: async () => [],
      loadText: async () => '',
    });
    expect(missing.unresolvedImports).toHaveLength(1);
  });
});

describe('DmnSimulatorSession', () => {
  it('limits visible steps to the replay position and notifies subscribers', () => {
    const outcome = evaluateDmnSimulation({
      model: parseDmn(readFixture('drg_linear_chain.dmn')),
      importedModels: new Map(),
      target: { kind: 'decision', id: 'Decision_A' },
      inputs: { x: 5 },
    });
    const session = new DmnSimulatorSession();
    let notifications = 0;
    session.subscribe(() => notifications++);

    session.update({ status: 'done', outcome });
    const allSteps = session.getVisibleSteps();
    expect(allSteps.length).toBeGreaterThan(1);

    session.update({ replayIndex: 0 });
    expect(session.getVisibleSteps()).toHaveLength(1);
    expect(session.findDecisionStep('Decision_A')).toBeUndefined();

    session.reset();
    expect(session.getVisibleSteps()).toEqual([]);
    expect(notifications).toBe(3);
  });

  it('shows one latest step per local element in order of first appearance', () => {
    const session = new DmnSimulatorSession();
    const step = (elementId: string, value: unknown, namespace: string | null = null) => ({
      elementId,
      elementName: elementId,
      namespace,
      type: 'decision' as const,
      value,
    });
    session.update({
      outcome: {
        ok: true,
        kind: 'decision',
        result: {} as never,
        steps: [step('a', 1), step('b', 2), step('a', 3), step('imported', 4, 'ns')],
      },
    });

    expect(session.getLatestVisibleStepPerElement().map((entry) => [entry.elementId, entry.value])).toEqual([
      ['a', 3],
      ['b', 2],
    ]);
    session.update({ replayIndex: 1 });
    expect(session.getLatestVisibleStepPerElement().map((entry) => [entry.elementId, entry.value])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('moves typed text on rename unless the new name already has text', () => {
    const session = new DmnSimulatorSession();
    session.setInputText('old', '1');
    session.renameInputText('old', 'new');
    expect(session.getInputText('new')).toBe('1');
    expect(session.getInputText('old')).toBe('');

    session.setInputText('taken', '2');
    session.setInputText('other', '3');
    session.renameInputText('other', 'taken');
    expect(session.getInputText('taken')).toBe('2');
    expect(session.getInputText('other')).toBe('3');
  });

  it('clearResult keeps inputs and target, reset also clears the model information', () => {
    const session = new DmnSimulatorSession();
    session.setInputText('x', '1');
    session.update({
      status: 'done',
      target: { kind: 'decision', id: 'd' },
      outcome: { ok: false, error: { code: 'c', message: 'm' }, steps: [] },
      replayIndex: 0,
      stale: true,
      importedModelUris: { ns: 'file.dmn' },
    });

    session.clearResult();
    expect(session.getSnapshot()).toMatchObject({
      status: 'idle',
      outcome: null,
      replayIndex: null,
      stale: false,
      target: { kind: 'decision', id: 'd' },
      importedModelUris: { ns: 'file.dmn' },
    });
    expect(session.getInputText('x')).toBe('1');

    session.reset();
    expect(session.getSnapshot()).toMatchObject({ target: null, importedModelUris: {}, ambiguousImports: [] });
  });
});
