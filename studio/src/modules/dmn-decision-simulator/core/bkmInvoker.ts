import type {
  BkmTrace,
  DmnBusinessKnowledgeModel,
  DmnDefinitions,
  DmnKnowledgeRequirement,
} from '@elraptorus/bfw_engine_sdk';

import { isImportedReference, splitQualifiedReference } from '../../dmn-core/qualifiedReference';
import { evaluateExpressionBody } from './boxedExpressionEvaluator';
import { evaluateDecisionTable } from './decisionTableEvaluator';
import { evaluateExpression } from './feel';
import { resolveImportedModel } from './importResolution';
import type { EvaluationEnvironment, FeelContext } from './types';
import { SimulationError } from './types';

/** Name under which a BKM's result is bound: `variable.name` > `name` > `id`. */
export function outputVariableNameOfKnowledgeModel(knowledgeModel: DmnBusinessKnowledgeModel): string {
  return knowledgeModel.variable?.name ?? knowledgeModel.name ?? knowledgeModel.id;
}

export function findBusinessKnowledgeModelByName(
  definitions: DmnDefinitions,
  calledFunction: string,
): DmnBusinessKnowledgeModel | undefined {
  const models = definitions.businessKnowledgeModels;
  return (
    models.find((model) => model.name === calledFunction) ??
    models.find((model) => model.id === calledFunction) ??
    models.find((model) => outputVariableNameOfKnowledgeModel(model) === calledFunction)
  );
}

export type KnowledgeInvocation = { result: unknown; variableName: string; trace: BkmTrace };

/**
 * Invokes every required BKM before the calling expression is evaluated and binds each result under the BKM's
 * variable name (Engine `resolve_and_invoke/5`). Traces are appended to `environment.bkmTraces`.
 */
export function bindRequiredKnowledge(
  requirements: DmnKnowledgeRequirement[],
  environment: EvaluationEnvironment,
  context: FeelContext,
): FeelContext {
  let accumulated = context;
  for (const requirement of requirements) {
    const invocation = invokeByReference(requirement.requiredKnowledgeId, environment, accumulated, new Set());
    environment.bkmTraces.push(invocation.trace);
    accumulated = { ...accumulated, [invocation.variableName]: invocation.result };
  }
  return accumulated;
}

/** Invokes one local BKM with parameters read from `callingContext` (used by boxed invocations). */
export function invokeBusinessKnowledgeModel(
  knowledgeModel: DmnBusinessKnowledgeModel,
  callingContext: FeelContext,
  environment: EvaluationEnvironment,
): KnowledgeInvocation {
  const invocation = invokeKnowledgeModel(
    knowledgeModel,
    environment,
    callingContext,
    new Set([knowledgeModel.id]),
    null,
  );
  environment.bkmTraces.push(invocation.trace);
  return invocation;
}

function invokeByReference(
  reference: string,
  environment: EvaluationEnvironment,
  callingContext: FeelContext,
  visiting: Set<string>,
): KnowledgeInvocation {
  const { namespace, elementId } = splitQualifiedReference(reference);
  let owner = environment.definitions;
  if (isImportedReference(reference) && namespace != null) {
    owner = resolveImportedModel(environment.definitions, environment.importedModels, namespace, reference);
  }
  const knowledgeModel = owner.businessKnowledgeModels.find((model) => model.id === elementId);
  if (knowledgeModel == null) {
    throw new SimulationError('bkm_not_found', `Business knowledge model '${reference}' was not found.`, {
      bkmId: reference,
    });
  }
  if (visiting.has(reference)) {
    throw new SimulationError(
      'bkm_cycle',
      `Business knowledge models require each other in a cycle: ${[...visiting, reference].join(' → ')}.`,
      {
        bkmIds: [...visiting, reference],
      },
    );
  }
  const nested = namespace == null ? environment : { ...environment, definitions: owner, namespace };
  return invokeKnowledgeModel(knowledgeModel, nested, callingContext, new Set([...visiting, reference]), namespace);
}

function invokeKnowledgeModel(
  knowledgeModel: DmnBusinessKnowledgeModel,
  environment: EvaluationEnvironment,
  callingContext: FeelContext,
  visiting: Set<string>,
  namespace: string | null,
): KnowledgeInvocation {
  const startedAt = performance.now();
  const logic = knowledgeModel.encapsulatedLogic;
  if (logic == null || logic.body == null) {
    throw new SimulationError(
      'bkm_empty_body',
      `Business knowledge model '${knowledgeModel.id}' has no function body.`,
      {
        bkmId: knowledgeModel.id,
      },
    );
  }
  // The body sees only its formal parameters and the results of the BKMs it requires (Engine semantics).
  const parameters = logic.formalParameters.map((parameter) => ({
    name: parameter.name,
    boundValue: callingContext[parameter.name] ?? null,
  }));
  let bodyContext: FeelContext = Object.fromEntries(
    parameters.map((parameter) => [parameter.name, parameter.boundValue]),
  );
  const dependentTraces: BkmTrace[] = [];
  for (const requirement of knowledgeModel.knowledgeRequirements) {
    const dependent = invokeByReference(requirement.requiredKnowledgeId, environment, callingContext, visiting);
    dependentTraces.push(dependent.trace);
    bodyContext = { ...bodyContext, [dependent.variableName]: dependent.result };
  }

  const result = evaluateFunctionBody(logic.body, bodyContext, environment);
  const variableName = outputVariableNameOfKnowledgeModel(knowledgeModel);
  environment.onKnowledgeModelInvoked?.({
    id: knowledgeModel.id,
    name: knowledgeModel.name,
    namespace: namespace ?? environment.namespace,
    result,
  });
  return {
    result,
    variableName,
    trace: {
      bkmId: knowledgeModel.id,
      bkmName: knowledgeModel.name,
      formalParameters: parameters,
      result,
      durationMicroseconds: Math.round((performance.now() - startedAt) * 1000),
      dependentBkmTraces: dependentTraces,
    },
  };
}

function evaluateFunctionBody(
  body: NonNullable<DmnBusinessKnowledgeModel['encapsulatedLogic']>['body'],
  context: FeelContext,
  environment: EvaluationEnvironment,
): unknown {
  if (body != null && 'hitPolicy' in body) {
    return evaluateDecisionTable(body, context, { unwrapSingleOutput: true }).result;
  }
  if (body != null && 'text' in body) {
    return evaluateExpression(body.text, context);
  }
  return evaluateExpressionBody(body, context, environment);
}
