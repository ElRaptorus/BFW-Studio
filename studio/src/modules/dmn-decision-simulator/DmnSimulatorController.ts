import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import type DmnModelerComponentAdapter from '#modules/dmn-core/DmnModelerComponentAdapter';
import {
  EVENT_DMN_ADAPTER_XML_CHANGED,
  EVENT_DMN_ADAPTER_XML_LOADED,
} from '#modules/dmn-core/DmnModelerComponentAdapter';
import { scanSolutionDmnModels } from '#modules/dmn-core/scanSolutionDmnModels';
import ReactDOM from 'react-dom/client';

import React from 'react';

import type { DmnSimulatorSession } from './DmnSimulatorSession';
import { DmnSimulatorBadge } from './components/DmnSimulatorBadge';
import { DmnSimulatorInput } from './components/DmnSimulatorInput';
import { DmnSimulatorPlayButton } from './components/DmnSimulatorPlayButton';
import { mountDmnSimulatorPanel } from './components/mountDmnSimulatorPanel';
import { collectImportedInputNames } from './core/evaluateDmnSimulation';
import type { LoadedSimulationModels, SimulationModelSource } from './core/loadSimulationModels';
import { loadSimulationModels } from './core/loadSimulationModels';
import type { SimulationStep, SimulationTarget } from './core/types';
import { DmnSimulationWorkerClient } from './worker/DmnSimulationWorkerClient';

export type DmnSimulatorHost = {
  uri: string;
  bifrost: Bifrost;
  /** The modeler adapter of the document; supplies the serialized current XML (including unsaved edits) and change events. */
  adapter: DmnModelerComponentAdapter;
};

export type DmnSimulatorDiagramServices = {
  canvas: any;
  elementRegistry: any;
  overlays: any;
  eventBus: any;
};

type OverlayEntry = { overlayId: string; root: ReactDOM.Root };

const MARKER_EVALUATED = 'dmn-sim-evaluated';
const MARKER_EVALUATED_EDGE = 'dmn-sim-evaluated-edge';
const MARKER_ERROR = 'dmn-sim-error';
const MARKER_CURRENT = 'dmn-sim-current';
const MARKER_TARGET = 'dmn-sim-target';
const OVERLAY_INPUT = 'dmn-sim-input';
const OVERLAY_PLAY = 'dmn-sim-play';
const OVERLAY_BADGE = 'dmn-sim-badge';
const BADGE_MAXIMUM_LENGTH = 22;
const REPLAY_STEP_MILLISECONDS = 250;

function formatBadgeValue(value: unknown): string {
  const text = typeof value === 'string' ? `"${value}"` : (JSON.stringify(value) ?? 'null');
  return text.length > BADGE_MAXIMUM_LENGTH ? `${text.slice(0, BADGE_MAXIMUM_LENGTH - 1)}…` : text;
}

/** Drives the simulator on one DRD canvas: input and play overlays, result badges, markers, and the panel. */
export class DmnSimulatorController {
  private active = false;
  private readonly worker = new DmnSimulationWorkerClient();
  private staticOverlays: OverlayEntry[] = [];
  private badgeOverlays: OverlayEntry[] = [];
  private markedElementIds: { elementId: string; marker: string }[] = [];
  private inputNameByElementId = new Map<string, string>();
  private panel: { unmount: () => void } | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private adapterSubscriptions: AbstractSubscription[] = [];
  private runSequence = 0;
  private modelChangedDuringRun = false;
  private replayTimer: ReturnType<typeof setInterval> | null = null;
  private resyncFrame: number | null = null;

  constructor(
    private readonly services: DmnSimulatorDiagramServices,
    private readonly host: DmnSimulatorHost,
    private readonly session: DmnSimulatorSession,
    private readonly onDeactivated: () => void,
  ) {}

  isActive(): boolean {
    return this.active;
  }

