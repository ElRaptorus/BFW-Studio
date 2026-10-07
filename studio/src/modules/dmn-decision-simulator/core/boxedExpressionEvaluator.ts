import { FeelFunction } from '@bpmn-io/feelin';

import type {
  DmnBoxedConditional,
  DmnBoxedContext,
  DmnBoxedEvery,
  DmnBoxedFilter,
  DmnBoxedFor,
  DmnBoxedInvocation,
  DmnBoxedList,
  DmnBoxedSome,
  DmnDecisionTable,
  DmnDefinitions,
  DmnExpressionBody,
  DmnFunctionDefinition,
  DmnLiteralExpression,
  DmnRelation,
} from '@elraptorus/bfw_engine_sdk';

import { findBusinessKnowledgeModelByName, invokeBusinessKnowledgeModel } from './bkmInvoker';
import { evaluateDecisionTable } from './decisionTableEvaluator';
import { evaluateExpression } from './feel';
import type { EvaluationEnvironment, FeelContext } from './types';
import { SimulationError } from './types';

/** Evaluates any expression body (Engine `evaluate_expression_body/3`). Decision tables keep the output map. */
export function evaluateExpressionBody(
  body: DmnExpressionBody | null | undefined,
  context: FeelContext,
  environment: EvaluationEnvironment,
): unknown {
  if (body == null) {
    throw new SimulationError('missing_expression', 'A boxed expression is empty; fill it in or remove it.');
  }
  if ('hitPolicy' in body) {
    return evaluateDecisionTable(body as DmnDecisionTable, context, { unwrapSingleOutput: false }).result;
  }
  if ('text' in body) {
    return evaluateExpression((body as DmnLiteralExpression).text, context);
  }
  if ('contextEntries' in body) {
    return evaluateContext(body, context, environment);
  }
  if ('calledFunction' in body) {
    return evaluateInvocation(body, context, environment);
  }
  if ('elements' in body) {
    return (body as DmnBoxedList).elements.map((element) => evaluateExpressionBody(element, context, environment));
  }
  if ('rows' in body) {
    return evaluateRelation(body, context, environment);
  }
  if ('formalParameters' in body) {
    return toFeelFunction(body, context, environment);
  }
  if ('ifExpression' in body) {
    return evaluateConditional(body, context, environment);
  }
  if ('matchExpression' in body) {
    return evaluateFilter(body, context, environment);
  }
  if ('returnExpression' in body) {
    return evaluateFor(body, context, environment);
  }
  if ('satisfiesExpression' in body) {
    return evaluateQuantifier(body, context, environment);
  }
  throw new SimulationError('unsupported_expression', 'This boxed expression type is not supported by the simulator.');
}

function evaluateContext(body: DmnBoxedContext, context: FeelContext, environment: EvaluationEnvironment): unknown {
  let accumulated: FeelContext = { ...context };
  let resultValue: { value: unknown } | null = null;
  for (const entry of body.contextEntries) {
    const value = evaluateExpressionBody(entry.expression, accumulated, environment);
    if (entry.variable == null) {
      resultValue = { value };
    } else {
      accumulated = { ...accumulated, [entry.variable.name]: value };
      resultValue = null;
    }
  }
  if (resultValue != null) {
    return resultValue.value;
  }
  // Entries that shadow an incoming variable are dropped from the result (Engine `Map.drop/2` behaviour).
  return Object.fromEntries(Object.entries(accumulated).filter(([key]) => !(key in context)));
}

function evaluateInvocation(
  body: DmnBoxedInvocation,
  context: FeelContext,
  environment: EvaluationEnvironment,
): unknown {
  const knowledgeModel = findBusinessKnowledgeModelByName(environment.definitions, body.calledFunction);
  if (knowledgeModel == null) {
    throw new SimulationError(
      'bkm_not_found',
      `Business knowledge model '${body.calledFunction}' was not found in this model.`,
      { bkmId: body.calledFunction },
    );
  }
  const boundParameters = Object.fromEntries(
    body.bindings.map((binding) => [
      binding.parameter?.name ?? '',
      evaluateExpressionBody(binding.expression, context, environment),
    ]),
  );
  return invokeBusinessKnowledgeModel(knowledgeModel, { ...context, ...boundParameters }, environment).result;
}

