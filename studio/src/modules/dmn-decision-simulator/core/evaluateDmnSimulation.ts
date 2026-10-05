import type {
  DecisionTrace,
  DmnDecision,
  DmnDecisionService,
  DmnDefinitions,
  DmnInformationRequirement,
  DmnInputData,
  DmnServiceEvaluationResult,
  EvaluationResult,
  ImportTrace,
  InputTrace,
} from '@elraptorus/bfw_engine_sdk';
import { DmnHitPolicy } from '@elraptorus/bfw_engine_sdk';

import { isImportedReference, splitQualifiedReference } from '../../dmn-core/qualifiedReference';
import { bindRequiredKnowledge } from './bkmInvoker';
import { evaluateExpressionBody } from './boxedExpressionEvaluator';
import { evaluateDecisionTable } from './decisionTableEvaluator';
import { resolveEvaluationOrder } from './dependencyResolver';
import { evaluateExpression, takePendingWarnings } from './feel';
import { resolveImportedModel } from './importResolution';
import { serializeFeelValue } from './serializeFeelValue';
import type {
  EvaluationEnvironment,
  FeelContext,
  SimulationOutcome,
  SimulationRequest,
  SimulationStep,
  SimulationStepType,
} from './types';
import { DEFAULT_MAX_IMPORT_DEPTH, SimulationError } from './types';

type Session = {
  importedModels: ReadonlyMap<string, DmnDefinitions>;
  maxImportDepth: number;
  steps: SimulationStep[];
  recordedInputs: Set<string>;
};

type DecisionOutcome = { trace: DecisionTrace; result: unknown };
type ChainOutcome = { traces: DecisionTrace[]; result: unknown };

const elapsedMicroseconds = (startedAt: number): number => Math.round((performance.now() - startedAt) * 1000);

export function outputVariableNameOfDecision(decision: DmnDecision): string {
  return decision.variable?.name ?? decision.name ?? decision.id;
}

function recordStep(session: Session, step: Omit<SimulationStep, 'warnings'> & { warnings?: string[] }): void {
  session.steps.push({
    ...step,
    warnings: step.warnings != null && step.warnings.length > 0 ? step.warnings : undefined,
  });
}

function recordInputStep(session: Session, inputData: DmnInputData, namespace: string | null, value: unknown): void {
  const key = `${namespace ?? ''}|${inputData.id}`;
  if (session.recordedInputs.has(key)) {
    return;
  }
  session.recordedInputs.add(key);
  recordStep(session, { elementId: inputData.id, elementName: inputData.name, namespace, type: 'inputData', value });
}

function createEnvironment(
  session: Session,
  definitions: DmnDefinitions,
  namespace: string | null,
): EvaluationEnvironment {
  return {
    definitions,
    namespace,
    importedModels: session.importedModels,
    bkmTraces: [],
    onKnowledgeModelInvoked: (invocation) =>
      recordStep(session, {
        elementId: invocation.id,
        elementName: invocation.name,
        namespace: invocation.namespace,
        type: 'businessKnowledgeModel' satisfies SimulationStepType,
        value: invocation.result,
      }),
  };
}

// --- Required elements -------------------------------------------------------------------------------------------

function bindRequiredInput(
  session: Session,
  requirement: DmnInformationRequirement,
  definitions: DmnDefinitions,
  decision: DmnDecision,
  context: FeelContext,
  namespace: string | null,
): void {
  if (requirement.requiredInputId == null) {
    return;
  }
  const reference = requirement.requiredInputId;
  const { namespace: importedNamespace, elementId } = splitQualifiedReference(reference);
  const owner =
    isImportedReference(reference) && importedNamespace != null
      ? resolveImportedModel(definitions, session.importedModels, importedNamespace, decision.id)
      : definitions;
  const inputData = owner.inputData.find((candidate) => candidate.id === elementId);
  const inputName = inputData?.name ?? elementId;
  if (inputData == null || !(inputName in context)) {
    throw new SimulationError(
      'missing_required_input',
      `Decision '${decision.id}' requires input data '${inputName}', which has no value.`,
      { inputDataId: elementId, inputDataName: inputName },
    );
  }
  recordInputStep(session, inputData, importedNamespace ?? namespace, context[inputName]);
}