  activate(): void {
    this.active = true;
    const { eventBus } = this.services;
    this.showStaticOverlays();
    // dmn-js clears the whole diagram (and with it every overlay) when the user opens a decision table or the XML is re-imported.
    eventBus.on('diagram.clear', this.handleDiagramCleared);
    eventBus.on('import.done', this.handleDiagramImported);
    eventBus.on('elements.changed', this.handleElementsChanged);
    this.adapterSubscriptions = [
      this.host.adapter.on(EVENT_DMN_ADAPTER_XML_CHANGED, this.handleModelChanged),
      this.host.adapter.on(EVENT_DMN_ADAPTER_XML_LOADED, this.handleModelChanged),
    ];
    this.unsubscribeSession = this.session.subscribe(() => this.renderOutcome());
    this.panel = mountDmnSimulatorPanel({
      diagramContainer: this.services.canvas.getContainer(),
      session: this.session,
      bifrost: this.host.bifrost,
      describeElement: (elementId) => this.services.elementRegistry.get(elementId)?.businessObject?.name ?? elementId,
      onClose: () => this.deactivate(),
      onReplay: (index) => this.replay(index),
      onRunAgain: () => this.runAgain(),
      onReset: () => this.resetResult(),
      onEditInput: (name) => void this.editInput(name),
    });
    void this.refreshModelInformation();
  }

  deactivate(): void {
    this.deactivateInternal(true);
  }

  /** Tears down without notifying the palette, for use while the diagram itself is being destroyed. */
  dispose(): void {
    this.deactivateInternal(false);
    this.worker.dispose();
  }

