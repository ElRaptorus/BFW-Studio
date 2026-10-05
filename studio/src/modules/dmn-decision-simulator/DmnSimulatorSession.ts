import type { LoadedSimulationModels } from './core/loadSimulationModels';
import type { SimulationOutcome, SimulationStep, SimulationTarget } from './core/types';

export type DmnSimulatorStatus = 'idle' | 'running' | 'done';

export type DmnSimulatorSnapshot = {
  status: DmnSimulatorStatus;
  target: SimulationTarget | null;
  outcome: SimulationOutcome | null;
  unresolvedImports: LoadedSimulationModels['unresolvedImports'];
  /** Namespaces provided by more than one solution file; the first file was used. */
  ambiguousImports: LoadedSimulationModels['ambiguousImports'];
  /** Namespace to file URI of every imported model that was loaded. */
  importedModelUris: Record<string, string>;
  /** Input data that exist only in imported models; the DRD has no shape for them. */
  importedInputs: { name: string; namespace: string }[];
  /** The step the replay currently points at; `null` shows the final state. */
  replayIndex: number | null;
  /** The model changed after the outcome was computed; rule ids and values may no longer match. */
  stale: boolean;
};

type Listener = () => void;

/**
 * Per-document simulator state shared by the DRD controller, the panel and the decision-table highlighter.
 * Input texts live here only for the lifetime of the open document; they are never written to the document or to
 * `EditorDocument` data/metadata.
 */
export class DmnSimulatorSession {
  private snapshot: DmnSimulatorSnapshot = {
    status: 'idle',
    target: null,
    outcome: null,
    unresolvedImports: [],
    ambiguousImports: [],
    importedModelUris: {},
    importedInputs: [],
    replayIndex: null,
    stale: false,
  };
  private readonly inputTexts = new Map<string, string>();
  private readonly listeners = new Set<Listener>();
  private snapshotRevision = 0;

  getSnapshot = (): DmnSimulatorSnapshot => this.snapshot;

  /** Changes on every update, for `useSyncExternalStore`-style consumers. */
  getRevision = (): number => this.snapshotRevision;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getInputText(name: string): string {
    return this.inputTexts.get(name) ?? '';
  }

  getInputExpressions(): Record<string, string> {
    return Object.fromEntries(this.inputTexts);
  }

  /** `false` while the input is untouched; an untouched input is not sent and fails as missing. */
  hasInputText(name: string): boolean {
    return this.inputTexts.has(name);
  }

  setInputText(name: string, text: string): void {
    this.inputTexts.set(name, text);
    this.update({});
  }

  /** Carries the typed text of a renamed input data to its new name, unless the new name already has text. */
  renameInputText(oldName: string, newName: string): void {
    const text = this.inputTexts.get(oldName);
    if (oldName === newName || text == null || this.inputTexts.has(newName)) {
      return;
    }
    this.inputTexts.delete(oldName);
    this.inputTexts.set(newName, text);
  }

  update(changes: Partial<DmnSimulatorSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    this.snapshotRevision++;
    this.listeners.forEach((listener) => listener());
  }

  /** Clears the outcome and its derived state but keeps the typed inputs and the loaded model information. */
  clearResult(): void {
    this.update({ status: 'idle', outcome: null, replayIndex: null, stale: false });
  }

  reset(): void {
    this.update({
      status: 'idle',
      target: null,
      outcome: null,
      unresolvedImports: [],
      ambiguousImports: [],
      importedModelUris: {},
      importedInputs: [],
      replayIndex: null,
      stale: false,
    });
  }

  /** Steps shown up to and including the replay position (all steps when not replaying). */
  getVisibleSteps(): SimulationStep[] {
    const steps = this.snapshot.outcome?.steps ?? [];
    return this.snapshot.replayIndex == null ? steps : steps.slice(0, this.snapshot.replayIndex + 1);
  }

  /** The latest visible step of every local element, in order of first appearance; drives one badge per element. */
  getLatestVisibleStepPerElement(): SimulationStep[] {
    const latestByElementId = new Map<string, SimulationStep>();
    for (const step of this.getVisibleSteps()) {
      if (step.namespace == null) {
        latestByElementId.set(step.elementId, step);
      }
    }
    return [...latestByElementId.values()];
  }

  /** The latest step of a local decision, used to highlight its decision table. */
  findDecisionStep(decisionId: string): SimulationStep | undefined {
    return [...this.getVisibleSteps()]
      .reverse()
      .find((step) => step.namespace == null && step.type === 'decision' && step.elementId === decisionId);
  }
}