function evaluateImportedDecision(
  session: Session,
  reference: string,
  definitions: DmnDefinitions,
  decision: DmnDecision,
  context: FeelContext,
  depth: number,
): { variableName: string; result: unknown; trace: ImportTrace } {
  const { namespace, elementId } = splitQualifiedReference(reference);
  const imported = resolveImportedModel(definitions, session.importedModels, namespace ?? '', decision.id);
  const importedDecision = imported.decisions.find((candidate) => candidate.id === elementId);
  if (importedDecision == null) {
    throw new SimulationError(
      'missing_required_decision',
      `Decision '${decision.id}' requires decision '${reference}', which does not exist in the imported model.`,
      { decisionId: reference, requiredBy: decision.id },
    );
  }
  if (depth + 1 > session.maxImportDepth) {
    throw new SimulationError(
      'max_import_depth_exceeded',
      `Imports are nested deeper than the limit of ${session.maxImportDepth}.`,
      {
        depth: depth + 1,
        max: session.maxImportDepth,
      },
    );
  }
  const startedAt = performance.now();
  const chain = evaluateDecisionChain(session, imported, importedDecision.id, context, depth + 1, namespace);
  return {
    variableName: outputVariableNameOfDecision(importedDecision),
    result: chain.result,
    trace: {
      namespace: namespace ?? '',
      decisionId: importedDecision.id,
      sourceDefinitionsId: imported.id ?? '',
      evaluationTrace: { decisions: chain.traces, inputCoercions: [] },
      result: chain.result,
      durationMicroseconds: elapsedMicroseconds(startedAt),
    },
  };
}

function bindRequiredDecisions(
  session: Session,
  definitions: DmnDefinitions,
  decision: DmnDecision,
  context: FeelContext,
  depth: number,
): { context: FeelContext; importTraces: ImportTrace[] } {
  let accumulated = context;
  const importTraces: ImportTrace[] = [];
  for (const requirement of decision.informationRequirements) {
    const reference = requirement.requiredDecisionId;
    if (reference == null) {
      continue;
    }
    if (isImportedReference(reference)) {
      const imported = evaluateImportedDecision(session, reference, definitions, decision, accumulated, depth);
      importTraces.push(imported.trace);
      accumulated = { ...accumulated, [imported.variableName]: imported.result };
      continue;
    }
    const required = definitions.decisions.find((candidate) => candidate.id === reference);
    if (required == null || !(outputVariableNameOfDecision(required) in accumulated)) {
      throw new SimulationError(
        'missing_required_decision',
        `Decision '${decision.id}' requires decision '${reference}', which has not been evaluated.`,
        { decisionId: reference, requiredBy: decision.id },
      );
    }
  }
  return { context: accumulated, importTraces };
}

// --- One decision ------------------------------------------------------------------------------------------------

function describeInputs(decision: DmnDecision, definitions: DmnDefinitions, context: FeelContext): InputTrace[] {
  const names = decision.informationRequirements.flatMap((requirement) => {
    const inputName = definitions.inputData.find((candidate) => candidate.id === requirement.requiredInputId)?.name;
    const requiredDecision = definitions.decisions.find((candidate) => candidate.id === requirement.requiredDecisionId);
    return [inputName, requiredDecision == null ? undefined : outputVariableNameOfDecision(requiredDecision)];
  });
  return names
    .filter((name): name is string => name != null)
    .map((name) => ({ inputId: name, inputLabel: name, expression: name, resolvedValue: context[name] ?? null }));
}

