import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';

import {
  BpmnDiff,
  type BpmnDiffChangesByAction,
  type BpmnDiffChangesById,
  BpmnViewerWithSync,
  buildAugmentedChangeSummary,
  buildChangeSummary,
  getCallActivityExtensionChangesForElement as lookupCallActivityExtensionChangesInSummary,
  getCustomPropertyChangesForElement as lookupCustomPropertyChangesInSummary,
  rawDiffFromBpmnDiffBuckets,
} from '../bpmn-core/diff';
import type { AttributeChange, ChangeSummary, CustomPropertyDelta } from '../bpmn-core/diff';

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

export default class BpmnDiffDocumentModel extends EditorDocumentModel {
  protected bifrost: Bifrost;
  protected fileLoader: ILoadable;

  protected bpmnDiff: BpmnDiff | null;
  protected bpmnViewerBefore: BpmnViewerWithSync;
  protected bpmnViewerAfter: BpmnViewerWithSync;

  protected viewersSynced: boolean;
  protected readyForInteraction: boolean;
  protected initializing: boolean = false;
  protected cachedChangeSummary: ChangeSummary | null = null;

  private shownXmlAsJson: string;
  private restoredMetadata: any;

  constructor(uri: string, restoredCurrentData: any, restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri);

    this.viewersSynced = false;
    this.readyForInteraction = false;
    this.shownXmlAsJson = '';
    this.bpmnDiff = null;
    this.fileLoader = fileLoader;
    this.bifrost = bifrost;
    this.restoredMetadata = restoredMetadata;

    this.bpmnViewerBefore = new BpmnViewerWithSync();
    this.bpmnViewerAfter = new BpmnViewerWithSync();

    this.bpmnViewerBefore.on(EVENT_METADATA_UPDATED, (partialMetadata) => {
      const { selectedElementIds } = partialMetadata;
      if (selectedElementIds.length === 0 && this.bpmnViewerAfter.getSelection().get().length !== 0) {
        this.bpmnViewerAfter.selectWithoutSync();
      }

      this.updateMetadata(partialMetadata);
    });
    this.bpmnViewerAfter.on(EVENT_METADATA_UPDATED, (partialMetadata) => {
      const { selectedElementIds } = partialMetadata;
      if (selectedElementIds.length === 0 && this.bpmnViewerBefore.getSelection().get().length !== 0) {
        this.bpmnViewerBefore.selectWithoutSync();
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
  ): Promise<BpmnDiffDocumentModel> {
    const model = new BpmnDiffDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);

    await model.initialize();

    return model;
  }

  async attachTo(htmlElementBefore: HTMLDivElement, htmlElementAfter: HTMLDivElement): Promise<void> {
    assertNotNull(this.bpmnDiff, 'this.bpmnDiff');

    const changes = await this.bpmnDiff.diff();
    const bpmnViewerBefore = this.bpmnViewerBefore;
    const bpmnViewerAfter = this.bpmnViewerAfter;

    await bpmnViewerBefore.loadXml(this.bpmnDiff.beforeXml).then(() => {
      assertNotNull(this, 'this');

      applyOverlays(bpmnViewerBefore, changes.deleted, 'deleted', 'ph-duotone ph-minus-circle');
      applyOverlays(bpmnViewerBefore, changes.moved, 'moved', 'ph ph-arrows-out');
      applyOverlays(bpmnViewerBefore, changes.updated, 'updated', 'ph-duotone ph-pencil');

      assertNotNull(this.bpmnDiff, 'this.bpmnDiff');
      bpmnViewerAfter.loadXml(this.bpmnDiff.afterXml).then(() => {
        assertNotNull(this, 'this');

        applyOverlays(bpmnViewerAfter, changes.added, 'added', 'ph-duotone ph-plus-circle');
        applyOverlays(bpmnViewerAfter, changes.moved, 'moved', 'ph ph-arrows-out');
        applyOverlays(bpmnViewerAfter, changes.updated, 'updated', 'ph-duotone ph-pencil');

        this.restoreFromLastSession(this.restoredMetadata);

        if (this.viewersSynced === false) {
          bpmnViewerBefore.addSelectionSync(bpmnViewerAfter);
          bpmnViewerAfter.addSelectionSync(bpmnViewerBefore);
          bpmnViewerAfter.addViewboxSync(bpmnViewerBefore);
          bpmnViewerBefore.addViewboxSync(bpmnViewerAfter);

          this.viewersSynced = true;
        }
      });
    });

    this.bpmnViewerBefore.attachTo(htmlElementBefore);
    this.bpmnViewerAfter.attachTo(htmlElementAfter);

    this.readyForInteraction = true;
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
    const { data } = parseOpenInNewTabUrl(this.uri);

    return data.beforeUri;
  }

  getAfterUri(): string {
    const { data } = parseOpenInNewTabUrl(this.uri);

    return data.afterUri;
  }

  getCurrentAndMaxChanges(): CurrentAndMaxChanges {
    const selectedElementId = this.getSelectedElementId();
    const allChangedElementIds = this.getAllChangedElementIds();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);

    const currentChangeNumber = currentChangeIndex === -1 ? null : currentChangeIndex + 1;
    const maxChangeNumber = allChangedElementIds.length;

    return { currentChangeNumber, maxChangeNumber };
  }