function evaluateRelation(body: DmnRelation, context: FeelContext, environment: EvaluationEnvironment): unknown[] {
  return body.rows.map((row) =>
    Object.fromEntries(
      body.columns.map((column, index) => [column.name, evaluateExpressionBody(row[index], context, environment)]),
    ),
  );
}

function evaluateConditional(
  body: DmnBoxedConditional,
  context: FeelContext,
  environment: EvaluationEnvironment,
): unknown {
  const condition = evaluateExpressionBody(body.ifExpression, context, environment);
  return evaluateExpressionBody(condition === true ? body.thenExpression : body.elseExpression, context, environment);
}

function evaluateSourceList(
  source: DmnExpressionBody | null,
  context: FeelContext,
  environment: EvaluationEnvironment,
  errorCode: string,
): unknown[] {
  const value = evaluateExpressionBody(source, context, environment);
  if (!Array.isArray(value)) {
    throw new SimulationError(errorCode, 'The iterated expression must evaluate to a list.');
  }
  return value;
}

function evaluateFilter(body: DmnBoxedFilter, context: FeelContext, environment: EvaluationEnvironment): unknown[] {
  return evaluateSourceList(body.inExpression, context, environment, 'filter_source_not_list').filter(
    (item) => evaluateExpressionBody(body.matchExpression, { ...context, item }, environment) === true,
  );
}

function evaluateFor(body: DmnBoxedFor, context: FeelContext, environment: EvaluationEnvironment): unknown[] {
  return evaluateSourceList(body.inExpression, context, environment, 'iterator_source_not_list').map((item) =>
    evaluateExpressionBody(body.returnExpression, { ...context, [body.iteratorVariable]: item }, environment),
  );
}

function evaluateQuantifier(
  body: DmnBoxedEvery | DmnBoxedSome,
  context: FeelContext,
  environment: EvaluationEnvironment,
): boolean {
  const items = evaluateSourceList(body.inExpression, context, environment, 'iterator_source_not_list');
  const satisfies = (item: unknown): boolean =>
    evaluateExpressionBody(body.satisfiesExpression, { ...context, [body.iteratorVariable]: item }, environment) ===
    true;
  return iteratorKindOf(environment.definitions, body) === 'some' ? items.some(satisfies) : items.every(satisfies);
}

function toFeelFunction(
  body: DmnFunctionDefinition,
  context: FeelContext,
  environment: EvaluationEnvironment,
): FeelFunction {
  const parameterNames = body.formalParameters.map((parameter) => parameter.name);
  return new FeelFunction(
    (...argumentValues: unknown[]) =>
      evaluateExpressionBody(
        body.body,
        { ...context, ...Object.fromEntries(parameterNames.map((name, index) => [name, argumentValues[index]])) },
        environment,
      ),
    parameterNames,
  );
}

type IteratorKind = 'every' | 'some';

const kindsByDefinitions = new WeakMap<DmnDefinitions, Map<string, IteratorKind>>();

const ITERATOR_ELEMENT = /<(?:[\w.-]+:)?(every|some)\b([^>]*)>/g;
const IDENTIFIER_ATTRIBUTE = /\bid\s*=\s*["']([^"']+)["']/;

/**
 * The parsed model represents `<every>` and `<some>` with the same shape (`satisfiesExpression`), so the element
 * kind is recovered from the raw XML by element id. An iterator without an id defaults to `every`.
 */
function iteratorKindOf(definitions: DmnDefinitions, body: DmnBoxedEvery | DmnBoxedSome): IteratorKind {
  let kinds = kindsByDefinitions.get(definitions);
  if (kinds == null) {
    kinds = new Map();
    for (const match of definitions.rawXml.matchAll(ITERATOR_ELEMENT)) {
      const identifier = IDENTIFIER_ATTRIBUTE.exec(match[2])?.[1];
      if (identifier != null) {
        kinds.set(identifier, match[1] as IteratorKind);
      }
    }
    kindsByDefinitions.set(definitions, kinds);
  }
  return (body.id != null ? kinds.get(body.id) : undefined) ?? 'every';
}
