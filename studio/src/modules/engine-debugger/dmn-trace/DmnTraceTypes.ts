import type { DmnDefinitions, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

/**
 * Snake-case trace data as stored in BRT `typeProperties`.
 * The engine's Wire layer does NOT camelCase opaque payload subtrees.
 */
export interface DmnFlowNodeTypeProperties {
  mode: 'dmn';
  decision_ref: string;
  decision_element_id: string | null;
  decision_version_id: string;
  definitions_id: string | null;
  definitions_namespace: string | null;
  version: string;
  hit_policy: string;
  matched_rules: string[];
  trace: SnakeCaseEvaluationTrace;
  duration_us: number;
}

export interface SnakeCaseEvaluationTrace {
  decisions: SnakeCaseDecisionTrace[];
  input_coercions: SnakeCaseCoercionTrace[];
}

export interface SnakeCaseDecisionTrace {
  decision_model_id: string;
  decision_name: string | null;
  hit_policy: string;
  inputs: SnakeCaseInputTrace[];
  matched_rules: SnakeCaseRuleTrace[];
  unmatched_rules?: SnakeCaseRuleTrace[];
  unmatched_rules_count: number;
  result: Record<string, unknown> | Record<string, unknown>[] | null;
  duration_microseconds: number;
  warnings: Record<string, unknown>[];
  bkm_traces: SnakeCaseBkmTrace[];
  import_traces: SnakeCaseImportTrace[];
}

export interface SnakeCaseInputTrace {
  input_id: string;
  input_label: string | null;
  expression: string;
  resolved_value: unknown;
}

export interface SnakeCaseRuleTrace {
  rule_id: string;
  rule_index: number;
  description: string | null;
  input_evaluations: SnakeCaseInputEntryTrace[];
  output_values: Record<string, unknown>;
}

export interface SnakeCaseInputEntryTrace {
  input_id: string;
  expression: string;
  tested_value: unknown;
  matched: boolean;
}

export interface SnakeCaseBkmTrace {
  bkm_id: string;
  bkm_name: string | null;
  formal_parameters: { name: string; bound_value: unknown }[];
  result: unknown;
  duration_microseconds: number;
  dependent_bkm_traces: SnakeCaseBkmTrace[];
}

export interface SnakeCaseImportTrace {
  namespace: string;
  decision_id: string;
  source_definitions_id: string;
  evaluation_trace: SnakeCaseEvaluationTrace;
  result: unknown;
  duration_microseconds: number;
}

export interface SnakeCaseCoercionTrace {
  input_name: string;
  original_value: unknown;
  coerced_value: unknown;
  target_type: string;
  coerced: boolean;
}

export interface DmnTraceFragmentData {
  flowNodeInstance: FlowNodeInstance | null;
  dmnXml: string | null;
  loading: boolean;
  error: string | null;
}

export { type DmnDefinitions, type DrgSelection };