  selectPreviousChange(): void {
    const allChangedElementIds = this.getAllChangedElementIds();

    if (allChangedElementIds.length === 0) {
      return;
    }

    const selectedElementId = this.getSelectedElementId();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);

    const newIndex = currentChangeIndex > 0 ? currentChangeIndex - 1 : allChangedElementIds.length - 1;
    const elementId = allChangedElementIds[newIndex];

    this.selectElements([elementId]);
  }

  selectNextChange(): void {
    const allChangedElementIds = this.getAllChangedElementIds();

    if (allChangedElementIds.length === 0) {
      return;
    }

    const selectedElementId = this.getSelectedElementId();
    const currentChangeIndex = allChangedElementIds.indexOf(selectedElementId);

    const newIndex = currentChangeIndex < allChangedElementIds.length - 1 ? currentChangeIndex + 1 : 0;
    const elementId = allChangedElementIds[newIndex];

    this.selectElements([elementId]);
  }

  getChangesById(elementId: string): any[] {
    assertNotNull(this.bpmnDiff, 'this.bpmnDiff');

    return this.bpmnDiff.getChangesById(elementId);
  }

  getChangeSummary(): ChangeSummary | null {
    if (this.cachedChangeSummary != null) {
      return this.cachedChangeSummary;
    }
    if (this.bpmnDiff?.changes == null) {
      return null;
    }

    const changes = this.bpmnDiff.getChanges();
    return buildChangeSummary(rawDiffFromBpmnDiffBuckets(changes));
  }

  getCustomPropertiesForElement(elementId: string): CustomPropertyDelta[] {
    const summary = this.getChangeSummary();
    if (summary == null) {
      return [];
    }
    return lookupCustomPropertyChangesInSummary(summary, elementId);
  }

  getCallActivityExtensionChangesForElement(elementId: string): AttributeChange[] {
    const summary = this.getChangeSummary();
    if (summary == null) {
      return [];
    }
    return lookupCallActivityExtensionChangesInSummary(summary, elementId);
  }

  protected async initializeDiffViewers(beforeXml: string, afterXml: string): Promise<void> {
    this.bpmnDiff = new BpmnDiff(beforeXml, afterXml);

    let changes: BpmnDiffChangesByAction;
    try {
      changes = await this.bpmnDiff.diff();
    } catch {
      throw new Error('The two XMLs could not be compared. A document may have an invalid XML structure.');
    }

    assertNotNull(changes, 'changes');

    const rawDiff = rawDiffFromBpmnDiffBuckets(changes);
    try {
      this.cachedChangeSummary = await buildAugmentedChangeSummary(rawDiff, beforeXml, afterXml);
    } catch (augmentError) {
      console.warn('[bpmn-diff] Change summary augmentation failed:', augmentError);
      this.cachedChangeSummary = buildChangeSummary(rawDiff);
    }

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
        throw new Error(`BpmnDiffDocumentModel.create: Missing search param 'beforeUri' in: ${this.uri}`);
      }
      if (afterUri == null) {
        throw new Error(`BpmnDiffDocumentModel.create: Missing search param 'afterUri' in: ${this.uri}`);
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

      const beforeFileIsBpmn =
        this.bifrost.editors.hasDocumentTypeDefinitionForUri(beforeUri) &&
        this.bifrost.editors.getDocumentTypeDefinitionByUri(beforeUri)?.documentType === 'bpmn';
      if (!beforeFileIsBpmn) {
        const basename = this.bifrost.files.getLocalBasename(beforeUri);
        throw new Error(`The before file "${basename}" is not a BPMN file`);
      }

      const afterFileIsBpmn =
        this.bifrost.editors.hasDocumentTypeDefinitionForUri(afterUri) &&
        this.bifrost.editors.getDocumentTypeDefinitionByUri(afterUri)?.documentType === 'bpmn';
      if (!afterFileIsBpmn) {
        const basename = this.bifrost.files.getLocalBasename(afterUri);
        throw new Error(`The before file "${basename}" is not a BPMN file`);
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
    } catch (error) {
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

    this.bpmnViewerBefore.resetZoom();
  }

  selectElements(elementIds: string[]): void {
    const selectionViewerBefore = this.bpmnViewerBefore.getSelection();
    const elementRegistryViewerBefore = this.bpmnViewerBefore.getElementRegistry();
    const selectionViewerAfter = this.bpmnViewerAfter.getSelection();
    const elementRegistryViewerAfter = this.bpmnViewerAfter.getElementRegistry();

    const elementsWithOrigin = elementIds.map((elementId: string) => {
      const shapeFromViewerBefore = elementRegistryViewerBefore.get(elementId);
      const origin = shapeFromViewerBefore != null ? 'beforeViewer' : 'afterViewer';
      const shape = shapeFromViewerBefore != null ? shapeFromViewerBefore : elementRegistryViewerAfter.get(elementId);
      return {
        origin: origin,
        shape: shape,
      };
    });

    const shapesForViewerBefore = elementsWithOrigin
      .filter((elementWithOrigin) => elementWithOrigin.origin === 'beforeViewer')
      .map((shapeWithOrigin) => shapeWithOrigin.shape);
    const shapesForViewerAfter = elementsWithOrigin
      .filter((elementWithOrigin) => elementWithOrigin.origin === 'afterViewer')
      .map((shapeWithOrigin) => shapeWithOrigin.shape);

    if (shapesForViewerBefore.length !== 0) {
      selectionViewerBefore.select(shapesForViewerBefore);
    }

    if (shapesForViewerAfter.length !== 0) {
      selectionViewerAfter.select(shapesForViewerAfter);
    }
  }

  private getCurrentXml(uri: string): string {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null) {
      throw new Error(`BpmnDiffDocumentModel.create: Could not retrieve current data: ${uri}`);
    }
    const currentXml = editorDocument.data && editorDocument.data.current;
    if (currentXml == null || currentXml === false) {
      throw new Error(`BpmnDiffDocumentModel.create: Could not retrieve current xml: ${uri}`);
    }

    return currentXml;
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  getSelectedElements(): ElementLike[] {
    return [
      ...(this.bpmnViewerBefore?.getSelection().get() ?? []),
      ...(this.bpmnViewerAfter?.getSelection().get() ?? []),
    ];
  }

  getSelectedElementId(): string {
    let selectedElement = this.bpmnViewerBefore.getSelection().get()[0];

    if (selectedElement == null) {
      selectedElement = this.bpmnViewerAfter.getSelection().get()[0];
    }

    return selectedElement?.id;
  }

  protected getAllChangedElementIds(): string[] {
    assertNotNull(this.bpmnDiff, 'this.bpmnDiff');

    const fromDiff = [...this.bpmnDiff.getAllChangedElementIds()];
    const summary = this.cachedChangeSummary;
    if (summary == null) {
      return fromDiff;
    }

    const seen = new Set(fromDiff);
    for (const modified of summary.modified) {
      if ((modified.customPropertyChanges?.length ?? 0) > 0 && !seen.has(modified.id)) {
        seen.add(modified.id);
        fromDiff.push(modified.id);
      }
    }

    return fromDiff;
  }

  setZoom(percentage: number): void {
    this.bpmnViewerBefore.setZoom(percentage);
  }

  zoomToViewport(): void {
    this.bpmnViewerBefore.resetZoom();
  }

  async zoomToElements(elementIds: string[]): Promise<void> {
    try {
      const elementsInBefore = elementIds.filter((id) => this.bpmnViewerBefore?.getElementRegistry().get(id) != null);
      const elementsInAfter = elementIds.filter((id) => this.bpmnViewerAfter?.getElementRegistry().get(id) != null);

      if (elementsInBefore.length > 0) {
        await this.bpmnViewerBefore?.focusViewOnElements(elementsInBefore);
      }
      if (elementsInAfter.length > 0) {
        await this.bpmnViewerAfter?.focusViewOnElements(elementsInAfter);
      }
    } catch (error) {
      if (error.message.match(/(Could not get bounds|Cannot read property)/)) {
        error.message += ` (tried to zoom to elements with IDs '${elementIds.join(', ')}')`;
      }
      throw error;
    }
  }
}

/**
 * Applies overlays for a set of changes to a viewer.
 *
 * When a changed element has no canvas shape (e.g. `bpmn:Collaboration`),
 * falls back to overlaying its child Participant shapes instead, so that
 * Pool additions/removals are visually highlighted.
 */
function applyOverlays(
  viewer: BpmnViewerWithSync,
  changesById: BpmnDiffChangesById,
  modifier: string,
  cssClass: string,
): void {
  for (const id of Object.keys(changesById)) {
    const applied = viewer.addOverlay(id, modifier, cssClass);
    if (!applied && (changesById[id] as any)?.$type === 'bpmn:Collaboration') {
      const registry = viewer.getElementRegistry();
      const participants = registry.filter((el: any) => el.type === 'bpmn:Participant');
      for (const participant of participants) {
        viewer.addOverlay(participant.id, modifier, cssClass);
      }
    }
  }
}
