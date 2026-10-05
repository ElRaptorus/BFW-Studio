import type {
  DmnDecisionTable,
  DmnInput,
  DmnOutput,
  DmnRule,
  InputEntryTrace,
  InputTrace,
  RuleTrace,
} from '@elraptorus/bfw_engine_sdk';

import { evaluateExpression, evaluateUnaryTests } from './feel';
import type { OutputRecord } from './hitPolicies';
import { applyHitPolicy } from './hitPolicies';
import { describeValue } from './serializeFeelValue';
import type { FeelContext } from './types';
import { SimulationError } from './types';

export type DecisionTableEvaluation = {
  result: unknown;
  inputs: InputTrace[];
  matchedRules: RuleTrace[];
  unmatchedRules: RuleTrace[];
};

/** Display key of an output column: `name` > `label` > `output_<index>` (Engine `named_output_key/2`). */
export function outputKeyOf(output: DmnOutput | undefined, index: number): string {
  if (output?.name != null && output.name !== '') {
    return output.name;
  }
  if (output?.label != null && output.label !== '') {
    return output.label;
  }
  return `output_${index}`;
}

function isWildcard(entryText: string): boolean {
  return entryText === '-' || entryText === '';
}

/** A unary test that cannot be evaluated is a non-match (Engine semantics). */
function entryMatches(entryText: string, value: unknown): boolean {
  if (isWildcard(entryText)) {
    return true;
  }
  try {
    return evaluateUnaryTests(entryText, value);
  } catch {
    return false;
  }
}

/** Output entries are evaluated without the decision context; unevaluable text stays raw text (Engine semantics). */
function evaluateOutputEntry(entryText: string): unknown {
  try {
    return evaluateExpression(entryText, {});
  } catch {
    return entryText;
  }
}

function evaluateOutputEntries(rule: DmnRule, outputs: DmnOutput[]): OutputRecord {
  return Object.fromEntries(
    rule.outputEntries.map((entry, index) => [outputKeyOf(outputs[index], index), evaluateOutputEntry(entry.text)]),
  );
}

function unwrapSingleOutput(result: unknown, table: DmnDecisionTable): unknown {
  if (table.outputs.length !== 1 || result == null || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }
  const values = Object.values(result);
  return values.length === 1 ? values[0] : result;
}

function evaluateDefaultOutputs(table: DmnDecisionTable): unknown {
  if (table.outputs.every((output) => output.defaultOutputValue == null)) {
    return null;
  }
  const defaults = Object.fromEntries(
    table.outputs.map((output, index) => {
      const text = output.defaultOutputValue;
      return [outputKeyOf(output, index), text == null || text === '' ? null : evaluateOutputEntry(text)];
    }),
  );
  return unwrapSingleOutput(defaults, table);
}

function resolveInputs(table: DmnDecisionTable, context: FeelContext): InputTrace[] {
  return table.inputs.map((input) => {
    const expression = input.inputExpression ?? input.label ?? input.id;
    return {
      inputId: input.id,
      inputLabel: input.label,
      expression,
      resolvedValue: evaluateExpression(expression, context),
    };
  });
}

function validateInputConstraints(inputs: DmnInput[], resolvedValues: unknown[]): void {
  inputs.forEach((input, index) => {
    const allowedValues = input.inputValues;
    if (allowedValues == null || allowedValues === '') {
      return;
    }
    let isAllowed: boolean;
    try {
      isAllowed = evaluateUnaryTests(allowedValues, resolvedValues[index]);
    } catch {
      return;
    }
    if (!isAllowed) {
      throw new SimulationError(
        'input_value_violation',
        `Value ${describeValue(resolvedValues[index])} is not in allowed values: ${allowedValues}`,
        { inputId: input.id, inputLabel: input.label, value: resolvedValues[index], allowedValues },
      );
    }
  });
}

type RuleMatch = { rule: DmnRule; ruleIndex: number; entries: InputEntryTrace[]; matched: boolean };

function matchRules(table: DmnDecisionTable, resolvedValues: unknown[]): RuleMatch[] {
  return table.rules.map((rule, ruleIndex) => {
    const entries = rule.inputEntries.map((entry, columnIndex) => ({
      inputId: table.inputs[columnIndex]?.id ?? `input_${columnIndex}`,
      expression: entry.text,
      testedValue: resolvedValues[columnIndex],
      matched: entryMatches(entry.text, resolvedValues[columnIndex]),
    }));
    return { rule, ruleIndex, entries, matched: entries.every((entry) => entry.matched) };
  });
}

/**
 * Evaluates a decision table. `unwrapSingleOutput` is only set for BKM bodies (Engine `evaluate_compact`);
 * decisions keep the `{ outputName: value }` map.
 */
export function evaluateDecisionTable(
  table: DmnDecisionTable,
  context: FeelContext,
  options: { unwrapSingleOutput: boolean },
): DecisionTableEvaluation {
  const inputs = resolveInputs(table, context);
  const resolvedValues = inputs.map((input) => input.resolvedValue);
  validateInputConstraints(table.inputs, resolvedValues);
  const matches = matchRules(table, resolvedValues);

  const matchedRules: RuleTrace[] = [];
  const matchedOutputs: OutputRecord[] = [];
  const unmatchedRules: RuleTrace[] = [];
  matches.forEach((match) => {
    const ruleTrace: RuleTrace = {
      ruleId: match.rule.id,
      ruleIndex: match.ruleIndex,
      description: match.rule.description,
      inputEvaluations: match.entries,
      outputValues: {},
    };
    if (match.matched) {
      ruleTrace.outputValues = evaluateOutputEntries(match.rule, table.outputs);
      matchedOutputs.push(ruleTrace.outputValues);
      matchedRules.push(ruleTrace);
    } else {
      unmatchedRules.push(ruleTrace);
    }
  });

  const result = applyHitPolicy(table, matchedOutputs, () => evaluateDefaultOutputs(table));
  return {
    result: options.unwrapSingleOutput ? unwrapSingleOutput(result, table) : result,
    inputs,
    matchedRules,
    unmatchedRules,
  };
}
