import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import type { LandscapeSolutionScan } from '#modules/bpmn-landscape/LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from '#modules/bpmn-landscape/LandscapeSolutionScan';

import {
  buildInteractionGraph,
  type InteractionGraph,
  type InteractionGraphLine,
  type InteractionGraphPort,
  type InteractionGraphProcess,
  type InteractionGraphStation,
  type InteractionLayoutMode,
  type InteractionSelectedProcessReference,
} from './buildInteractionGraph';
import { layoutInteractionGraph, type InteractionGraphLayout } from './layoutInteractionGraph';
import InteractionsViewer from './viewer/InteractionsViewer';

export const INTERACTIONS_URI = 'interactions://solution';
export const INTERACTIONS_PAGE_ID = 'discover/interactions';
export const INTERACTIONS_LAYOUT_SETTING = 'bpmn.interactions.layout';
export const INTERACTIONS_HIDE_SETTING = 'bpmn.interactions.hideProcessesWithoutInteraction';

/**
 * The Interactions view belongs to no project, so resolving its settings by URI would only ever reach the User layer.
 * They are read from and written to the solution file directly, and fall back to User when no solution file is open.
 */
export function readInteractionsSetting(studio: Bifrost, settingName: string): unknown {
  return studio.settings.inspectForTarget({ scope: 'solution' }, settingName).value;
}

export function writeInteractionsSetting(studio: Bifrost, settingName: string, value: unknown): void {
  const hasSolutionFile = studio.settings.getAvailableScopeTargets().some((target) => target.scope === 'solution');
  void studio.settings.setInScope(hasSolutionFile ? { scope: 'solution' } : { scope: 'user' }, settingName, value);
}

type Viewbox = { x: number; y: number; width: number; height: number };

function isUsableViewbox(viewbox: unknown): viewbox is Viewbox {
  if (viewbox == null || typeof viewbox !== 'object') {
    return false;
  }
  const candidate = viewbox as Viewbox;
  return candidate.width > 0 && candidate.height > 0 && Number.isFinite(candidate.width + candidate.height);
}

function processReferenceKey(reference: InteractionSelectedProcessReference): string {
  return `${reference.uri}#${reference.processId}`;
}

function catalogSignature(catalog: SolutionBpmnModelEntry[]): string {
  return catalog
    .filter((entry) => entry.kind === 'bpmn')
    .map((entry) => `${entry.uri}:${entry.sha256}`)
    .sort()
    .join('|');
}

function selectionSignature(references: InteractionSelectedProcessReference[]): string {
  return references.map(processReferenceKey).sort().join('|');
}

function buildGenerationSignature(
  catalog: SolutionBpmnModelEntry[],
  references: InteractionSelectedProcessReference[],
): string {
  return `${catalogSignature(catalog)};;${selectionSignature(references)}`;
}

export default class InteractionsDocumentModel extends EditorDocumentModel {
  private readonly studio: Bifrost;
  private readonly solutionScan: LandscapeSolutionScan;

  private solutionId: string | null;
  private selectedProcessReferences: InteractionSelectedProcessReference[] = [];
  private lastGraph: InteractionGraph | null = null;
  private lastLayout: InteractionGraphLayout | null = null;
  private lastGenerationCatalog: SolutionBpmnModelEntry[] | null = null;
  private lastGenerationReferences: InteractionSelectedProcessReference[] | null = null;
  private generationSignature: string | null = null;

  private viewer: InteractionsViewer | null = null;
  private focusMode = false;
  private pendingViewbox: Viewbox | null = null;
  private needsInitialZoom = true;
  private isAttached = false;
  private readyForInteraction = false;
  private generating = false;
  private generationSequence = 0;

  private selectionRevision = 0;
  private generationRevision = 0;
  private settingsRevision = 0;

  private subscriptions: { dispose(): void }[] = [];

