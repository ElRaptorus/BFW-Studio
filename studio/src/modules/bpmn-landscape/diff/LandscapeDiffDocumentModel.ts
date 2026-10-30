import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import type { LandscapeMap } from '../LandscapeMapFile';
import { parseLandscapeMap } from '../LandscapeMapFile';
import { LANDSCAPE_DOCUMENT_TYPE } from '../landscapeFolder';
import type { LandscapeRendererConfig } from '../modeler/LandscapeRenderer';
import { LandscapeViewerWithSync, createLandscapeViewerConfig } from './LandscapeViewerWithSync';
import type { LandscapeMapDiff } from './landscapeMapDiff';
import { diffLandscapeMaps } from './landscapeMapDiff';

export const EVENT_RELOADING = 'EVENT_RELOADING';
export const EVENT_RELOADING_DONE = 'EVENT_RELOADING_DONE';

/** `visual` shows the two canvases side by side, `xml` the two file texts in a text diff. Kept in the metadata. */
type DiffViewMode = 'visual' | 'xml';

async function readMap(text: string, side: string): Promise<LandscapeMap> {
  const result = await parseLandscapeMap(text);
  if (!result.ok) {
    throw new Error(`The ${side} version of the map cannot be read:\n${result.errors.join('\n')}`);
  }
  return result.map;
}

/**
 * Two read-only map canvases with change markers. The parsed maps, the diff and the selection live here; the metadata
 * only carries the view mode and a `selectionRevision` that re-renders the panes.
 */
export default class LandscapeDiffDocumentModel extends EditorDocumentModel {
  protected readonly bifrost: Bifrost;
  /** Process names and reference states are resolved against the map file in the solution. */
  protected readonly viewerConfig: LandscapeRendererConfig;
  protected afterMap: LandscapeMap | null = null;
  protected readyForInteraction = false;

  private beforeMap: LandscapeMap | null = null;
  private readonly viewerBefore: LandscapeViewerWithSync;
  private readonly viewerAfter: LandscapeViewerWithSync;
  private diff: LandscapeMapDiff | null = null;
  private beforeText = '';
  private afterText = '';
  private textRevision = 0;
  private viewMode: DiffViewMode;
  private initializing = false;
  private viewersSynced = false;
  private selectionRevision = 0;

  constructor(uri: string, restoredCurrentData: any, restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri);
    this.bifrost = bifrost;
    this.viewMode = restoredMetadata?.viewMode === 'xml' ? 'xml' : 'visual';

    const { parentUri, data } = parseOpenInNewTabUrl(uri);
    this.viewerConfig = createLandscapeViewerConfig(bifrost, data.sourceFileUri ?? parentUri);
    this.viewerBefore = new LandscapeViewerWithSync(this.viewerConfig);
    this.viewerAfter = new LandscapeViewerWithSync(this.viewerConfig);
    this.viewerBefore.on(EVENT_METADATA_UPDATED, ({ selectedElementIds }: { selectedElementIds: string[] }) =>
      this.onSelectionChanged(selectedElementIds, this.viewerAfter),
    );
    this.viewerAfter.on(EVENT_METADATA_UPDATED, ({ selectedElementIds }: { selectedElementIds: string[] }) =>
      this.onSelectionChanged(selectedElementIds, this.viewerBefore),
    );
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<LandscapeDiffDocumentModel> {
    const model = new LandscapeDiffDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    await model.initialize();
    return model;
  }