function evaluateDecisionExpression(
  decision: DmnDecision,
  definitions: DmnDefinitions,
  context: FeelContext,
  environment: EvaluationEnvironment,
): { trace: DecisionTrace; rules?: { ruleId: string; matched: boolean }[] } {
  const expression = decision.expression;
  const baseTrace = {
    decisionModelId: decision.id,
    decisionName: decision.name,
    unmatchedRulesCount: 0,
    warnings: [],
    bkmTraces: [],
    importTraces: [],
  };
  const startedAt = performance.now();
  if (expression != null && 'hitPolicy' in expression) {
    const evaluation = evaluateDecisionTable(expression, context, { unwrapSingleOutput: false });
    const matchedIds = new Set(evaluation.matchedRules.map((rule) => rule.ruleId));
    return {
      trace: {
        ...baseTrace,
        hitPolicy: expression.hitPolicy,
        inputs: evaluation.inputs,
        matchedRules: evaluation.matchedRules,
        unmatchedRules: evaluation.unmatchedRules,
        unmatchedRulesCount: evaluation.unmatchedRules.length,
        result: evaluation.result as DecisionTrace['result'],
        durationMicroseconds: elapsedMicroseconds(startedAt),
      },
      rules: expression.rules.map((rule) => ({ ruleId: rule.id, matched: matchedIds.has(rule.id) })),
    };
  }
  const isLiteral = expression != null && 'text' in expression;
  const result = isLiteral
    ? evaluateExpression(expression.text, context)
    : evaluateExpressionBody(expression, context, environment);
  return {
    trace: {
      ...baseTrace,
      hitPolicy: isLiteral ? DmnHitPolicy.Literal : DmnHitPolicy.BoxedExpression,
      inputs: describeInputs(decision, definitions, context),
      matchedRules: [],
      result: result as DecisionTrace['result'],
      durationMicroseconds: elapsedMicroseconds(startedAt),
    },
  };
}

function evaluateSingleDecision(
  session: Session,
  definitions: DmnDefinitions,
  decision: DmnDecision,
  sharedContext: FeelContext,
  depth: number,
  namespace: string | null,
): DecisionOutcome {
  const step = { elementId: decision.id, elementName: decision.name, namespace, type: 'decision' as const };
  try {
    if (decision.expression == null) {
      throw new SimulationError('missing_decision_logic', `Decision '${decision.id}' has no value expression.`, {
        decisionId: decision.id,
      });
    }
    decision.informationRequirements.forEach((requirement) =>
      bindRequiredInput(session, requirement, definitions, decision, sharedContext, namespace),
    );
    const bound = bindRequiredDecisions(session, definitions, decision, sharedContext, depth);
    const environment = createEnvironment(session, definitions, namespace);
    const decisionContext = bindRequiredKnowledge(decision.knowledgeRequirements, environment, bound.context);
    takePendingWarnings();
    const evaluation = evaluateDecisionExpression(decision, definitions, decisionContext, environment);
    const warnings = takePendingWarnings();
    const trace: DecisionTrace = {
      ...evaluation.trace,
      importTraces: bound.importTraces,
      bkmTraces: environment.bkmTraces,
      warnings: warnings.map((message) => ({ message })),
    };
    recordStep(session, { ...step, value: trace.result, rules: evaluation.rules, warnings });
    return { trace, result: trace.result };
  } catch (error) {
    if (
      error instanceof SimulationError &&
      !session.steps.some(
        (recorded) =>
          recorded.error != null && recorded.elementId === step.elementId && recorded.namespace === namespace,
      )
    ) {
      recordStep(session, { ...step, error: { code: error.code, message: error.message } });
    }
    throw error;
  }
}

/** Evaluates `targetId` and its local upstream decisions, binding each result for the next (Engine decision chain). */
function evaluateDecisionChain(
  session: Session,
  definitions: DmnDefinitions,
  targetId: string,
  inputContext: FeelContext,
  depth: number,
  namespace: string | null,
): ChainOutcome {
  let context = inputContext;
  const traces: DecisionTrace[] = [];
  let result: unknown = null;
  for (const decision of resolveEvaluationOrder(definitions, targetId)) {
    const outcome = evaluateSingleDecision(session, definitions, decision, context, depth, namespace);
    traces.push(outcome.trace);
    result = outcome.result;
    context = { ...context, [outputVariableNameOfDecision(decision)]: outcome.result };
  }
  return { traces, result };
}

// --- Decision service --------------------------------------------------------------------------------------------

