import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { FileEventType, WatcherDisposable } from '#bifrost/common/FileHandlingService';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import type { SolutionBpmnModelEntry, SolutionProcessEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type {
  LandscapeElement,
  LandscapeMap,
  LandscapeMapParseResult,
  LandscapeProcessElement,
} from './LandscapeMapFile';
import {
  createElementId,
  createEmptyLandscapeMap,
  parseLandscapeMap,
  relativeFileHint,
  serializeLandscapeMap,
} from './LandscapeMapFile';
import type { LandscapeProcessReference, ProcessRelation, ProcessRelationKind } from './buildProcessRelations';
import { buildProcessRelations } from './buildProcessRelations';
import type { PlacedProcess } from './buildRelationLines';
import { buildRelationLines } from './buildRelationLines';
import LandscapeModeler from './modeler/LandscapeModeler';
import type { LandscapeMapProperties } from './modeler/LandscapeUpdates';
import type LandscapeUpdates from './modeler/LandscapeUpdates';
import { UPDATE_ELEMENT_COMMAND, UPDATE_MAP_COMMAND } from './modeler/LandscapeUpdates';

export type AddProcessRequest = { processId: string; fileUri: string; x: number; y: number };

type ResolvedProcess = { uri: string; process: SolutionProcessEntry };

/** A relation of one process as the properties pane lists it. */
export type ProcessRelationEntry = {
  relation: ProcessRelation;
  direction: 'outgoing' | 'incoming';
  otherProcessLabel: string;
  /** Whether the other process is on this map too; only then the relation can be drawn or hidden. */
  otherOnMap: boolean;
  hidden: boolean;
};

type ProcessDetails = {
  relativePath: string;
  process: SolutionProcessEntry;
  relations: ProcessRelationEntry[];
};

type Viewbox = { x: number; y: number; width: number; height: number };

const PROCESS_WIDTH = 140;
const PROCESS_HEIGHT = 60;

const referenceKey = (reference: LandscapeProcessReference): string => `${reference.uri}#${reference.processId}`;

const sameReference = (first: LandscapeProcessReference, second: LandscapeProcessReference): boolean =>
  first.uri === second.uri && first.processId === second.processId;

/** A hidden canvas reports a 0×0 viewbox; storing or restoring one breaks the zoom. */
function isUsableViewbox(viewbox: any): viewbox is Viewbox {
  return viewbox?.width > 0 && viewbox?.height > 0 && Number.isFinite(viewbox.width + viewbox.height);
}

export default class LandscapeMapDocumentModel extends EditorDocumentModel {
  private readonly studio: Bifrost;
  private originalText: string;
  private currentText: string;
  private map: LandscapeMap | null = null;
  private parseErrors: string[] = [];
  private modeler: LandscapeModeler | null = null;
  private catalog: SolutionBpmnModelEntry[] = [];
  private latestCatalogScan = 0;
  private relations: ProcessRelation[] = [];
  private selectionRevision = 0;
  private focusMode: boolean;
  private pendingViewbox: Viewbox | null;
  private hasBeenAttached = false;
  private watcherDisposable?: WatcherDisposable;
  private subscriptions: AbstractSubscription[] = [];
  private manualSaveTriggered = false;

  private constructor(
    uri: string,
    textOnFile: string,
    restoredCurrentData: string | null,
    restoredMetadata: any,
    studio: Bifrost,
    parseResult: LandscapeMapParseResult,
  ) {
    super(uri);
    this.studio = studio;
    this.originalText = textOnFile;
    this.currentText = restoredCurrentData ?? textOnFile;
    this.pendingViewbox = isUsableViewbox(restoredMetadata?.viewbox) ? restoredMetadata.viewbox : null;
    this.focusMode = restoredMetadata?.focusMode === true;
    this.parseErrors = this.applyParseResult(parseResult);
    this.subscriptions.push(studio.events.on('solutionChanged', () => void this.refreshCatalog()));
    this.startFileWatcher();
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    studio: Bifrost,
  ): Promise<LandscapeMapDocumentModel> {
    let textOnFile = await fileLoader.load(uri);
    if (typeof textOnFile !== 'string') {
      throw new Error(`LandscapeMapDocumentModel.create: Error while loading: ${uri}`);
    }
    if (textOnFile.trim() === '') {
      textOnFile = serializeLandscapeMap(createEmptyLandscapeMap(studio.files.getLocalBasename(uri, true)));
    }
    const restoredText =
      typeof restoredCurrentData === 'string' && restoredCurrentData !== '' ? restoredCurrentData : null;
    const parseResult = await parseLandscapeMap(restoredText ?? textOnFile);
    const model = new LandscapeMapDocumentModel(uri, textOnFile, restoredText, restoredMetadata, studio, parseResult);
    void model.refreshCatalog();
    return model;
  }

  //#region Document lifecycle

  onEditorDocumentModelDidRegister(): void {
    this.updateOriginalAndCurrentData(this.originalText, this.currentText);
    this.updateMetadata({ readable: this.parseErrors.length === 0 });
  }

  async saveEditorDocument(): Promise<boolean | null> {
    if (this.modeler != null) {
      return null;
    }
    this.studio.notifications.open({
      type: 'warning',
      content: 'This landscape map cannot be read, so it is not saved. Fix the file in a text editor first.',
      source: 'Landscapes',
    });
    return false;
  }

  onEditorDocumentWillSave(willCloseAfterSave = false): void {
    if (this.modeler == null) {
      return;
    }
    this.watcherDisposable?.dispose();
    if (!willCloseAfterSave && this.studio.env.isMac) {
      this.manualSaveTriggered = true;
    }
  }

  onEditorDocumentDidSave(willCloseAfterSave = false): void {
    if (willCloseAfterSave) {
      return;
    }
    this.originalText = this.currentText = this.getCurrentData();
    this.updateMetadata({
      errorOnReloadingFile: null,
      fileChangedFromOutside: false,
      fileRenamedFromOutside: null,
      removedFromFileSystem: null,
    });
    this.startFileWatcher();
  }

  /** Other files of the solution may have changed while this tab was in the background. */
  onEditorDocumentDidFocus(): void {
    void this.refreshCatalog();
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.eventEmitter.removeAllListeners();
    this.watcherDisposable?.dispose();
    this.modeler?.destroy();
    this.modeler = null;
  }

  async restoreMetadataAfterNavigation(partialMetadata: any): Promise<void> {
    if (isUsableViewbox(partialMetadata?.viewbox)) {
      this.pendingViewbox = partialMetadata.viewbox;
      this.applyPendingViewbox();
    }
  }

  //#endregion Document lifecycle

  //#region Undo / Redo

  canUndo(): boolean {
    return this.modeler?.get('commandStack').canUndo() ?? false;
  }

  canRedo(): boolean {
    return this.modeler?.get('commandStack').canRedo() ?? false;
  }

  undo(): void {
    this.modeler?.get('commandStack').undo();
  }

  redo(): void {
    this.modeler?.get('commandStack').redo();
  }

  //#endregion Undo / Redo

  //#region Canvas

  getParseErrors(): string[] {
    return this.parseErrors;
  }

  /** Appends the canvas to `element`; the model keeps the diagram while the renderer is unmounted. */
  attachTo(element: HTMLElement): void {
    if (this.modeler == null) {
      return;
    }
    element.appendChild(this.modeler.container);
    const canvas = this.modeler.get('canvas');
    canvas.resized();
    if (this.pendingViewbox != null) {
      this.applyPendingViewbox();
    } else if (!this.hasBeenAttached && (this.map?.elements.length ?? 0) > 0) {
      canvas.zoom('fit-viewport', 'auto');
    }
    this.hasBeenAttached = true;
  }

  detach(): void {
    this.modeler?.container.remove();
  }

  toCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    return this.modeler?.toCanvasPoint(clientX, clientY) ?? null;
  }

  getProcessIdsOnMap(): string[] {
    return (this.map?.elements ?? []).flatMap((element) => (element.type === 'process' ? [element.processId] : []));
  }

  /** Adds the process to the map, or selects and reveals its shape when the map already shows it. */
  addProcess(request: AddProcessRequest): void {
    const modeler = this.modeler;
    if (modeler == null) {
      return;
    }
    const existing = modeler.findProcessShape(request.processId);
    if (existing != null) {
      modeler.get('selection').select(existing);
      modeler.get('canvas').scrollToElement(existing);
      return;
    }
    const element: LandscapeProcessElement = {
      id: createElementId('process', (id) => modeler.get('elementRegistry').get(id) != null),
      type: 'process',
      parentId: null,
      x: request.x - PROCESS_WIDTH / 2,
      y: request.y - PROCESS_HEIGHT / 2,
      width: PROCESS_WIDTH,
      height: PROCESS_HEIGHT,
      style: null,
      processId: request.processId,
      fileHint: relativeFileHint(this.uri, request.fileUri),
      label: null,
      shape: 'box',
    };
    modeler.get('selection').select(modeler.addProcessShape(element, { x: request.x, y: request.y }));
  }

  isDirectEditingActive(): boolean {
    return this.modeler?.get('directEditing').isActive() ?? false;
  }

  hasClipboardContent(): boolean {
    // Copying only processes or relation lines stores an empty tree.
    return Object.keys(this.modeler?.get('clipboard').get() ?? {}).length > 0;
  }

  deleteSelection(): void {
    this.modeler?.get('editorActions').trigger('removeSelection');
  }

  copySelection(): void {
    this.modeler?.get('editorActions').trigger('copy');
  }

  paste(): void {
    this.modeler?.get('editorActions').trigger('paste');
  }

  moveSelection(direction: 'left' | 'right' | 'up' | 'down', accelerated: boolean): void {
    this.modeler?.get('keyboardMoveSelection').moveSelection(direction, accelerated);
  }

  toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
    this.updateMetadata({ focusMode: this.focusMode });
    this.modeler?.updateFocus(this.focusMode);
  }

  //#endregion Canvas

  //#region Properties

  /** The text on a process shape: its own label, else the process name from the solution, else the id. */
  getProcessLabel(element: LandscapeProcessElement): string {
    return element.label ?? (this.resolveProcess(element)?.process.name || element.processId);
  }

  getMapProperties(): LandscapeMapProperties | null {
    return this.modeler?.get<LandscapeUpdates>('landscapeUpdates').getMapProperties() ?? null;
  }

  /** The selected canvas elements; each carries its file element, or its relation line, as `businessObject`. */
  getSelectedElements(): any[] {
    return this.modeler?.get('selection').get() ?? [];
  }

  /** File, process and relations of a process shape; `null` when the process is not found in the solution. */
  getProcessDetails(element: LandscapeProcessElement): ProcessDetails | null {
    const resolved = this.resolveProcess(element);
    if (resolved == null) {
      return null;
    }
    const reference = { uri: resolved.uri, processId: resolved.process.id };
    const placed = new Set(this.placedProcesses().map((placedProcess) => referenceKey(placedProcess.reference)));
    const hidden = new Set(this.getMapProperties()?.hiddenRelations ?? []);
    const relations = this.relations.flatMap((relation): ProcessRelationEntry[] => {
      const isOutgoing = sameReference(relation.source, reference);
      if (!isOutgoing && !sameReference(relation.target, reference)) {
        return [];
      }
      const direction = isOutgoing ? 'outgoing' : 'incoming';
      const other = direction === 'outgoing' ? relation.target : relation.source;
      return [
        {
          relation,
          direction,
          otherProcessLabel: this.processName(other),
          otherOnMap: placed.has(referenceKey(other)),
          hidden: hidden.has(relation.key),
        },
      ];
    });
    return {
      relativePath: relativeFileHint(this.uri, resolved.uri),
      process: resolved.process,
      relations,
    };
  }

  /** The number of hidden relations between processes that are both on the map. */
  getHiddenRelationCount(): number {
    const hidden = new Set(this.getMapProperties()?.hiddenRelations ?? []);
    return buildRelationLines({
      relations: this.relations,
      placedProcesses: this.placedProcesses(),
      relationLayers: { callActivity: true, message: true, signal: true },
      hiddenRelations: [],
    }).reduce((count, line) => count + line.relations.filter((relation) => hidden.has(relation.key)).length, 0);
  }

  /** Changes the file element of the only selected element in one undo step. */
  updateSelectedElement(properties: Partial<LandscapeElement>): void {
    const selected = this.getSelectedElements();
    if (this.modeler == null || selected.length !== 1 || selected[0].type === 'relation') {
      return;
    }
    this.modeler.get('commandStack').execute(UPDATE_ELEMENT_COMMAND, { element: selected[0], properties });
  }

  updateMap(properties: Partial<LandscapeMapProperties>): void {
    this.modeler?.get('commandStack').execute(UPDATE_MAP_COMMAND, { properties });
  }

  setRelationLayer(kind: ProcessRelationKind, visible: boolean): void {
    const relationLayers = this.getMapProperties()?.relationLayers;
    if (relationLayers != null && relationLayers[kind] !== visible) {
      this.updateMap({ relationLayers: { ...relationLayers, [kind]: visible } });
    }
  }

  setRelationsHidden(keys: string[], hidden: boolean): void {
    const hiddenRelations = this.getMapProperties()?.hiddenRelations;
    if (hiddenRelations == null) {
      return;
    }
    const next = hidden
      ? [...hiddenRelations, ...keys.filter((key) => !hiddenRelations.includes(key))]
      : hiddenRelations.filter((key) => !keys.includes(key));
    if (next.length !== hiddenRelations.length) {
      this.updateMap({ hiddenRelations: next });
    }
  }

  showAllRelations(): void {
    if ((this.getMapProperties()?.hiddenRelations.length ?? 0) > 0) {
      this.updateMap({ hiddenRelations: [] });
    }
  }

  //#endregion Properties

  /**
   * Shows a parsed map on the canvas; returns the problems of a map that cannot be read. Such a map gets no canvas,
   * so it can never be saved over.
   */
  private applyParseResult(result: LandscapeMapParseResult): string[] {
    if (!result.ok) {
      return result.errors;
    }
    this.map = result.map;
    if (this.modeler == null) {
      this.modeler = this.createModeler();
    }
    this.modeler.importMap(result.map);
    this.showRelations();
    return [];
  }

  private createModeler(): LandscapeModeler {
    const modeler = new LandscapeModeler({
      getProcessLabel: (element) => this.getProcessLabel(element),
      getDecisionCount: (element) => this.resolveProcess(element)?.process.decisionRefs.length ?? 0,
    });
    const eventBus = modeler.get('eventBus');
    eventBus.on('commandStack.changed', ({ trigger }: { trigger: string }) => {
      if (trigger === 'clear' || this.map == null) {
        return;
      }
      this.map = modeler.exportMap(this.map);
      this.currentText = serializeLandscapeMap(this.map);
      this.updateCurrentData(this.currentText);
      this.showRelations();
      this.bumpSelectionRevision();
    });
    eventBus.on('selection.changed', ({ newSelection }: { newSelection: unknown[] }) => {
      this.updateMetadata({ hasSelection: newSelection.length > 0 });
      this.bumpSelectionRevision();
      modeler.updateFocus(this.focusMode);
    });
    eventBus.on('element.dblclick', ({ element }: any) => {
      if (element.type === 'process') {
        this.openProcess(element.businessObject);
      }
    });
    eventBus.on('canvas.viewbox.changed', ({ viewbox }: { viewbox: Viewbox }) => {
      if (isUsableViewbox(viewbox)) {
        this.updateMetadata({
          viewbox: { x: viewbox.x, y: viewbox.y, width: viewbox.width, height: viewbox.height },
        });
      }
    });
    return modeler;
  }

  private applyPendingViewbox(): void {
    const modeler = this.modeler;
    if (modeler == null || this.pendingViewbox == null || !modeler.container.isConnected) {
      return;
    }
    modeler.get('canvas').viewbox(this.pendingViewbox);
    this.pendingViewbox = null;
  }

  private bumpSelectionRevision(): void {
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  /** The solution process a shape stands for: the one in the file the hint points to, else the first with its id. */
  private resolveProcess(element: LandscapeProcessElement): ResolvedProcess | null {
    const candidates = this.catalog.flatMap((entry): ResolvedProcess[] =>
      entry.kind === 'bpmn'
        ? entry.processes
            .filter((process) => process.id === element.processId)
            .map((process) => ({ uri: entry.uri, process }))
        : [],
    );
    return (
      candidates.find((candidate) => relativeFileHint(this.uri, candidate.uri) === element.fileHint) ??
      candidates[0] ??
      null
    );
  }

  private processName(reference: LandscapeProcessReference): string {
    const entry = this.catalog.find((candidate) => candidate.uri === reference.uri);
    const process =
      entry?.kind === 'bpmn' ? entry.processes.find((candidate) => candidate.id === reference.processId) : undefined;
    return process?.name || reference.processId;
  }

  private placedProcesses(): PlacedProcess[] {
    const shapes = this.modeler?.get('elementRegistry').filter((element: any) => element.type === 'process') ?? [];
    return shapes.flatMap((shape: any): PlacedProcess[] => {
      const resolved = this.resolveProcess(shape.businessObject);
      return resolved == null
        ? []
        : [{ elementId: shape.id, reference: { uri: resolved.uri, processId: resolved.process.id } }];
    });
  }

  private showRelations(): void {
    const modeler = this.modeler;
    const mapProperties = this.getMapProperties();
    if (modeler == null || mapProperties == null) {
      return;
    }
    modeler.showRelationLines(
      buildRelationLines({
        relations: this.relations,
        placedProcesses: this.placedProcesses(),
        relationLayers: mapProperties.relationLayers,
        hiddenRelations: mapProperties.hiddenRelations,
      }),
    );
    modeler.updateFocus(this.focusMode);
  }

  private openProcess(element: LandscapeProcessElement): void {
    const resolved = this.resolveProcess(element);
    if (resolved == null) {
      this.studio.notifications.open({
        type: 'info',
        content: `The process "${element.processId}" is not found in the solution, so it cannot be opened.`,
        source: 'Landscapes',
      });
      return;
    }
    void this.studio.commands.executeCommand('std.editor.gotoSymbolInDocument', [resolved.uri, resolved.process.id]);
  }

  private async refreshCatalog(): Promise<void> {
    if (this.studio.solution.getSolution() == null) {
      return;
    }
    const scanNumber = ++this.latestCatalogScan;
    let catalog: SolutionBpmnModelEntry[];
    try {
      catalog = await scanSolutionBpmnModels(this.studio);
    } catch (error) {
      console.warn('[LandscapeMapDocumentModel] The solution scan failed; process names stay as they are:', error);
      return;
    }
    // Scans overlap (open, focus, every solution change); only the newest one counts.
    if (scanNumber !== this.latestCatalogScan) {
      return;
    }
    this.catalog = catalog;
    // The document may have been closed while the scan ran.
    const modeler = this.modeler;
    if (modeler == null) {
      return;
    }
    this.relations = buildProcessRelations(this.catalog);
    const processShapes = modeler.get('elementRegistry').filter((element: any) => element.type === 'process');
    modeler.get('eventBus').fire('elements.changed', { elements: processShapes });
    this.showRelations();
    this.bumpSelectionRevision();
  }

  private startFileWatcher(): void {
    this.watcherDisposable = this.studio.files.watchFile(this.uri, async (eventType: FileEventType) => {
      const editorDocument = this.studio.editors.getEditorDocumentByUri(this.uri);
      const hasErrorOnLoadingFile = editorDocument?.metadata?.errorOnReloadingFile != null;

      const reload = async (): Promise<void> => {
        const newText = await this.studio.files.load(this.uri);
        const currentData = this.getCurrentData();
        // Importing the same text again would only clear the undo history and the selection.
        if (newText === currentData) {
          this.originalText = currentData;
          this.updateOriginalAndCurrentData(currentData, currentData);
          this.updateMetadata({ errorOnReloadingFile: null });
          return;
        }
        const errors = this.applyParseResult(await parseLandscapeMap(newText));
        if (errors.length === 0 || this.modeler == null) {
          this.parseErrors = errors;
          this.originalText = this.currentText = newText;
          this.updateOriginalAndCurrentData(newText, newText);
          this.updateMetadata({ errorOnReloadingFile: null, readable: errors.length === 0 });
          return;
        }
        this.updateOriginalAndCurrentData(newText, this.currentText);
        this.updateMetadata({ errorOnReloadingFile: errors.join(' ') });
      };

      if (eventType === 'change') {
        if (!editorDocument?.hasUnsavedChanges || hasErrorOnLoadingFile) {
          if (this.manualSaveTriggered) {
            this.manualSaveTriggered = false;
          } else {
            await reload();
          }
        } else {
          const newText = await this.studio.files.load(this.uri);
          const isSameContentAsBefore =
            editorDocument?.metadata?.fileChangedFromOutside === true && editorDocument?.data.original === newText;
          this.updateMetadata({ fileChangedFromOutside: !isSameContentAsBefore });
        }
      } else if (eventType === 'unlink') {
        this.updateMetadata({ removedFromFileSystem: true });
        this.updateOriginalAndCurrentData(null, this.getCurrentData());
      } else if (eventType === 'add') {
        await reload();
        this.updateMetadata({ removedFromFileSystem: false });
      }
    });
  }
}
