import type { BfwLinterRulesetScorePayload } from '#modules/bpmn-core/bpmn-js/CommandHandler/UpdateBfwLinterRulesetScoreHandler';

/** A `bfw:linterRulesetScore` as stored in the file; every value is the attribute text. */
export type StoredLinterScore = BfwLinterRulesetScorePayload;

export type SolutionCallActivityEntry = {
  id: string;
  calledElement: string | null;
  calledProcessVersion: string | null;
};

export type SolutionProcessEntry = {
  id: string;
  name: string | null;
  version: string | null;
  isExecutable: boolean;
  /** Includes call activities nested in subprocesses. */
  callActivities: SolutionCallActivityEntry[];
  /** `bfw:decisionRef` of every Business Rule Task, including nested ones. */
  decisionRefs: string[];
};

export type SolutionDmnElement = { id: string; name: string | null };

export type SolutionDmnElements = {
  decisions: SolutionDmnElement[];
  businessKnowledgeModels: SolutionDmnElement[];
  inputData: SolutionDmnElement[];
};

export type SolutionModelEntry =
  | {
      kind: 'bpmn';
      uri: string;
      sha256: string;
      processes: SolutionProcessEntry[];
      storedLinterScores: StoredLinterScore[];
    }
  | {
      kind: 'dmn';
      uri: string;
      sha256: string;
      definitionsId: string | null;
      namespace: string | null;
      elements: SolutionDmnElements;
    }
  | { kind: 'invalid'; uri: string; error: string };