  private constructor(uri: string, studio: Bifrost, restoredMetadata: unknown) {
    super(uri);
    this.studio = studio;
    this.solutionId = studio.solution.getSolution()?.id ?? null;
    this.solutionScan = studio.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
    this.focusMode = (restoredMetadata as { focusMode?: boolean } | null)?.focusMode === true;
    this.pendingViewbox = isUsableViewbox((restoredMetadata as { viewbox?: Viewbox } | null)?.viewbox)
      ? (restoredMetadata as { viewbox: Viewbox }).viewbox
      : null;
  }

  static async create(
    uri: string,
    _restoredCurrentData: unknown,
    restoredMetadata: unknown,
    _fileLoader: ILoadable,
    studio: Bifrost,
  ): Promise<InteractionsDocumentModel> {
    return new InteractionsDocumentModel(uri, studio, restoredMetadata);
  }

  onEditorDocumentModelDidRegister(): void {
    this.updateLabel('Interactions');
    this.viewer = new InteractionsViewer();
    this.wireViewerEvents();
    this.subscriptions.push(
      this.solutionScan.onDidChange(() => this.onScanChanged()),
      this.studio.events.on('solutionChanged', () => this.onSolutionChanged()),
      this.studio.settings.onDidChange((settingName) => {
        if (settingName === INTERACTIONS_LAYOUT_SETTING || settingName === INTERACTIONS_HIDE_SETTING) {
          this.settingsRevision++;
          this.updateMetadata({ settingsRevision: this.settingsRevision, stale: this.isStale() });
          void this.relayoutFromLastGeneration();
        }
      }),
    );
    this.updateMetadata({
      focusMode: this.focusMode,
      selectionRevision: this.selectionRevision,
      generationRevision: this.generationRevision,
      generating: false,
      stale: false,
    });
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.viewer?.destroy();
    this.viewer = null;
  }