function evaluateService(
  session: Session,
  definitions: DmnDefinitions,
  service: DmnDecisionService,
  inputs: FeelContext,
): DmnServiceEvaluationResult {
  const startedAt = performance.now();
  const decisionsById = new Map(definitions.decisions.map((decision) => [decision.id, decision]));
  const referenced = [...service.outputDecisions, ...service.encapsulatedDecisions, ...service.inputDecisions];
  const missingReference = referenced.find((identifier) => !decisionsById.has(identifier));
  if (missingReference != null) {
    throw new SimulationError(
      'missing_service_decision',
      `Decision service '${service.id}' references decision '${missingReference}', which does not exist.`,
      {
        decisionId: missingReference,
        serviceId: service.id,
      },
    );
  }
  const requiredNames = service.inputData.map(
    (identifier) => definitions.inputData.find((candidate) => candidate.id === identifier)?.name ?? identifier,
  );
  const missingInputs = requiredNames.filter((name) => inputs[name] == null);
  if (missingInputs.length > 0) {
    throw new SimulationError(
      'missing_service_input',
      `Decision service '${service.id}' requires inputs: ${missingInputs.join(', ')}.`,
      {
        serviceId: service.id,
        missingInputs,
      },
    );
  }

  const traces: DecisionTrace[] = [];
  const seenDecisionIds = new Set<string>();
  const collect = (newTraces: DecisionTrace[]): void =>
    newTraces.forEach((trace) => {
      if (!seenDecisionIds.has(trace.decisionModelId)) {
        seenDecisionIds.add(trace.decisionModelId);
        traces.push(trace);
      }
    });

  let context = inputs;
  for (const inputDecisionId of service.inputDecisions) {
    const chain = evaluateDecisionChain(session, definitions, inputDecisionId, context, 0, null);
    collect(chain.traces);
    const decision = decisionsById.get(inputDecisionId) as DmnDecision;
    context = { ...context, [outputVariableNameOfDecision(decision)]: chain.result };
  }

  const scoped: DmnDefinitions = {
    ...definitions,
    decisions: definitions.decisions.filter((decision) => referenced.includes(decision.id)),
  };
  const evaluatable = new Set([...service.outputDecisions, ...service.encapsulatedDecisions]);
  const order = [
    ...new Map(
      service.outputDecisions
        .flatMap((outputId) => resolveEvaluationOrder(scoped, outputId))
        .map((decision) => [decision.id, decision]),
    ).values(),
  ];
  for (const decision of order.filter((candidate) => evaluatable.has(candidate.id))) {
    const outcome = evaluateSingleDecision(session, scoped, decision, context, 0, null);
    collect([outcome.trace]);
    context = { ...context, [outputVariableNameOfDecision(decision)]: outcome.result };
  }

  const outputs = Object.fromEntries(
    service.outputDecisions.map((outputId) => {
      const name = outputVariableNameOfDecision(decisionsById.get(outputId) as DmnDecision);
      return [name, context[name] ?? null];
    }),
  );
  recordStep(session, {
    elementId: service.id,
    elementName: service.name,
    namespace: null,
    type: 'decisionService',
    value: outputs,
  });
  return {
    serviceId: service.id,
    serviceName: service.name,
    outputs,
    trace: { decisions: traces, inputCoercions: [] },
    evaluatedAt: new Date().toISOString(),
    durationMicroseconds: elapsedMicroseconds(startedAt),
  };
}

// --- Entry -------------------------------------------------------------------------------------------------------

function evaluateInputExpressions(inputExpressions: Record<string, string> | undefined): FeelContext {
  return Object.fromEntries(
    Object.entries(inputExpressions ?? {}).map(([name, text]) => {
      try {
        return [name, text.trim() === '' ? null : evaluateExpression(text, {})];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new SimulationError('input_expression_failed', `Input '${name}' is not a valid FEEL value: ${reason}`, {
          inputName: name,
          expression: text,
        });
      }
    }),
  );
}