  async attachTo(htmlElementBefore: HTMLDivElement, htmlElementAfter: HTMLDivElement): Promise<void> {
    assertNotNull(this.diff, 'this.diff');
    assertNotNull(this.beforeMap, 'this.beforeMap');
    assertNotNull(this.afterMap, 'this.afterMap');
    const { added, removed, modified, layoutChanged } = this.diff;

    this.viewerBefore.loadMap(this.beforeMap);
    this.viewerAfter.loadMap(this.afterMap);
    removed.forEach((item) => this.viewerBefore.addOverlay(item.id, 'deleted', 'ph-duotone ph-minus-circle'));
    added.forEach((item) => this.viewerAfter.addOverlay(item.id, 'added', 'ph-duotone ph-plus-circle'));
    for (const viewer of [this.viewerBefore, this.viewerAfter]) {
      modified.forEach((item) => viewer.addOverlay(item.id, 'updated', 'ph-duotone ph-pencil'));
      [...layoutChanged, ...modified.filter((item) => item.layoutChanged)].forEach((item) =>
        viewer.addOverlay(item.id, 'moved', 'ph ph-arrows-out'),
      );
    }

    this.viewerBefore.attachTo(htmlElementBefore);
    this.viewerAfter.attachTo(htmlElementAfter);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        if (!this.viewersSynced) {
          this.viewerBefore.addSelectionSync(this.viewerAfter);
          this.viewerAfter.addSelectionSync(this.viewerBefore);
          this.viewerAfter.addViewboxSync(this.viewerBefore);
          this.viewerBefore.addViewboxSync(this.viewerAfter);
          this.viewersSynced = true;
        }
        this.viewerBefore.resetZoom();
        this.readyForInteraction = true;
        this.updateMetadata({ readyForInteraction: true });
        resolve();
      });
    });
  }

  getDiff(): LandscapeMapDiff | null {
    return this.diff;
  }

  getBeforeUri(): string {
    return parseOpenInNewTabUrl(this.uri).data.beforeUri;
  }

  getAfterUri(): string {
    return parseOpenInNewTabUrl(this.uri).data.afterUri;
  }

  getBeforeFilename(): string {
    return this.bifrost.files.getLocalBasename(this.getBeforeUri());
  }

  getAfterFilename(): string {
    return this.bifrost.files.getLocalBasename(this.getAfterUri());
  }

  getBeforeText(): string {
    return this.beforeText;
  }

  getAfterText(): string {
    return this.afterText;
  }

  /** Increases whenever a compared text changed, so a mounted text diff can be re-created. */
  getTextRevision(): number {
    return this.textRevision;
  }

  getViewMode(): DiffViewMode {
    return this.viewMode;
  }

  setViewMode(viewMode: DiffViewMode): void {
    if (viewMode !== this.viewMode) {
      this.viewMode = viewMode;
      this.updateMetadata({ viewMode });
    }
  }

  getCurrentAndMaxChanges(): { currentChangeNumber: number | null; maxChangeNumber: number } {
    const changedIds = this.getChangedCanvasIds();
    const currentIndex = changedIds.indexOf(this.getSelectedElementId());
    return { currentChangeNumber: currentIndex === -1 ? null : currentIndex + 1, maxChangeNumber: changedIds.length };
  }

  selectPreviousChange(): void {
    const changedIds = this.getChangedCanvasIds();
    if (changedIds.length > 0) {
      const currentIndex = changedIds.indexOf(this.getSelectedElementId());
      this.selectElements([changedIds[currentIndex > 0 ? currentIndex - 1 : changedIds.length - 1]]);
    }
  }

  selectNextChange(): void {
    const changedIds = this.getChangedCanvasIds();
    if (changedIds.length > 0) {
      const currentIndex = changedIds.indexOf(this.getSelectedElementId());
      this.selectElements([changedIds[currentIndex < changedIds.length - 1 ? currentIndex + 1 : 0]]);
    }
  }

  /** Selects each element on the side that has it (the selection sync mirrors it) and centres it in both viewers. */
  selectElements(elementIds: string[]): void {
    const registryBefore = this.viewerBefore.getElementRegistry();
    const registryAfter = this.viewerAfter.getElementRegistry();
    const shapesBefore = elementIds.map((elementId) => registryBefore.get(elementId)).filter((shape) => shape != null);
    const shapesAfter = elementIds
      .filter((elementId) => registryBefore.get(elementId) == null)
      .map((elementId) => registryAfter.get(elementId))
      .filter((shape) => shape != null);
    if (shapesBefore.length > 0) {
      this.viewerBefore.getSelection().select(shapesBefore);
    }
    if (shapesAfter.length > 0) {
      this.viewerAfter.getSelection().select(shapesAfter);
    }
    void this.zoomToElements(elementIds);
  }

  getSelectedElements(): ElementLike[] {
    return [...this.viewerBefore.getSelection().get(), ...this.viewerAfter.getSelection().get()];
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  isInitializing(): boolean {
    return this.initializing;
  }

  async reload(): Promise<void> {
    if (this.initializing) {
      return;
    }
    this.emit(EVENT_RELOADING);
    this.updateMetadata({ errorWhileReload: null });
    try {
      await this.initialize();
    } catch (error: any) {
      this.updateMetadata({ errorWhileReload: error.message });
    }
    this.emit(EVENT_RELOADING_DONE);
  }

  override onEditorDocumentDidFocus(): void {
    void this.reload();
  }

  setZoom(percentage: number): void {
    this.viewerBefore.setZoom(percentage);
  }

  zoomToViewport(): void {
    this.viewerBefore.resetZoom();
  }

  async zoomToElements(elementIds: string[]): Promise<void> {
    for (const viewer of [this.viewerBefore, this.viewerAfter]) {
      const registry = viewer.getElementRegistry();
      const presentIds = elementIds.filter((elementId) => registry.get(elementId) != null);
      if (presentIds.length > 0) {
        await viewer.focusViewOnElements(presentIds);
      }
    }
  }

  /** The names of the two sides in error messages. */
  protected describeSides(): [before: string, after: string] {
    return ['before', 'after'];
  }

  protected async loadTexts(): Promise<[before: string, after: string]> {
    const { beforeUri, beforeData, afterUri, afterData } = parseOpenInNewTabUrl(this.uri).data;
    if (beforeUri == null || afterUri == null) {
      throw new Error(`LandscapeDiffDocumentModel: Missing search param 'beforeUri' or 'afterUri' in: ${this.uri}`);
    }
    return Promise.all([this.loadSide(beforeUri, beforeData, 'before'), this.loadSide(afterUri, afterData, 'after')]);
  }

  protected async initialize(): Promise<void> {
    if (this.initializing) {
      return;
    }
    this.initializing = true;
    try {
      const [beforeText, afterText] = await this.loadTexts();
      const [beforeSide, afterSide] = this.describeSides();
      [this.beforeMap, this.afterMap] = await Promise.all([
        readMap(beforeText, beforeSide),
        readMap(afterText, afterSide),
      ]);
      this.diff = diffLandscapeMaps(this.beforeMap, this.afterMap);
      if (beforeText !== this.beforeText || afterText !== this.afterText) {
        this.beforeText = beforeText;
        this.afterText = afterText;
        this.textRevision++;
      }
    } finally {
      this.initializing = false;
    }
  }

  private async loadSide(uri: string, dataType: 'original' | 'current', side: string): Promise<string> {
    const basename = this.bifrost.files.getLocalBasename(uri);
    const isMap =
      this.bifrost.editors.hasDocumentTypeDefinitionForUri(uri) &&
      this.bifrost.editors.getDocumentTypeDefinitionByUri(uri)?.documentType === LANDSCAPE_DOCUMENT_TYPE;
    if (!isMap) {
      throw new Error(`The ${side} file "${basename}" is not a landscape map`);
    }
    if (dataType === 'current') {
      const currentText = this.bifrost.editors.getEditorDocumentByUri(uri)?.data?.current;
      if (typeof currentText !== 'string') {
        throw new Error(`The working copy of "${basename}" is not available`);
      }
      return currentText;
    }
    if (
      this.bifrost.files.isLocalFilename(uri) &&
      !(await this.bifrost.files.doesFileOrDirectoryExist(this.bifrost.files.getLocalFilenameForUri(uri)))
    ) {
      throw new Error(`The ${side} file "${basename}" does not exist`);
    }
    return this.bifrost.files.load(uri);
  }

  private onSelectionChanged(selectedElementIds: string[], otherViewer: LandscapeViewerWithSync): void {
    if (selectedElementIds.length === 0 && otherViewer.getSelection().get().length !== 0) {
      otherViewer.selectWithoutSync();
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  private getSelectedElementId(): string {
    return (this.viewerBefore.getSelection().get()[0] ?? this.viewerAfter.getSelection().get()[0])?.id ?? '';
  }

  /** Levels and map properties have no shape, so change navigation skips them. */
  private getChangedCanvasIds(): string[] {
    if (this.diff == null) {
      return [];
    }
    const { added, removed, modified, layoutChanged } = this.diff;
    return [...added, ...removed, ...modified, ...layoutChanged]
      .filter((item) => item.itemType !== 'level')
      .map((item) => item.id);
  }
}
