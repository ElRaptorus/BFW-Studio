import type { Bifrost } from '#bifrost/Bifrost';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';

import { EditorDocumentModel, assertNotNull, parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { EVENT_METADATA_UPDATED } from '../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { DmnDiff, type DmnDiffChangesByAction, DmnViewerWithSync, buildDmnChangeSummary } from '../dmn-core/diff';
import type { DmnChangeSummary } from '../dmn-core/diff';

type CurrentAndMaxChanges = {
  currentChangeNumber: number | null;
  maxChangeNumber: number;
};

export const EVENT_RELOADING = 'EVENT_RELOADING';
export const EVENT_RELOADING_DONE = 'EVENT_RELOADING_DONE';

export type ElementLike = {
  id: string;
  businessObject?: any;
} & Record<string, any>;

export default class DmnDiffDocumentModel extends EditorDocumentModel {
  protected bifrost: Bifrost;
  protected fileLoader: ILoadable;

  protected dmnDiff: DmnDiff | null;
  protected dmnViewerBefore: DmnViewerWithSync;
  protected dmnViewerAfter: DmnViewerWithSync;

  protected viewersSynced: boolean;
  protected readyForInteraction: boolean;
  protected initializing: boolean = false;
  protected cachedChangeSummary: DmnChangeSummary | null = null;

  private shownXmlAsJson: string;
  private restoredMetadata: any;

  constructor(uri: string, restoredCurrentData: any, restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri);

    this.viewersSynced = false;
    this.readyForInteraction = false;
    this.shownXmlAsJson = '';
    this.dmnDiff = null;
    this.fileLoader = fileLoader;
    this.bifrost = bifrost;
    this.restoredMetadata = restoredMetadata;

    this.dmnViewerBefore = new DmnViewerWithSync();
    this.dmnViewerAfter = new DmnViewerWithSync();

    this.dmnViewerBefore.on(EVENT_METADATA_UPDATED, (partialMetadata: any) => {
      const { selectedElementIds } = partialMetadata;
      if (selectedElementIds.length === 0) {
        const afterSelection = this.dmnViewerAfter.getSelection();
        if (afterSelection != null && afterSelection.get().length !== 0) {
          this.dmnViewerAfter.selectWithoutSync();
        }
      }
      this.updateMetadata(partialMetadata);
    });
    this.dmnViewerAfter.on(EVENT_METADATA_UPDATED, (partialMetadata: any) => {
      const { selectedElementIds } = partialMetadata;
      if (selectedElementIds.length === 0) {
        const beforeSelection = this.dmnViewerBefore.getSelection();
        if (beforeSelection != null && beforeSelection.get().length !== 0) {
          this.dmnViewerBefore.selectWithoutSync();
        }
      }
      this.updateMetadata(partialMetadata);
    });
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<DmnDiffDocumentModel> {
    const model = new DmnDiffDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    await model.initialize();
    return model;
  }

  async attachTo(htmlElementBefore: HTMLDivElement, htmlElementAfter: HTMLDivElement): Promise<void> {
    assertNotNull(this.dmnDiff, 'this.dmnDiff');

    const changes = await this.dmnDiff.diff();
    const viewerBefore = this.dmnViewerBefore;
    const viewerAfter = this.dmnViewerAfter;

    await viewerBefore.loadXml(this.dmnDiff.beforeXml);

    for (const id of Object.keys(changes.removed)) {
      viewerBefore.addOverlay(id, 'deleted', 'ph-duotone ph-minus-circle');
    }
    for (const id of Object.keys(changes.layoutChanged)) {
      viewerBefore.addOverlay(id, 'moved', 'ph ph-arrows-out');
    }
    for (const id of Object.keys(changes.updated)) {
      viewerBefore.addOverlay(id, 'updated', 'ph-duotone ph-pencil');
    }

    await viewerAfter.loadXml(this.dmnDiff.afterXml);

    for (const id of Object.keys(changes.added)) {
      viewerAfter.addOverlay(id, 'added', 'ph-duotone ph-plus-circle');
    }
    for (const id of Object.keys(changes.layoutChanged)) {
      viewerAfter.addOverlay(id, 'moved', 'ph ph-arrows-out');
    }
    for (const id of Object.keys(changes.updated)) {
      viewerAfter.addOverlay(id, 'updated', 'ph-duotone ph-pencil');
    }

    viewerBefore.attachTo(htmlElementBefore);
    viewerAfter.attachTo(htmlElementAfter);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        if (!this.viewersSynced) {
          viewerBefore.addSelectionSync(viewerAfter);
          viewerAfter.addSelectionSync(viewerBefore);
          viewerAfter.addViewboxSync(viewerBefore);
          viewerBefore.addViewboxSync(viewerAfter);
          this.viewersSynced = true;
        }

        this.restoreFromLastSession(this.restoredMetadata);
        this.readyForInteraction = true;
        this.updateMetadata({ readyForInteraction: true });
        resolve();
      });
    });
  }

  getBeforeFilename(): string {
    const { data } = parseOpenInNewTabUrl(this.uri);
    return this.bifrost.files.getLocalBasename(data.beforeUri);
  }

  getAfterFilename(): string {
    const { data } = parseOpenInNewTabUrl(this.uri);
    return this.bifrost.files.getLocalBasename(data.afterUri);
  }

  getBeforeUri(): string {
    return parseOpenInNewTabUrl(this.uri).data.beforeUri;
  }

  getAfterUri(): string {
    return parseOpenInNewTabUrl(this.uri).data.afterUri;
  }

  getCurrentAndMaxChanges(): CurrentAndMaxChanges {
    const selectedElementId = this.getSelectedElementId();
    const allChangedElementIds = this.getAllChangedElementIds();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);
    return {
      currentChangeNumber: currentChangeIndex === -1 ? null : currentChangeIndex + 1,
      maxChangeNumber: allChangedElementIds.length,
    };
  }

  selectPreviousChange(): void {
    const allChangedElementIds = this.getAllChangedElementIds();
    if (allChangedElementIds.length === 0) {
      return;
    }
    const selectedElementId = this.getSelectedElementId();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);
    const newIndex = currentChangeIndex > 0 ? currentChangeIndex - 1 : allChangedElementIds.length - 1;
    this.selectElements([allChangedElementIds[newIndex]]);
  }

  selectNextChange(): void {
    const allChangedElementIds = this.getAllChangedElementIds();
    if (allChangedElementIds.length === 0) {
      return;
    }
    const selectedElementId = this.getSelectedElementId();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);
    const newIndex = currentChangeIndex < allChangedElementIds.length - 1 ? currentChangeIndex + 1 : 0;
    this.selectElements([allChangedElementIds[newIndex]]);
  }

  getChangesById(elementId: string): any[] {
    assertNotNull(this.dmnDiff, 'this.dmnDiff');
    return this.dmnDiff.getChangesById(elementId);
  }

  getChangeSummary(): DmnChangeSummary | null {
    if (this.cachedChangeSummary != null) {
      return this.cachedChangeSummary;
    }
    if (this.dmnDiff?.changes == null) {
      return null;
    }
    return buildDmnChangeSummary(this.dmnDiff.getChanges());
  }

  protected async initializeDiffViewers(beforeXml: string, afterXml: string): Promise<void> {
    this.dmnDiff = new DmnDiff(beforeXml, afterXml);

    let changes: DmnDiffChangesByAction;
    try {
      changes = await this.dmnDiff.diff();
    } catch {
      throw new Error('The two DMN XMLs could not be compared. A document may have an invalid XML structure.');
    }

    assertNotNull(changes, 'changes');
    this.cachedChangeSummary = buildDmnChangeSummary(changes);

    const xmlAsJson = JSON.stringify({ beforeXml, afterXml });
    if (xmlAsJson === this.shownXmlAsJson) {
      return;
    }
    this.shownXmlAsJson = xmlAsJson;
  }

  protected async initialize(): Promise<void> {
    if (this.isInitializing()) {
      return;
    }

    this.initializing = true;
    this.cachedChangeSummary = null;
    try {
      const { data } = parseOpenInNewTabUrl(this.uri);

      const beforeUri = data.beforeUri;
      const beforeData = data.beforeData;
      const afterUri = data.afterUri;
      const afterData = data.afterData;

      if (beforeUri == null) {
        throw new Error(`DmnDiffDocumentModel: Missing search param 'beforeUri' in: ${this.uri}`);
      }
      if (afterUri == null) {
        throw new Error(`DmnDiffDocumentModel: Missing search param 'afterUri' in: ${this.uri}`);
      }

      if (beforeUri.startsWith('buffer:')) {
        throw new Error(
          `The beforeUri "${beforeUri}" is a buffer document (not persisted on the file system) so there is no data to create a diff against`,
        );
      }

      const beforeUriIsLocalFile = this.bifrost.files.isLocalFilename(beforeUri);
      if (beforeUriIsLocalFile) {
        const filename = this.bifrost.files.getLocalFilenameForUri(beforeUri);
        const beforeFileExists = await this.bifrost.files.doesFileOrDirectoryExist(filename);
        if (!beforeFileExists) {
          const basename = this.bifrost.files.getLocalBasename(beforeUri);
          throw new Error(`The before file "${basename}" does not exist`);
        }
      }

      const afterUriIsLocalFile = this.bifrost.files.isLocalFilename(afterUri);
      if (afterUriIsLocalFile) {
        const filename = this.bifrost.files.getLocalFilenameForUri(afterUri);
        const afterFileExists = await this.bifrost.files.doesFileOrDirectoryExist(filename);
        if (!afterFileExists) {
          const basename = this.bifrost.files.getLocalBasename(afterUri);
          throw new Error(`The after file "${basename}" does not exist`);
        }
      }

      const beforeFileIsDmn =
        this.bifrost.editors.hasDocumentTypeDefinitionForUri(beforeUri) &&
        this.bifrost.editors.getDocumentTypeDefinitionByUri(beforeUri)?.documentType === 'dmn';
      if (!beforeFileIsDmn) {
        const basename = this.bifrost.files.getLocalBasename(beforeUri);
        throw new Error(`The before file "${basename}" is not a DMN file`);
      }

      const afterFileIsDmn =
        this.bifrost.editors.hasDocumentTypeDefinitionForUri(afterUri) &&
        this.bifrost.editors.getDocumentTypeDefinitionByUri(afterUri)?.documentType === 'dmn';
      if (!afterFileIsDmn) {
        const basename = this.bifrost.files.getLocalBasename(afterUri);
        throw new Error(`The after file "${basename}" is not a DMN file`);
      }

      const beforeXml =
        beforeData === 'current' ? this.getCurrentXml(beforeUri) : await this.bifrost.files.load(beforeUri);
      const afterXml = afterData === 'current' ? this.getCurrentXml(afterUri) : await this.bifrost.files.load(afterUri);

      await this.initializeDiffViewers(beforeXml, afterXml);
    } finally {
      this.initializing = false;
    }
  }

  async reload(): Promise<void> {
    if (this.isInitializing()) {
      return;
    }
    this.emit(EVENT_RELOADING);
    this.updateMetadata({ errorWhileReload: null });
    try {
      await this.initialize();
      this.emit(EVENT_RELOADING_DONE);
    } catch (error: any) {
      this.updateMetadata({ errorWhileReload: error.message });
      this.emit(EVENT_RELOADING_DONE);
    }
  }

  isInitializing(): boolean {
    return this.initializing;
  }

  onEditorDocumentDidFocus(): void {
    this.reload();
  }

  protected async restoreFromLastSession(metadata: any): Promise<void> {
    if (metadata?.selectedElementIds != null && metadata?.selectedElementIds.length > 0) {
      this.selectElements(metadata.selectedElementIds);
      this.updateMetadata(metadata);
    }
    this.dmnViewerBefore.resetZoom();
  }

  selectElements(elementIds: string[]): void {
    const selectionBefore = this.dmnViewerBefore.getSelection();
    const registryBefore = this.dmnViewerBefore.getElementRegistry();
    const selectionAfter = this.dmnViewerAfter.getSelection();
    const registryAfter = this.dmnViewerAfter.getElementRegistry();

    if (selectionBefore == null || registryBefore == null || selectionAfter == null || registryAfter == null) {
      return;
    }

    const elementsWithOrigin = elementIds.map((elementId: string) => {
      const shapeFromBefore = registryBefore.get(elementId);
      const origin = shapeFromBefore != null ? 'beforeViewer' : 'afterViewer';
      const shape = shapeFromBefore ?? registryAfter.get(elementId);
      return { origin, shape };
    });

    const shapesForBefore = elementsWithOrigin.filter((e) => e.origin === 'beforeViewer').map((e) => e.shape);
    const shapesForAfter = elementsWithOrigin.filter((e) => e.origin === 'afterViewer').map((e) => e.shape);

    if (shapesForBefore.length !== 0) {
      selectionBefore.select(shapesForBefore);
    }
    if (shapesForAfter.length !== 0) {
      selectionAfter.select(shapesForAfter);
    }
  }

  private getCurrentXml(uri: string): string {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null) {
      throw new Error(`DmnDiffDocumentModel: Could not retrieve current data: ${uri}`);
    }
    const currentXml = editorDocument.data && editorDocument.data.current;
    if (currentXml == null || currentXml === false) {
      throw new Error(`DmnDiffDocumentModel: Could not retrieve current xml: ${uri}`);
    }
    return currentXml;
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  getSelectedElements(): ElementLike[] {
    return [
      ...(this.dmnViewerBefore?.getSelection()?.get() ?? []),
      ...(this.dmnViewerAfter?.getSelection()?.get() ?? []),
    ];
  }

  getSelectedElementId(): string {
    let selectedElement = this.dmnViewerBefore.getSelection()?.get()[0];
    if (selectedElement == null) {
      selectedElement = this.dmnViewerAfter.getSelection()?.get()[0];
    }
    return selectedElement?.id;
  }

  protected getAllChangedElementIds(): string[] {
    assertNotNull(this.dmnDiff, 'this.dmnDiff');
    return [...this.dmnDiff.getAllChangedElementIds()];
  }

  setZoom(percentage: number): void {
    this.dmnViewerBefore.setZoom(percentage);
  }

  zoomToViewport(): void {
    this.dmnViewerBefore.resetZoom();
  }

  async zoomToElements(elementIds: string[]): Promise<void> {
    try {
      const registryBefore = this.dmnViewerBefore?.getElementRegistry();
      const registryAfter = this.dmnViewerAfter?.getElementRegistry();

      const elementsInBefore = registryBefore != null ? elementIds.filter((id) => registryBefore.get(id) != null) : [];
      const elementsInAfter = registryAfter != null ? elementIds.filter((id) => registryAfter.get(id) != null) : [];

      if (elementsInBefore.length > 0) {
        await this.dmnViewerBefore?.focusViewOnElements(elementsInBefore);
      }
      if (elementsInAfter.length > 0) {
        await this.dmnViewerAfter?.focusViewOnElements(elementsInAfter);
      }
    } catch (error: any) {
      if (error.message.match(/(Could not get bounds|Cannot read property)/)) {
        error.message += ` (tried to zoom to elements with IDs '${elementIds.join(', ')}')`;
      }
      throw error;
    }
  }
}
