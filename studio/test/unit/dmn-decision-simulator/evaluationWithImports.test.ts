import { describe, expect, it } from 'vitest';

import { parseDmn } from '@elraptorus/bfw_engine_sdk';

import { evaluateDmnSimulation } from '../../../src/modules/dmn-decision-simulator/core/evaluateDmnSimulation';
import { loadSimulationModels } from '../../../src/modules/dmn-decision-simulator/core/loadSimulationModels';
import type { SimulationRequest } from '../../../src/modules/dmn-decision-simulator/core/types';

const HELPER_NAMESPACE = 'https://example.test/helper';

const HELPER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Definitions_helper" name="Helper" namespace="${HELPER_NAMESPACE}">
  <businessKnowledgeModel id="BKM_inner" name="Inner">
    <variable id="var_inner" name="Inner"/>
    <encapsulatedLogic id="FL_inner" kind="FEEL"><literalExpression id="LE_inner"><text>1 + 1</text></literalExpression></encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="BKM_outer" name="Outer">
    <variable id="var_outer" name="Outer"/>
    <knowledgeRequirement id="kr_inner"><requiredKnowledge href="#BKM_inner"/></knowledgeRequirement>
    <encapsulatedLogic id="FL_outer" kind="FEEL"><literalExpression id="LE_outer"><text>Inner * 2</text></literalExpression></encapsulatedLogic>
  </businessKnowledgeModel>
</definitions>`;

const CONSUMER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Definitions_consumer" name="Consumer" namespace="https://example.test/consumer">
  <import id="Import_helper" namespace="${HELPER_NAMESPACE}" importType="https://www.omg.org/spec/DMN/20191111/MODEL/"/>
  <decision id="Decision_total" name="Total">
    <variable id="var_total" name="Total"/>
    <knowledgeRequirement id="kr_outer"><requiredKnowledge href="${HELPER_NAMESPACE}#BKM_outer"/></knowledgeRequirement>
    <literalExpression id="LE_total"><text>Outer</text></literalExpression>
  </decision>
  <decisionService id="Service_total" name="Total Service">
    <outputDecision href="#Decision_total"/>
  </decisionService>
  <decision id="Decision_needs_input" name="Needs Input">
    <variable id="var_needs" name="Needs Input"/>
    <informationRequirement id="ir_amount"><requiredInput href="#InputData_amount"/></informationRequirement>
    <literalExpression id="LE_needs"><text>amount</text></literalExpression>
  </decision>
  <inputData id="InputData_amount" name="amount"><variable id="var_amount" name="amount"/></inputData>
</definitions>`;

const createRequest = (overrides: Partial<SimulationRequest>): SimulationRequest => ({
  model: parseDmn(CONSUMER_XML),
  importedModels: new Map([[HELPER_NAMESPACE, parseDmn(HELPER_XML)]]),
  target: { kind: 'decision', id: 'Decision_total' },
  inputs: {},
  ...overrides,
});

describe('BKM chains inside imported models', () => {
  it('keeps the imported namespace on every step of the chain', () => {
    const outcome = evaluateDmnSimulation(createRequest({}));

    expect(outcome.ok && outcome.kind === 'decision' && outcome.result.result).toBe(4);
    const bkmSteps = outcome.steps.filter((step) => step.type === 'businessKnowledgeModel');
    expect(bkmSteps.map((step) => [step.elementId, step.namespace])).toEqual([
      ['BKM_inner', HELPER_NAMESPACE],
      ['BKM_outer', HELPER_NAMESPACE],
    ]);
  });
});

describe('target error step', () => {
  it('marks a decision service that fails before any decision ran', () => {
    const outcome = evaluateDmnSimulation(createRequest({ target: { kind: 'decisionService', id: 'Service_total' } }));
    // The service succeeds here; a failing one is simulated through a missing decision target below.
    expect(outcome.ok).toBe(true);

    const failing = evaluateDmnSimulation(
      createRequest({
        model: parseDmn(
          CONSUMER_XML.replace('<outputDecision href="#Decision_total"/>', '<outputDecision href="#Missing"/>'),
        ),
        target: { kind: 'decisionService', id: 'Service_total' },
      }),
    );
    expect(failing.ok).toBe(false);
    expect(failing.steps).toEqual([
      expect.objectContaining({
        elementId: 'Service_total',
        namespace: null,
        type: 'decisionService',
        error: expect.objectContaining({ code: 'missing_service_decision' }),
      }),
    ]);
  });

  it('does not duplicate the error step of a decision that already recorded one', () => {
    const outcome = evaluateDmnSimulation(createRequest({ target: { kind: 'decision', id: 'Decision_needs_input' } }));

    expect(outcome.ok).toBe(false);
    expect(outcome.steps.filter((step) => step.elementId === 'Decision_needs_input')).toHaveLength(1);
  });
});

describe('loadSimulationModels', () => {
  it('returns the URIs of loaded imports and reports ambiguous namespaces', async () => {
    const loaded = await loadSimulationModels(CONSUMER_XML, {
      listDecisionModels: async () => [
        { uri: 'first.dmn', namespace: HELPER_NAMESPACE },
        { uri: 'second.dmn', namespace: HELPER_NAMESPACE },
      ],
      loadText: async () => HELPER_XML,
    });

    expect(loaded.importedModelUris).toEqual({ [HELPER_NAMESPACE]: 'first.dmn' });
    expect(loaded.ambiguousImports).toEqual([
      { namespace: HELPER_NAMESPACE, chosenUri: 'first.dmn', ignoredUris: ['second.dmn'] },
    ]);
  });
});
