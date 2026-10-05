import type { DmnDecisionTable, DmnOutput } from '@elraptorus/bfw_engine_sdk';
import { DmnHitPolicy } from '@elraptorus/bfw_engine_sdk';

import { describeValue } from './serializeFeelValue';
import { SimulationError } from './types';

export type OutputRecord = Record<string, unknown>;

/** Applies the table's hit policy to the matched rules' outputs (rule order). Mirrors the Engine's `HitPolicies`. */
export function applyHitPolicy(
  table: DmnDecisionTable,
  matchedOutputs: OutputRecord[],
  evaluateDefaultOutputs: () => unknown,
): unknown {
  switch (table.hitPolicy) {
    case DmnHitPolicy.Unique:
      return applyUnique(matchedOutputs, evaluateDefaultOutputs);
    case DmnHitPolicy.First:
      return matchedOutputs.length === 0 ? evaluateDefaultOutputs() : matchedOutputs[0];
    case DmnHitPolicy.Any:
      return applyAny(matchedOutputs, evaluateDefaultOutputs);
    case DmnHitPolicy.Collect:
      return applyAggregation(table.aggregation, matchedOutputs);
    case DmnHitPolicy.RuleOrder:
      return matchedOutputs;
    case DmnHitPolicy.OutputOrder:
      return sortByOutputPriority(matchedOutputs, table.outputs);
    case DmnHitPolicy.Priority:
      return matchedOutputs.length === 0
        ? evaluateDefaultOutputs()
        : sortByOutputPriority(matchedOutputs, table.outputs)[0];
    default:
      throw new SimulationError('unsupported_hit_policy', `Hit policy '${String(table.hitPolicy)}' is not supported.`, {
        policy: table.hitPolicy,
      });
  }
}

function applyUnique(matchedOutputs: OutputRecord[], evaluateDefaultOutputs: () => unknown): unknown {
  if (matchedOutputs.length === 0) {
    return evaluateDefaultOutputs();
  }
  if (matchedOutputs.length > 1) {
    throw new SimulationError(
      'hit_policy_violation',
      `${matchedOutputs.length} rules matched — UNIQUE requires exactly 0 or 1.`,
      { policy: 'unique' },
    );
  }
  return matchedOutputs[0];
}

function applyAny(matchedOutputs: OutputRecord[], evaluateDefaultOutputs: () => unknown): unknown {
  if (matchedOutputs.length === 0) {
    return evaluateDefaultOutputs();
  }
  const first = describeValue(matchedOutputs[0]);
  if (matchedOutputs.some((output) => describeValue(output) !== first)) {
    throw new SimulationError('hit_policy_violation', 'Matched rules produce different outputs.', { policy: 'any' });
  }
  return matchedOutputs[0];
}

// The Engine sorts map values by key; mirror that so multi-output tables behave identically.
function numericValues(outputs: OutputRecord[]): number[] {
  return outputs
    .flatMap((output) =>
      Object.keys(output)
        .sort()
        .map((key) => output[key]),
    )
    .filter((value): value is number => typeof value === 'number');
}

function applyAggregation(aggregation: DmnDecisionTable['aggregation'], outputs: OutputRecord[]): unknown {
  switch (aggregation) {
    case 'SUM':
      return numericValues(outputs).reduce((sum, value) => sum + value, 0);
    case 'MIN': {
      const values = numericValues(outputs);
      return values.length === 0 ? null : Math.min(...values);
    }
    case 'MAX': {
      const values = numericValues(outputs);
      return values.length === 0 ? null : Math.max(...values);
    }
    case 'COUNT':
      return outputs.length;
    default:
      return outputs;
  }
}

function parsePriorityList(outputValues: string): string[] {
  return outputValues
    .split(',')
    .map((entry) => entry.trim())
    .map((entry) => (entry.startsWith('"') ? entry.slice(1).replace(/"+$/, '') : entry));
}

function sortByOutputPriority(matchedOutputs: OutputRecord[], outputs: DmnOutput[]): OutputRecord[] {
  const priorityLists = outputs.map((output) =>
    output.outputValues == null ? null : parsePriorityList(output.outputValues),
  );
  const rankOf = (output: OutputRecord): number[] =>
    Object.keys(output)
      .sort()
      .map((key, index) => {
        const list = priorityLists[index] ?? null;
        if (list == null) {
          return 0;
        }
        const position = list.findIndex((entry) => entry === output[key]);
        return position === -1 ? list.length : position;
      });
  return matchedOutputs
    .map((output) => ({ output, rank: rankOf(output) }))
    .sort((left, right) => {
      for (let index = 0; index < Math.min(left.rank.length, right.rank.length); index++) {
        if (left.rank[index] !== right.rank[index]) {
          return left.rank[index] - right.rank[index];
        }
      }
      return left.rank.length - right.rank.length;
    })
    .map((entry) => entry.output);
}
