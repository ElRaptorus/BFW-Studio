import { evaluate, unaryTest } from '@bpmn-io/feelin';

import type { FeelContext } from './types';
import { SimulationError } from './types';

/** feelin reports problems as warnings and evaluates to `null`; the Engine's FEEL engine raises for unresolved names. */
const FATAL_WARNING_TYPES = new Set(['NO_VARIABLE_FOUND', 'NO_FUNCTION_FOUND']);

let pendingWarnings: string[] = [];

/** Warnings collected since the last call; steps attach them so a typo in a variable name is visible. */
export function takePendingWarnings(): string[] {
  const warnings = pendingWarnings;
  pendingWarnings = [];
  return warnings;
}

type FeelWarning = { type: string; message: string };

function collectWarnings(warnings: FeelWarning[], value: unknown, expression: string): void {
  const fatal = warnings.find((warning) => FATAL_WARNING_TYPES.has(warning.type));
  if (fatal != null && value == null) {
    throw new SimulationError('feel_evaluation_error', `FEEL expression '${expression}' failed: ${fatal.message}`, {
      expression,
      warnings: warnings.map((warning) => warning.message),
    });
  }
  pendingWarnings.push(...warnings.map((warning) => warning.message));
}

function wrapFeelError(error: unknown, expression: string): never {
  if (error instanceof SimulationError) {
    throw error;
  }
  const reason = error instanceof Error ? error.message : String(error);
  throw new SimulationError('feel_evaluation_error', `FEEL expression '${expression}' failed: ${reason}`, {
    expression,
    reason,
  });
}

/** Evaluates a FEEL expression; syntax errors and unresolved names raise a `SimulationError`. */
export function evaluateExpression(expression: string, context: FeelContext): unknown {
  try {
    const { value, warnings } = evaluate(expression, context);
    collectWarnings(warnings, value, expression);
    return value;
  } catch (error) {
    return wrapFeelError(error, expression);
  }
}

/** Evaluates unary tests against `inputValue`. Anything that is not exactly `true` is a non-match (Engine semantics). */
export function evaluateUnaryTests(expression: string, inputValue: unknown, context: FeelContext = {}): boolean {
  try {
    const { value, warnings } = unaryTest(expression, { ...context, '?': inputValue });
    collectWarnings(warnings, value, expression);
    return value === true;
  } catch (error) {
    return wrapFeelError(error, expression);
  }
}