  async restoreMetadataAfterNavigation(partialMetadata: unknown): Promise<void> {
    const metadata = partialMetadata as { viewbox?: Viewbox; focusMode?: boolean } | null;
    if (isUsableViewbox(metadata?.viewbox)) {
      this.pendingViewbox = metadata.viewbox;
      this.applyPendingViewbox();
    }
    if (typeof metadata?.focusMode === 'boolean') {
      this.focusMode = metadata.focusMode;
      this.viewer?.updateFocus(this.focusMode);
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────

  getCatalog(): SolutionBpmnModelEntry[] {
    return this.solutionScan.getSnapshot()?.catalog ?? [];
  }

  getSelectedProcessReferences(): readonly InteractionSelectedProcessReference[] {
    return this.selectedProcessReferences;
  }

  getInteractionGraph(): InteractionGraph | null {
    return this.lastGraph;
  }

  getInteractionLayout(): InteractionGraphLayout | null {
    return this.lastLayout;
  }

  getSelectionRevision(): number {
    return this.selectionRevision;
  }

  getGenerationRevision(): number {
    return this.generationRevision;
  }

  isGenerating(): boolean {
    return this.generating;
  }

  isStale(): boolean {
    if (this.generationSignature == null) {
      return false;
    }
    const catalog = this.getCatalog();
    return buildGenerationSignature(catalog, this.selectedProcessReferences) !== this.generationSignature;
  }

  hasGeneratedDiagram(): boolean {
    return this.lastLayout != null && this.lastGraph != null;
  }

  getFocusMode(): boolean {
    return this.focusMode;
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  getViewer(): InteractionsViewer | null {
    return this.viewer;
  }

  exportSvg(): string | null {
    return this.viewer?.exportSvg() ?? null;
  }

  // ─── Selection (session) ───────────────────────────────────────────

  isProcessSelected(reference: InteractionSelectedProcessReference): boolean {
    return this.selectedProcessReferences.some(
      (candidate) => candidate.uri === reference.uri && candidate.processId === reference.processId,
    );
  }

  setProcessSelected(reference: InteractionSelectedProcessReference, selected: boolean): void {
    const key = processReferenceKey(reference);
    const without = this.selectedProcessReferences.filter((candidate) => processReferenceKey(candidate) !== key);
    if (selected) {
      this.selectedProcessReferences = [...without, reference].sort(
        (first, second) => first.uri.localeCompare(second.uri) || first.processId.localeCompare(second.processId),
      );
    } else {
      this.selectedProcessReferences = without;
    }
    this.bumpSelectionRevision();
    this.updateMetadata({ stale: this.isStale() });
  }

  setProcessesSelected(references: readonly InteractionSelectedProcessReference[], selected: boolean): void {
    if (references.length === 0) {
      return;
    }
    const referenceKeys = new Set(references.map(processReferenceKey));
    const without = this.selectedProcessReferences.filter(
      (candidate) => !referenceKeys.has(processReferenceKey(candidate)),
    );
    if (selected) {
      this.selectedProcessReferences = [...without, ...references].sort(
        (first, second) => first.uri.localeCompare(second.uri) || first.processId.localeCompare(second.processId),
      );
    } else {
      this.selectedProcessReferences = without;
    }
    this.bumpSelectionRevision();
    this.updateMetadata({ stale: this.isStale() });
  }

  // ─── Generation ────────────────────────────────────────────────────

  async generate(): Promise<void> {
    const generationNumber = ++this.generationSequence;
    this.generating = true;
    this.updateMetadata({ generating: true });
    try {
      await this.solutionScan.refresh();
      if (generationNumber !== this.generationSequence) {
        return;
      }
      const snapshot = this.solutionScan.getSnapshot();
      if (snapshot == null) {
        return;
      }
      const catalog = snapshot.catalog;
      const references = this.selectedProcessReferences;
      if (references.length === 0) {
        return;
      }
      const layout = this.readLayoutMode();
      const hide = readInteractionsSetting(this.studio, INTERACTIONS_HIDE_SETTING) === true;
      const graph = buildInteractionGraph(catalog, references, { layout, hideProcessesWithoutInteraction: hide });
      let interactionLayout: InteractionGraphLayout;
      try {
        interactionLayout = await layoutInteractionGraph(graph, layout);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.studio.notifications.open({
          type: 'error',
          content: message,
          source: 'Interactions',
        });
        return;
      }
      if (generationNumber !== this.generationSequence) {
        return;
      }
      this.lastGraph = graph;
      this.lastLayout = interactionLayout;
      this.lastGenerationCatalog = catalog;
      this.lastGenerationReferences = references;
      this.generationSignature = buildGenerationSignature(catalog, references);
      this.viewer?.importLayout(graph, interactionLayout);
      this.viewer?.updateFocus(this.focusMode);
      if (this.isAttached && this.needsInitialZoom) {
        this.needsInitialZoom = false;
        this.viewer?.zoomToViewport();
      }
      this.bumpGenerationRevision();
      this.updateMetadata({ stale: false });
    } finally {
      if (generationNumber === this.generationSequence) {
        this.generating = false;
        this.updateMetadata({ generating: false });
      }
    }
  }

  toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
    this.updateMetadata({ focusMode: this.focusMode });
    this.viewer?.updateFocus(this.focusMode);
  }

  toggleSearch(): void {
    this.viewer?.toggleSearch();
  }

  zoomToViewport(): void {
    this.viewer?.zoomToViewport();
  }

  zoomToActualSize(): void {
    this.viewer?.zoomToActualSize();
  }

  zoomToSelectedElement(): void {
    this.viewer?.zoomToSelectedElement();
  }

  getRelativePath(fileUri: string): string {
    const solution = this.studio.solution.getSolution();
    if (solution == null) {
      return this.studio.files.getFilename(fileUri);
    }
    const project = solution.projects.find((candidate) => fileUri.startsWith(`${candidate.baseUri}/`));
    if (project == null) {
      return this.studio.files.getFilename(fileUri);
    }
    return fileUri.slice(project.baseUri.length + 1);
  }

  getDiagramSummary(): {
    processCount: number;
    portCount: number;
    lineCount: number;
    stationCount: number;
    portsWithPartnersOutsideView: number;
    portsWithoutPartnerInSolution: number;
  } {
    const graph = this.lastGraph;
    if (graph == null) {
      return {
        processCount: this.selectedProcessReferences.length,
        portCount: 0,
        lineCount: 0,
        stationCount: 0,
        portsWithPartnersOutsideView: 0,
        portsWithoutPartnerInSolution: 0,
      };
    }
    return {
      processCount: graph.processes.length,
      portCount: graph.ports.length,
      lineCount: graph.lines.length,
      stationCount: graph.stations.length,
      portsWithPartnersOutsideView: graph.ports.filter((port) => port.showPartnersOutsideViewStub).length,
      portsWithoutPartnerInSolution: graph.ports.filter((port) => port.showNoPartnerInSolutionGlyph).length,
    };
  }

  getSelectedCanvasElementId(): string | null {
    const viewer = this.viewer;
    if (viewer == null) {
      return null;
    }
    const selected = viewer.get('selection').get();
    if (selected.length !== 1) {
      return null;
    }
    const element = selected[0];
    return element?.id ?? null;
  }

  resolveCanvasElement(
    elementId?: string,
  ): InteractionGraphProcess | InteractionGraphPort | InteractionGraphLine | InteractionGraphStation | null {
    const graph = this.lastGraph;
    if (graph == null) {
      return null;
    }
    const resolvedId = elementId ?? this.getSelectedCanvasElementId();
    if (resolvedId == null) {
      return null;
    }
    const process = graph.processes.find((candidate) => candidate.id === resolvedId);
    if (process != null) {
      return process;
    }
    const port = graph.ports.find((candidate) => candidate.id === resolvedId);
    if (port != null) {
      return port;
    }
    const station = graph.stations.find((candidate) => candidate.id === resolvedId);
    if (station != null) {
      return station;
    }
    const line = graph.lines.find((candidate) => candidate.id === resolvedId);
    return line ?? null;
  }

  findCatalogProcess(uri: string, processId: string) {
    for (const entry of this.getCatalog()) {
      if (entry.kind !== 'bpmn' || entry.uri !== uri) {
        continue;
      }
      return entry.processes.find((process) => process.id === processId) ?? null;
    }
    return null;
  }

  openElement(elementId?: string): void {
    const target = this.resolveBpmnTarget(elementId);
    if (target != null) {
      void this.studio.commands.executeCommand('std.editor.gotoSymbolInDocument', [target.uri, target.bpmnId]);
    }
  }

  /** Opens the BPMN file in the external text editor at the process or flow node of a process or port. */
  async openElementInTextEditor(elementId?: string): Promise<void> {
    const target = this.resolveBpmnTarget(elementId);
    if (target == null) {
      return;
    }
    const text = await this.studio.files.load(target.uri);
    const textBeforeElement = text.split(` id="${target.bpmnId}"`)[0];
    if (textBeforeElement === text) {
      await this.studio.commands.executeCommand('std.shell.openDocumentInTextEditor', [target.uri]);
      return;
    }
    const lines = textBeforeElement.split('\n');
    await this.studio.commands.executeCommand('std.shell.openDocumentInTextEditor', [
      target.uri,
      lines.length,
      lines[lines.length - 1].length + 2,
    ]);
  }

  /** The file and BPMN id behind a process or port; lines and stations have none. */
  resolveBpmnTarget(elementId?: string): { uri: string; bpmnId: string } | null {
    const element = this.resolveCanvasElement(elementId);
    if (element == null) {
      return null;
    }
    if ('flowNodeId' in element) {
      return { uri: element.uri, bpmnId: element.flowNodeId };
    }
    if ('fileLabel' in element) {
      return { uri: element.uri, bpmnId: element.processId };
    }
    return null;
  }

  addPartnersOutsideView(portId?: string): void {
    const port = this.resolveCanvasElement(portId);
    if (port == null || !('partnersOutsideView' in port)) {
      return;
    }
    if (port.partnersOutsideView.length === 0) {
      return;
    }
    this.setProcessesSelected(port.partnersOutsideView, true);
  }

  async addAllPartnersOutsideViewAndGenerate(): Promise<void> {
    const graph = this.lastGraph;
    if (graph == null) {
      return;
    }
    const partnersByKey = new Map<string, InteractionSelectedProcessReference>();
    for (const port of graph.ports) {
      for (const partner of port.partnersOutsideView) {
        partnersByKey.set(processReferenceKey(partner), partner);
      }
    }
    if (partnersByKey.size === 0) {
      return;
    }
    this.setProcessesSelected([...partnersByKey.values()], true);
    await this.generate();
  }

  async addPartnersOutsideViewAndGenerate(portId: string): Promise<void> {
    this.addPartnersOutsideView(portId);
    await this.generate();
  }

  revealNextUnconnectedPort(): void {
    const graph = this.lastGraph;
    const viewer = this.viewer;
    if (graph == null || viewer == null) {
      return;
    }
    const unconnectedPorts = graph.ports.filter((port) => port.showNoPartnerInSolutionGlyph);
    if (unconnectedPorts.length === 0) {
      return;
    }
    const selectedElementId = this.getSelectedCanvasElementId();
    const selectedIndex =
      selectedElementId == null ? -1 : unconnectedPorts.findIndex((port) => port.id === selectedElementId);
    const nextIndex = selectedIndex >= 0 ? (selectedIndex + 1) % unconnectedPorts.length : 0;
    const nextPort = unconnectedPorts[nextIndex];
    if (nextPort != null) {
      viewer.reveal(nextPort.id);
    }
  }

  /** Copies the BPMN id of a process or port, otherwise the name of the line or station. */
  copySelectedElementId(elementId?: string): void {
    const target = this.resolveBpmnTarget(elementId);
    const element = target == null ? this.resolveCanvasElement(elementId) : null;
    const text = target?.bpmnId ?? (element != null && 'name' in element ? element.name : null);
    if (text != null) {
      void navigator.clipboard.writeText(text);
    }
  }

  attachTo(element: HTMLElement): void {
    const viewer = this.viewer;
    if (viewer == null) {
      return;
    }
    element.appendChild(viewer.container);
    viewer.get('canvas').resized();
    if (this.pendingViewbox != null) {
      this.needsInitialZoom = false;
      this.applyPendingViewbox();
    } else if (this.needsInitialZoom && this.hasGeneratedDiagram()) {
      this.needsInitialZoom = false;
      viewer.zoomToViewport();
    }
    this.isAttached = true;
    this.scheduleReadinessCheck();
  }

  detach(): void {
    this.isAttached = false;
    this.viewer?.container.remove();
  }

  // ─── Private ───────────────────────────────────────────────────────

  private readLayoutMode(): InteractionLayoutMode {
    const value = readInteractionsSetting(this.studio, INTERACTIONS_LAYOUT_SETTING);
    return value === 'stations' ? 'stations' : 'direct';
  }

  private async relayoutFromLastGeneration(): Promise<void> {
    if (this.generating) {
      await this.generate();
      return;
    }
    if (this.lastGenerationCatalog == null || this.lastGenerationReferences == null) {
      return;
    }
    const generationNumber = ++this.generationSequence;
    const layout = this.readLayoutMode();
    const hide = readInteractionsSetting(this.studio, INTERACTIONS_HIDE_SETTING) === true;
    const graph = buildInteractionGraph(this.lastGenerationCatalog, this.lastGenerationReferences, {
      layout,
      hideProcessesWithoutInteraction: hide,
    });
    try {
      const interactionLayout = await layoutInteractionGraph(graph, layout);
      if (generationNumber !== this.generationSequence) {
        return;
      }
      this.lastGraph = graph;
      this.lastLayout = interactionLayout;
      this.viewer?.importLayout(graph, interactionLayout);
      this.viewer?.updateFocus(this.focusMode);
      this.bumpGenerationRevision();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.studio.notifications.open({
        type: 'error',
        content: message,
        source: 'Interactions',
      });
    }
  }

  private onScanChanged(): void {
    this.updateMetadata({ stale: this.isStale() });
  }

  /**
   * The document outlives the solution, but its selection and diagram belong to one solution. `solutionChanged`
   * also fires for file changes inside the solution, so only a different solution id resets them.
   */
  private onSolutionChanged(): void {
    const solutionId = this.studio.solution.getSolution()?.id ?? null;
    if (solutionId === this.solutionId) {
      return;
    }
    this.solutionId = solutionId;
    this.generationSequence++;
    this.generating = false;
    this.selectedProcessReferences = [];
    this.lastGraph = null;
    this.lastLayout = null;
    this.lastGenerationCatalog = null;
    this.lastGenerationReferences = null;
    this.generationSignature = null;
    this.needsInitialZoom = true;
    this.bumpSelectionRevision();
    this.bumpGenerationRevision();
    this.updateMetadata({ generating: false, stale: false });
  }

  private wireViewerEvents(): void {
    const viewer = this.viewer;
    if (viewer == null) {
      return;
    }
    const eventBus = viewer.get('eventBus');
    eventBus.on('selection.changed', ({ newSelection }: { newSelection: unknown[] }) => {
      this.updateMetadata({ hasSelection: newSelection.length > 0 });
      this.bumpSelectionRevision();
      viewer.updateFocus(this.focusMode);
    });
    eventBus.on('element.dblclick', ({ element }: { element?: { businessObject?: unknown; id?: string } }) => {
      if (element?.id != null) {
        this.openElement(element.id);
      }
    });
    eventBus.on('element.click', (event: { element?: { id?: string }; originalEvent?: Event }) => {
      const target = event.originalEvent?.target;
      if (target instanceof Element && target.closest('.interactions-port-stub') != null && event.element?.id != null) {
        void this.addPartnersOutsideViewAndGenerate(event.element.id);
      }
    });
    eventBus.on('canvas.viewbox.changed', (event: { viewbox: Viewbox }) => {
      const viewbox = event.viewbox;
      if (isUsableViewbox(viewbox)) {
        this.updateMetadata({
          viewbox: { x: viewbox.x, y: viewbox.y, width: viewbox.width, height: viewbox.height },
        });
        this.scheduleReadinessCheck();
      }
    });
  }

  private scheduleReadinessCheck(): void {
    if (!this.isAttached) {
      return;
    }
    requestAnimationFrame(() => {
      const viewbox = this.viewer?.getViewbox();
      if (!isUsableViewbox(viewbox)) {
        this.readyForInteraction = false;
        this.updateMetadata({ readyForInteraction: false });
        return;
      }
      if (!this.readyForInteraction) {
        this.readyForInteraction = true;
        this.updateMetadata({ readyForInteraction: true });
      }
    });
  }

  private applyPendingViewbox(): void {
    const viewer = this.viewer;
    if (viewer == null || this.pendingViewbox == null || !viewer.container.isConnected) {
      return;
    }
    viewer.setViewbox(this.pendingViewbox);
    this.pendingViewbox = null;
    this.scheduleReadinessCheck();
  }

  private bumpSelectionRevision(): void {
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  private bumpGenerationRevision(): void {
    this.generationRevision++;
    this.updateMetadata({ generationRevision: this.generationRevision });
  }
}