  private deactivateInternal(notify: boolean): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.runSequence++;
    this.clearReplayTimer();
    if (this.resyncFrame != null) {
      cancelAnimationFrame(this.resyncFrame);
      this.resyncFrame = null;
    }
    const { eventBus } = this.services;
    eventBus.off('diagram.clear', this.handleDiagramCleared);
    eventBus.off('import.done', this.handleDiagramImported);
    eventBus.off('elements.changed', this.handleElementsChanged);
    this.adapterSubscriptions.forEach((subscription) => subscription.dispose());
    this.adapterSubscriptions = [];
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.panel?.unmount();
    this.panel = null;
    this.clearOutcome();
    this.clearOverlays(this.staticOverlays);
    this.inputNameByElementId.clear();
    this.session.reset();
    if (notify) {
      this.onDeactivated();
    }
  }

  async run(target: SimulationTarget): Promise<void> {
    if (this.session.getSnapshot().status === 'running') {
      return;
    }
    this.clearReplayTimer();
    const sequence = ++this.runSequence;
    const isCurrent = (): boolean => this.active && sequence === this.runSequence;
    this.modelChangedDuringRun = false;
    this.session.update({ status: 'running', target, outcome: null, replayIndex: null, stale: false });
    try {
      const loaded = await loadSimulationModels(await this.host.adapter.getXml(), this.createModelSource());
      if (!isCurrent()) {
        return;
      }
      this.session.update(this.describeModels(loaded));
      const outcome = await this.worker.evaluate({
        model: loaded.model,
        importedModels: loaded.importedModels,
        target,
        inputs: {},
        inputExpressions: this.session.getInputExpressions(),
      });
      if (!isCurrent()) {
        return;
      }
      this.session.update({ status: 'done', outcome, stale: this.modelChangedDuringRun });
      this.startReplay(outcome.steps.length);
      if (!outcome.ok) {
        this.notifyError(outcome.error);
      }
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      const failure = { code: 'simulation_failed', message: error instanceof Error ? error.message : String(error) };
      this.session.update({ status: 'done', outcome: { ok: false, error: failure, steps: [] } });
      this.notifyError(failure);
    }
  }

  private notifyError(error: { code: string; message: string }): void {
    this.host.bifrost.notifications.open({
      type: 'error',
      content: `${error.code}: ${error.message}`,
      source: 'Decision Simulator',
    });
  }

  private async editInput(name: string): Promise<void> {
    const result = await this.host.bifrost.dialog.open({
      title: `Simulation input: ${name}`,
      content: [
        {
          type: 'json',
          id: 'value',
          label: 'FEEL value',
          language: 'plaintext',
          size: 'medium',
          value: this.session.getInputText(name),
          focus: true,
          hint: 'For example 25, "gold", [1, 2] or { limit: 1000 }. An empty value is null.',
        },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Apply', response: 'apply', default: true },
      ],
    });
    if (!result.wasCancelled && result.response === 'apply') {
      this.session.setInputText(name, String(result.formData?.value ?? ''));
    }
  }

  private runAgain(): void {
    const { target } = this.session.getSnapshot();
    if (target != null) {
      void this.run(target);
    }
  }

  private resetResult(): void {
    this.clearReplayTimer();
    this.session.clearResult();
  }

  private replay(index: number | null): void {
    this.clearReplayTimer();
    this.session.update({ replayIndex: index });
  }

  private createModelSource(): SimulationModelSource {
    const { bifrost } = this.host;
    return {
      listDecisionModels: async () => {
        const entries = await scanSolutionDmnModels(bifrost);
        return entries.flatMap((entry) =>
          entry.kind === 'dmn' && entry.uri !== this.host.uri ? [{ uri: entry.uri, namespace: entry.namespace }] : [],
        );
      },
      loadText: (uri) => bifrost.files.load(uri),
    };
  }

  private describeModels(loaded: LoadedSimulationModels) {
    return {
      unresolvedImports: loaded.unresolvedImports,
      ambiguousImports: loaded.ambiguousImports,
      importedModelUris: loaded.importedModelUris,
      importedInputs: collectImportedInputNames(loaded.model, loaded.importedModels),
    };
  }

  /** Learns which input data live only in imported models so the panel can ask for them before the first run. */
  private async refreshModelInformation(): Promise<void> {
    try {
      const loaded = await loadSimulationModels(await this.host.adapter.getXml(), this.createModelSource());
      if (this.active) {
        this.session.update(this.describeModels(loaded));
      }
    } catch {
      // The model may be mid-edit and unparsable; the next run reports it.
    }
  }

  // --- Replay --------------------------------------------------------------------------------------------------------

  private clearReplayTimer(): void {
    if (this.replayTimer != null) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }

  /** Walks the replay position through the steps so the user sees the evaluation order, then shows the final state. */
  private startReplay(stepCount: number): void {
    if (stepCount < 2) {
      return;
    }
    let index = 0;
    this.session.update({ replayIndex: index });
    this.replayTimer = setInterval(() => {
      index++;
      if (index >= stepCount) {
        this.clearReplayTimer();
        this.session.update({ replayIndex: null });
      } else {
        this.session.update({ replayIndex: index });
      }
    }, REPLAY_STEP_MILLISECONDS);
  }

  // --- Diagram lifecycle ---------------------------------------------------------------------------------------------

  private readonly handleDiagramCleared = (): void => {
    // diagram-js already removed every overlay and marker; only our bookkeeping and React roots are left. A running
    // replay keeps going, so returning to the DRD never shows a half-finished replay.
    this.forgetOverlays(this.staticOverlays);
    this.forgetOverlays(this.badgeOverlays);
    this.markedElementIds = [];
  };

  private readonly handleDiagramImported = (): void => {
    this.showStaticOverlays();
    this.renderOutcome();
  };

  private readonly handleElementsChanged = (): void => {
    if (this.resyncFrame != null) {
      return;
    }
    this.resyncFrame = requestAnimationFrame(() => {
      this.resyncFrame = null;
      if (!this.active) {
        return;
      }
      this.clearOverlays(this.staticOverlays);
      this.showStaticOverlays();
      this.renderOutcome();
    });
  };

  private readonly handleModelChanged = (): void => {
    this.modelChangedDuringRun = true;
    const snapshot = this.session.getSnapshot();
    if (snapshot.outcome != null && !snapshot.stale) {
      this.session.update({ stale: true });
    }
  };

  // --- Overlays on the diagram ---------------------------------------------------------------------------------------

  private addOverlay(
    list: OverlayEntry[],
    elementId: string,
    type: string,
    position: Record<string, number>,
    content: React.ReactElement,
  ): void {
    const container = document.createElement('div');
    container.style.pointerEvents = 'all';
    const root = ReactDOM.createRoot(container);
    root.render(content);
    try {
      list.push({ overlayId: this.services.overlays.add(elementId, type, { position, html: container }), root });
    } catch {
      root.unmount();
    }
  }

  /** Drops entries whose overlays diagram-js already destroyed. */
  private forgetOverlays(list: OverlayEntry[]): void {
    // Unmounting inside the render of an overlay removal would warn; defer it.
    list.splice(0).forEach((entry) => setTimeout(() => entry.root.unmount(), 0));
  }

  private clearOverlays(list: OverlayEntry[]): void {
    list.forEach((entry) => {
      try {
        this.services.overlays.remove(entry.overlayId);
      } catch {
        // The overlay left with its element.
      }
    });
    this.forgetOverlays(list);
  }

  private showStaticOverlays(): void {
    const inputNameByElementId = new Map<string, string>();
    for (const element of this.services.elementRegistry.getAll()) {
      const businessObject = element.businessObject;
      if (businessObject == null) {
        continue;
      }
      if (businessObject.$type === 'dmn:InputData') {
        const name: string = businessObject.name ?? '';
        const previousName = this.inputNameByElementId.get(element.id);
        if (previousName != null && previousName !== name) {
          this.session.renameInputText(previousName, name);
        }
        inputNameByElementId.set(element.id, name);
        this.addOverlay(
          this.staticOverlays,
          element.id,
          OVERLAY_INPUT,
          { bottom: -4, left: 0 },
          React.createElement(DmnSimulatorInput, {
            session: this.session,
            name,
            onEdit: (inputName) => void this.editInput(inputName),
          }),
        );
      } else if (businessObject.$type === 'dmn:Decision' || businessObject.$type === 'dmn:DecisionService') {
        const kind = businessObject.$type === 'dmn:Decision' ? 'decision' : 'decisionService';
        this.addOverlay(
          this.staticOverlays,
          element.id,
          OVERLAY_PLAY,
          { top: -14, left: -14 },
          React.createElement(DmnSimulatorPlayButton, {
            title: `Evaluate ${businessObject.name ?? element.id}`,
            onPlay: () => void this.run({ kind, id: element.id }),
          }),
        );
      }
    }
    this.inputNameByElementId = inputNameByElementId;
  }

  // --- Result rendering ----------------------------------------------------------------------------------------------

  private clearOutcome(): void {
    this.markedElementIds.forEach(({ elementId, marker }) => {
      try {
        this.services.canvas.removeMarker(elementId, marker);
      } catch {
        // The element was removed from the diagram while the simulator was open.
      }
    });
    this.markedElementIds = [];
    this.clearOverlays(this.badgeOverlays);
  }

  private mark(elementId: string, marker: string): void {
    if (this.services.elementRegistry.get(elementId) == null) {
      return;
    }
    this.services.canvas.addMarker(elementId, marker);
    this.markedElementIds.push({ elementId, marker });
  }

  private renderOutcome(): void {
    this.clearOutcome();
    const { replayIndex, outcome, target } = this.session.getSnapshot();
    // Steps of imported models have no shape in this diagram; the panel lists them.
    const steps = this.session.getLatestVisibleStepPerElement();
    const currentStep = replayIndex == null ? undefined : this.session.getVisibleSteps().at(-1);
    const currentElementId = currentStep?.namespace == null ? currentStep?.elementId : null;
    const renderedElementIds = new Set(
      steps.filter((step) => this.services.elementRegistry.get(step.elementId) != null).map((step) => step.elementId),
    );
    steps.forEach((step) => this.renderStep(step, step.elementId === currentElementId, renderedElementIds));
    if (outcome != null && target != null) {
      this.mark(target.id, MARKER_TARGET);
    }
  }

  private renderStep(step: SimulationStep, isCurrent: boolean, renderedElementIds: Set<string>): void {
    const element = this.services.elementRegistry.get(step.elementId);
    if (element == null) {
      return;
    }
    this.mark(step.elementId, step.error == null ? MARKER_EVALUATED : MARKER_ERROR);
    if (isCurrent) {
      this.mark(step.elementId, MARKER_CURRENT);
    }
    for (const connection of element.incoming ?? []) {
      if (renderedElementIds.has(connection.source?.id)) {
        this.mark(connection.id, MARKER_EVALUATED_EDGE);
      }
    }
    const badge =
      step.error == null
        ? { label: formatBadgeValue(step.value), tone: 'value' as const, title: JSON.stringify(step.value, null, 2) }
        : { label: '!', tone: 'error' as const, title: step.error.message };
    this.addOverlay(
      this.badgeOverlays,
      step.elementId,
      OVERLAY_BADGE,
      { top: -12, right: 0 },
      React.createElement(DmnSimulatorBadge, badge),
    );
  }
}
