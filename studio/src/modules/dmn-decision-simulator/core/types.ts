import type {
  BkmTrace,
  DmnDefinitions,
  DmnServiceEvaluationResult,
  EvaluationResult,
  ImportTrace,
} from '@elraptorus/bfw_engine_sdk';

/** Variable name → value; the shared context every expression is evaluated against (Engine semantics). */
export type FeelContext = Record<string, unknown>;

/** An evaluation failure with an Engine-style error code (`input_value_violation`, `hit_policy_violation`, ...). */
export class SimulationError extends Error {
  readonly code: string;
  readonly detail: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'SimulationError';
    this.code = code;
    this.detail = detail;
  }
}

export type SimulationStepType = 'inputData' | 'decision' | 'businessKnowledgeModel' | 'decisionService';

export type SimulationStepRule = { ruleId: string; matched: boolean };

/** One evaluated element, in evaluation order. */
export type SimulationStep = {
  elementId: string;
  elementName: string | null;
  /** `null` for elements of the model being simulated; the namespace of the imported model otherwise. */
  namespace: string | null;
  type: SimulationStepType;
  value?: unknown;
  error?: { code: string; message: string };
  /** Decision tables only: every rule of the table with its outcome, for the table-view highlighting. */
  rules?: SimulationStepRule[];
  warnings?: string[];
};

export type SimulationTarget = { kind: 'decision' | 'decisionService'; id: string };

export type SimulationRequest = {
  model: DmnDefinitions;
  /** Every transitive import, keyed by namespace. */
  importedModels: ReadonlyMap<string, DmnDefinitions>;
  target: SimulationTarget;
  /** Keyed by variable name; shared with imported models (Engine semantics). */
  inputs: FeelContext;
  /** FEEL source per input name, evaluated before the simulation; blank text is `null`. Overrides `inputs`. */
  inputExpressions?: Record<string, string>;
  maxImportDepth?: number;
};

export type SimulationOutcome =
  | { ok: true; kind: 'decision'; result: EvaluationResult; steps: SimulationStep[] }
  | { ok: true; kind: 'decisionService'; result: DmnServiceEvaluationResult; steps: SimulationStep[] }
  | { ok: false; error: { code: string; message: string; detail?: unknown }; steps: SimulationStep[] };

/** Everything an expression needs besides its context. `definitions` is the model the expression is written in. */
export type EvaluationEnvironment = {
  definitions: DmnDefinitions;
  /** Namespace of `definitions` when it is an imported model; `null` for the edited model. */
  namespace: string | null;
  importedModels: ReadonlyMap<string, DmnDefinitions>;
  /** Receives one trace per business knowledge model invoked while evaluating the expression. */
  bkmTraces: BkmTrace[];
  /** Notified after every business knowledge model invocation so the session can record a simulation step. */
  onKnowledgeModelInvoked?: (invocation: {
    id: string;
    name: string | null;
    namespace: string | null;
    result: unknown;
  }) => void;
};

export type ImportTraceSink = ImportTrace[];

export const DEFAULT_MAX_IMPORT_DEPTH = 10;
