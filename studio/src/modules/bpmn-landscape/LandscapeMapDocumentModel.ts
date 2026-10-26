import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { FileEventType, WatcherDisposable } from '#bifrost/common/FileHandlingService';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { replaceThemeColorsInSvg } from '#modules/bpmn-core/ImageExportFunctions';
import type { SolutionBpmnModelEntry, SolutionProcessEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type {
  LandscapeElement,
  LandscapeMap,
  LandscapeMapLinkElement,
  LandscapeMapParseResult,
  LandscapePlaceholderElement,
  LandscapeProcessElement,
} from './LandscapeMapFile';
import {
  createElementId,
  createEmptyLandscapeMap,
  parseLandscapeMap,
  relativeFileHint,
  resolveRelativeUri,
  serializeLandscapeMap,
} from './LandscapeMapFile';
import type { LandscapeSolutionScan, LandscapeSolutionSnapshot } from './LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from './LandscapeSolutionScan';
import type { LandscapeProcessReference, ProcessRelation, ProcessRelationKind } from './buildProcessRelations';
import type { PlacedProcess } from './buildRelationLines';
import { buildRelationLines } from './buildRelationLines';
import LandscapeModeler from './modeler/LandscapeModeler';
import type { LandscapeMapProperties } from './modeler/LandscapeUpdates';
import type LandscapeUpdates from './modeler/LandscapeUpdates';
import { UPDATE_ELEMENT_COMMAND, UPDATE_MAP_COMMAND } from './modeler/LandscapeUpdates';
import { levelDepthOf } from './modeler/landscapeHierarchy';
import type { ProcessCandidate, ReferenceStatus } from './resolveProcessReference';
import { replaceCandidates, resolveProcessReference } from './resolveProcessReference';
import type { LandscapeMapEntry } from './scanSolutionLandscapeMaps';

export type AddProcessRequest = { processId: string; fileUri: string; x: number; y: number };

export type AddMapLinkRequest = { mapUri: string; x: number; y: number };

type ResolvedProcess = ProcessCandidate;

/** What the properties pane offers for a process shape whose reference does not resolve. */
export type ProcessReplacementOptions = {
  status: Exclude<ReferenceStatus, 'resolved'>;
  /** The files that define an ambiguous id, or the solution processes that are not on the map yet. */
  candidates: ProcessCandidate[];
  isKept: boolean;
};

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
  /** `null` until the first scan finished; until then no reference counts as broken. */
  private maps: LandscapeMapEntry[] | null = null;
  /** Shapes the user chose to keep broken for this session; Review skips them. */
  private keptElementIds = new Set<string>();
  private notifiedBrokenIds = new Set<string>();
  private brokenNotificationId: string | null = null;
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
    const solutionScan = studio.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
    this.subscriptions.push(solutionScan.onDidChange(() => this.applySnapshot(solutionScan.getSnapshot())));
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
    model.applySnapshot(studio.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY).getSnapshot());
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

  /** The shared scan keeps the references current; the warning waits until the user looks at the map. */
  onEditorDocumentDidFocus(): void {
    this.notifyBrokenProcesses();
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.eventEmitter.removeAllListeners();
    this.watcherDisposable?.dispose();
    this.closeBrokenNotification();
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
      // Scrolling first: it opens the plane that holds the shape, and a plane change clears the selection.
      modeler.get('canvas').scrollToElement(existing);
      modeler.get('selection').select(existing);
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
    modeler.get('selection').select(modeler.addElementShape(element, { x: request.x, y: request.y }));
  }

  /** The map as an SVG with plain colours, or `null` when the map cannot be read and has no canvas. */
  exportSvg(): string | null {
    return this.modeler == null ? null : replaceThemeColorsInSvg(this.modeler.exportSvg());
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

  //#region References

  /** A file of the solution as the map file names it: relative to this map. */
  getRelativePath(fileUri: string): string {
    return relativeFileHint(this.uri, fileUri);
  }

  getProcessStatus(element: LandscapeProcessElement): ReferenceStatus {
    if (this.maps == null) {
      return 'resolved';
    }
    return resolveProcessReference(this.catalog, this.uri, element).status;
  }

  /** `missing` when the map the link names is not among the solution's maps. */
  getMapLinkStatus(element: LandscapeMapLinkElement): Exclude<ReferenceStatus, 'ambiguous'> {
    if (this.maps == null) {
      return 'resolved';
    }
    const targetUri = resolveRelativeUri(this.uri, element.mapPath);
    return this.maps.some((entry) => entry.uri === targetUri) ? 'resolved' : 'missing';
  }

  /** The other maps of the solution, for the "Target map" select. */
  getOtherMaps(): LandscapeMapEntry[] {
    return (this.maps ?? []).filter((entry) => entry.uri !== this.uri);
  }

  getReplacementOptions(element: LandscapeProcessElement): ProcessReplacementOptions | null {
    const resolution = resolveProcessReference(this.catalog, this.uri, element);
    if (this.maps == null || resolution.status === 'resolved') {
      return null;
    }
    return {
      status: resolution.status,
      candidates:
        resolution.status === 'ambiguous'
          ? resolution.candidates
          : replaceCandidates(this.catalog, this.getProcessIdsOnMap()),
      isKept: this.keptElementIds.has(element.id),
    };
  }

  /** Points the selected process shape at another process; the shape keeps its place and its own label. */
  replaceSelectedProcess(candidate: ProcessCandidate): void {
    this.updateSelectedElement({
      processId: candidate.process.id,
      fileHint: relativeFileHint(this.uri, candidate.uri),
    });
  }

  /** Turns the selected process shape into a placeholder with the same bounds; its connectors stay. */
  dropSelectedProcessReference(): void {
    const modeler = this.modeler;
    const selected = this.getSelectedElements();
    if (modeler == null || selected.length !== 1 || selected[0].type !== 'process') {
      return;
    }
    const shape = selected[0];
    const reference: LandscapeProcessElement = shape.businessObject;
    const placeholder: LandscapePlaceholderElement = {
      id: createElementId('placeholder', (id) => modeler.get('elementRegistry').get(id) != null),
      type: 'placeholder',
      parentId: reference.parentId,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      style: reference.style,
      label: reference.label ?? reference.processId,
      shape: reference.shape,
    };
    const replacement = modeler.replaceWithElement(shape, placeholder);
    modeler.get('selection').select(replacement);
  }

  keepSelectedReference(): void {
    const selected = this.getSelectedElements();
    if (selected.length !== 1 || selected[0].type !== 'process') {
      return;
    }
    this.keptElementIds.add(selected[0].id);
    this.bumpSelectionRevision();
  }

  /** Selects the first broken process shape the user has not kept; returns whether there was one. */
  reviewBrokenProcesses(): boolean {
    const modeler = this.modeler;
    const first = this.getBrokenProcessShapes()[0];
    if (modeler == null || first == null) {
      return false;
    }
    modeler.get('canvas').scrollToElement(first);
    modeler.get('selection').select(first);
    return true;
  }

  /** Adds a link to another map of the landscape folder; its label is the name of that map. */
  addMapLink(request: AddMapLinkRequest): void {
    const modeler = this.modeler;
    if (modeler == null) {
      return;
    }
    if (request.mapUri === this.uri) {
      this.studio.notifications.open({
        type: 'info',
        content: 'A map cannot link to itself.',
        source: 'Landscapes',
      });
      return;
    }
    const target = this.maps?.find((entry) => entry.uri === request.mapUri);
    if (this.maps != null && target == null) {
      this.studio.notifications.open({
        type: 'info',
        content: 'Only maps in the landscape folder can be linked.',
        source: 'Landscapes',
      });
      return;
    }
    const label = target?.name ?? this.studio.files.getLocalBasename(request.mapUri, true);
    const mapPath = relativeFileHint(this.uri, request.mapUri);
    const element: LandscapeMapLinkElement = {
      id: createElementId('mapLink', (id) => modeler.get('elementRegistry').get(id) != null),
      type: 'mapLink',
      parentId: null,
      x: request.x - PROCESS_WIDTH / 2,
      y: request.y - PROCESS_HEIGHT / 2,
      width: PROCESS_WIDTH,
      height: PROCESS_HEIGHT,
      style: null,
      label,
      mapPath,
    };
    modeler.get('selection').select(modeler.addElementShape(element, { x: request.x, y: request.y }));
  }

  /**
   * Points the selected map link at another map. The label follows while it still shows the old target's name or file
   * name; a label the user wrote stays.
   */
  retargetSelectedMapLink(mapUri: string): void {
    const selected = this.getSelectedElements();
    const target = this.maps?.find((entry) => entry.uri === mapUri);
    if (selected.length !== 1 || selected[0].type !== 'mapLink' || target == null) {
      return;
    }
    const link: LandscapeMapLinkElement = selected[0].businessObject;
    const previousUri = resolveRelativeUri(this.uri, link.mapPath);
    const previousNames = [
      this.maps?.find((entry) => entry.uri === previousUri)?.name,
      this.studio.files.getLocalBasename(previousUri, true),
    ];
    const mapPath = relativeFileHint(this.uri, mapUri);
    this.updateSelectedElement(previousNames.includes(link.label) ? { mapPath, label: target.name } : { mapPath });
  }

  /** Opens the map a link names; tells the user when the solution has no such map. */
  private openMapLink(element: LandscapeMapLinkElement): void {
    if (this.getMapLinkStatus(element) === 'missing') {
      this.studio.notifications.open({
        type: 'info',
        content: `The map "${element.mapPath}" is not found in the landscape folder, so it cannot be opened.`,
        source: 'Landscapes',
      });
      return;
    }
    void this.studio.commands.executeCommand('std.editor.focusOrOpenDocument', [
      resolveRelativeUri(this.uri, element.mapPath),
    ]);
  }

  private getBrokenProcessShapes(): any[] {
    return (this.modeler?.get('elementRegistry').filter((element: any) => element.type === 'process') ?? []).filter(
      (shape: any) => this.getProcessStatus(shape.businessObject) !== 'resolved' && !this.keptElementIds.has(shape.id),
    );
  }

  /**
   * Warns once per newly broken reference, and only while this map is the one the user looks at. The warning replaces
   * the previous one and goes away once nothing is broken.
   */
  private notifyBrokenProcesses(): void {
    const broken = new Set<string>(this.getBrokenProcessShapes().map((shape: any) => shape.id));
    if (broken.size === 0) {
      this.closeBrokenNotification();
    }
    if (this.studio.editors.getFocusedEditorDocument()?.uri !== this.uri) {
      return;
    }
    for (const id of this.notifiedBrokenIds) {
      if (!broken.has(id)) {
        this.notifiedBrokenIds.delete(id);
      }
    }
    const hasNewlyBroken = [...broken].some((id) => !this.notifiedBrokenIds.has(id));
    broken.forEach((id) => this.notifiedBrokenIds.add(id));
    if (!hasNewlyBroken) {
      return;
    }
    const count = broken.size;
    this.closeBrokenNotification();
    this.brokenNotificationId = this.studio.notifications.open(
      {
        type: 'warning',
        content: `${count} ${count === 1 ? 'process on this map is' : 'processes on this map are'} not found in the solution or defined in several files.`,
        source: 'Landscapes',
        actions: [{ action: 'review', label: 'Review', default: true }],
      },
      (response) => {
        if (response.action === 'review') {
          this.reviewBrokenProcesses();
        }
      },
    );
  }

  private closeBrokenNotification(): void {
    if (this.brokenNotificationId != null) {
      this.studio.notifications.close(this.brokenNotificationId);
      this.brokenNotificationId = null;
    }
  }

  //#endregion References

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

  addLevel(): void {
    const levels = this.getMapProperties()?.levels;
    if (levels != null) {
      const id = createElementId('level', (candidate) => levels.some((level) => level.id === candidate));
      this.updateMap({ levels: [...levels, { id, name: `Level ${levels.length + 1}` }] });
    }
  }

  renameLevel(levelId: string, name: string): void {
    const levels = this.getMapProperties()?.levels;
    if (levels?.some((level) => level.id === levelId && level.name !== name)) {
      this.updateMap({ levels: levels.map((level) => (level.id === levelId ? { ...level, name } : level)) });
    }
  }

  removeLevel(levelId: string): void {
    const levels = this.getMapProperties()?.levels;
    if (levels?.some((level) => level.id === levelId)) {
      this.updateMap({ levels: levels.filter((level) => level.id !== levelId) });
    }
  }

  /** The name the map gives the nesting depth of a group (a canvas shape); `null` when that depth has no name. */
  getGroupLevelName(group: any): string | null {
    return this.getMapProperties()?.levels[levelDepthOf(group)]?.name ?? null;
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
      getProcessStatus: (element) => this.getProcessStatus(element),
      getMapLinkStatus: (element) => this.getMapLinkStatus(element),
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
      if (this.getBrokenProcessShapes().length === 0) {
        this.closeBrokenNotification();
      }
    });
    eventBus.on('selection.changed', ({ newSelection }: { newSelection: unknown[] }) => {
      this.updateMetadata({ hasSelection: newSelection.length > 0 });
      this.bumpSelectionRevision();
      modeler.updateFocus(this.focusMode);
    });
    eventBus.on('element.dblclick', ({ element }: any) => {
      if (element.type === 'process') {
        this.openProcess(element.businessObject);
      } else if (element.type === 'mapLink') {
        this.openMapLink(element.businessObject);
      }
    });
    // The relation lines depend on the plane on screen. A microtask keeps this out of a running undo.
    eventBus.on('root.set', () => queueMicrotask(() => this.showRelations()));
    eventBus.on('canvas.viewbox.changed', ({ viewbox }: { viewbox: Viewbox }) => {
      // Only the top-level map's view is restored when the map is reopened; planes start fitted.
      if (isUsableViewbox(viewbox) && modeler.get('canvas').getRootElement()?.group == null) {
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

  /** The solution process a shape stands for; `null` when the reference is missing or ambiguous. */
  private resolveProcess(element: LandscapeProcessElement): ResolvedProcess | null {
    const resolution = resolveProcessReference(this.catalog, this.uri, element);
    return resolution.status === 'resolved' ? { uri: resolution.uri, process: resolution.process } : null;
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

  /** The processes as the plane on screen shows them: a process inside a collapsed group is its group. */
  private visiblePlacedProcesses(): PlacedProcess[] {
    const modeler = this.modeler;
    if (modeler == null) {
      return [];
    }
    return this.placedProcesses().flatMap((placedProcess): PlacedProcess[] => {
      const shape = modeler.get('elementRegistry').get(placedProcess.elementId);
      const representative = shape == null ? null : modeler.representativeOnCurrentPlane(shape);
      return representative == null ? [] : [{ ...placedProcess, elementId: representative.id }];
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
        placedProcesses: this.visiblePlacedProcesses(),
        relationLayers: mapProperties.relationLayers,
        hiddenRelations: mapProperties.hiddenRelations,
      }),
    );
    modeler.updateFocus(this.focusMode);
  }

  private openProcess(element: LandscapeProcessElement): void {
    const resolved = this.resolveProcess(element);
    if (resolved == null) {
      const reason =
        this.getProcessStatus(element) === 'ambiguous'
          ? `is defined in several files; choose the file in the properties pane`
          : `is not found in the solution`;
      this.studio.notifications.open({
        type: 'info',
        content: `The process "${element.processId}" ${reason}, so it cannot be opened.`,
        source: 'Landscapes',
      });
      return;
    }
    void this.studio.commands.executeCommand('std.editor.gotoSymbolInDocument', [resolved.uri, resolved.process.id]);
  }

  /** Takes over the shared solution scan; without a solution or a first scan, no reference counts as broken yet. */
  private applySnapshot(snapshot: LandscapeSolutionSnapshot | null): void {
    if (snapshot == null || this.studio.solution.getSolution() == null) {
      return;
    }
    this.catalog = snapshot.catalog;
    this.maps = snapshot.maps;
    // The document may have been closed since the scan started.
    const modeler = this.modeler;
    if (modeler == null) {
      return;
    }
    this.relations = snapshot.relations;
    const referenceShapes = modeler
      .get('elementRegistry')
      .filter((element: any) => element.type === 'process' || element.type === 'mapLink');
    modeler.get('eventBus').fire('elements.changed', { elements: referenceShapes });
    this.showRelations();
    this.bumpSelectionRevision();
    this.notifyBrokenProcesses();
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