function evaluateDecisionTarget(session: Session, request: SimulationRequest, inputs: FeelContext): EvaluationResult {
  const startedAt = performance.now();
  const { model, target } = request;
  const targetDecision = model.decisions.find((decision) => decision.id === target.id);
  if (targetDecision == null) {
    throw new SimulationError('decision_not_found', `Decision '${target.id}' does not exist in this model.`, {
      decisionId: target.id,
    });
  }
  const chain = evaluateDecisionChain(session, model, targetDecision.id, inputs, 0, null);
  const targetTrace = chain.traces[chain.traces.length - 1];
  return {
    decisionModelId: targetDecision.id,
    decisionName: targetDecision.name,
    hitPolicy: targetTrace.hitPolicy,
    result: chain.result as EvaluationResult['result'],
    matchedRules: targetTrace.matchedRules.map((rule) => rule.ruleId),
    trace: { decisions: chain.traces, inputCoercions: [] },
    evaluatedAt: new Date().toISOString(),
    durationMicroseconds: elapsedMicroseconds(startedAt),
    definitionsId: model.id,
    definitionsNamespace: model.namespace,
    decisionVersionId: null,
  };
}

/** A failure before or outside the target's own evaluation (missing service input, cycle) still marks the target. */
function recordTargetErrorStep(session: Session, request: SimulationRequest, error: unknown): void {
  const { target, model } = request;
  const targetElement =
    target.kind === 'decision'
      ? model.decisions.find((decision) => decision.id === target.id)
      : model.decisionServices.find((service) => service.id === target.id);
  const alreadyRecorded = session.steps.some((step) => step.namespace == null && step.elementId === target.id);
  if (targetElement == null || alreadyRecorded) {
    return;
  }
  recordStep(session, {
    elementId: target.id,
    elementName: targetElement.name,
    namespace: null,
    type: target.kind === 'decision' ? 'decision' : 'decisionService',
    error: {
      code: error instanceof SimulationError ? error.code : 'unexpected_error',
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

/**
 * Evaluates a decision or decision service of a parsed DMN model exactly like the Engine would (hit policies,
 * boxed expressions, BKM invocation, cross-model imports, decision services). The outcome is JSON-safe.
 */
export function evaluateDmnSimulation(request: SimulationRequest): SimulationOutcome {
  const session: Session = {
    importedModels: request.importedModels,
    maxImportDepth: request.maxImportDepth ?? DEFAULT_MAX_IMPORT_DEPTH,
    steps: [],
    recordedInputs: new Set(),
  };
  try {
    takePendingWarnings();
    const inputs = { ...request.inputs, ...evaluateInputExpressions(request.inputExpressions) };
    if (request.target.kind === 'decisionService') {
      const service = request.model.decisionServices.find((candidate) => candidate.id === request.target.id);
      if (service == null) {
        throw new SimulationError(
          'service_not_found',
          `Decision service '${request.target.id}' does not exist in this model.`,
          { serviceId: request.target.id },
        );
      }
      const result = evaluateService(session, request.model, service, inputs);
      return serializeFeelValue({
        ok: true,
        kind: 'decisionService',
        result,
        steps: session.steps,
      }) as SimulationOutcome;
    }
    const result = evaluateDecisionTarget(session, request, inputs);
    return serializeFeelValue({ ok: true, kind: 'decision', result, steps: session.steps }) as SimulationOutcome;
  } catch (error) {
    const known = error instanceof SimulationError;
    recordTargetErrorStep(session, request, error);
    const outcome: SimulationOutcome = {
      ok: false,
      error: {
        code: known ? error.code : 'unexpected_error',
        message: error instanceof Error ? error.message : String(error),
        detail: known ? error.detail : undefined,
      },
      steps: session.steps,
    };
    return serializeFeelValue(outcome) as SimulationOutcome;
  }
}

/** Input data names that exist only in imported models: they are not in the DRD but the evaluation needs them. */
export function collectImportedInputNames(
  model: DmnDefinitions,
  importedModels: ReadonlyMap<string, DmnDefinitions>,
): { name: string; namespace: string }[] {
  const ownNames = new Set(model.inputData.map((inputData) => inputData.name));
  const result: { name: string; namespace: string }[] = [];
  for (const [namespace, imported] of importedModels) {
    for (const inputData of imported.inputData) {
      if (!ownNames.has(inputData.name) && !result.some((entry) => entry.name === inputData.name)) {
        result.push({ name: inputData.name, namespace });
      }
    }
  }
  return result;
}
