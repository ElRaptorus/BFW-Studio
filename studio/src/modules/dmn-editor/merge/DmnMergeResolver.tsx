import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React from 'react';

import type {
  ElementResolution,
  ElementResolutionStatus,
  MergeResolutionProgress,
  MergeResolverProps,
} from '@evil/bifrost_fw_sdk';
import { Icon, assertNotNull } from '@evil/bifrost_fw_sdk';

import { EVENT_METADATA_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import '../../bpmn-core/diff/styles/component.bpmn-diff-infrastructure.scss';
import '../../bpmn-editor/merge/styles/component.bpmn-merge.scss';
import { DmnDiff, type DmnDiffChange, type DmnDiffChangesByAction, DmnViewerWithSync } from '../../dmn-core/diff';
import DmnMergeResultModeler, { type DmnClassifiedElement } from './DmnMergeResultModeler';

export type DmnMergeElementClassification = 'ours-only' | 'theirs-only' | 'both';

/**
 * DMN-specific merge resolver component.
 *
 * Three-panel layout:
 * - Top-left:  Ours viewer (read-only)
 * - Top-right: Theirs viewer (read-only)
 * - Bottom:    Result modeler (read-only preview with per-element resolution)
 *
 * Exposes an imperative API via `resolverRef` for commands to interact with:
 * zoom, conflict navigation, element selection, per-element resolution, etc.
 */
export default class DmnMergeResolver extends React.Component<MergeResolverProps, { loading: boolean }> {
  private refOurs: React.RefObject<HTMLDivElement | null>;
  private refTheirs: React.RefObject<HTMLDivElement | null>;
  private resultModelerRef: React.RefObject<DmnMergeResultModeler | null>;

  private viewerOurs: DmnViewerWithSync;
  private viewerTheirs: DmnViewerWithSync;
  private viewersSynced = false;

  public classifiedElements: DmnClassifiedElement[] = [];
  public diffBaseOurs: DmnDiff | null = null;
  public diffBaseTheirs: DmnDiff | null = null;

  private applySideChanges: DmnDiffChangesByAction | null = null;
  private isReady = false;
  private resultSyncWired = false;

  constructor(props: MergeResolverProps) {
    super(props);
    this.refOurs = React.createRef();
    this.refTheirs = React.createRef();
    this.resultModelerRef = React.createRef();

    this.viewerOurs = new DmnViewerWithSync();
    this.viewerTheirs = new DmnViewerWithSync();

    this.viewerOurs.on(EVENT_METADATA_UPDATED, (partialMetadata) => {
      const { selectedElementIds } = partialMetadata;
      const theirsSelection = this.viewerTheirs.getSelection();
      if (selectedElementIds.length === 0 && theirsSelection != null && theirsSelection.get().length !== 0) {
        this.viewerTheirs.selectWithoutSync();
      }
      this.forceUpdate();
    });
    this.viewerTheirs.on(EVENT_METADATA_UPDATED, (partialMetadata) => {
      const { selectedElementIds } = partialMetadata;
      const oursSelection = this.viewerOurs.getSelection();
      if (selectedElementIds.length === 0 && oursSelection != null && oursSelection.get().length !== 0) {
        this.viewerOurs.selectWithoutSync();
      }
      this.forceUpdate();
    });

    this.state = { loading: true };
  }

  async componentDidMount(): Promise<void> {
    this.exposeImperativeApi();
    await this.loadAndAttach();
  }

  async componentDidUpdate(prevProps: MergeResolverProps): Promise<void> {
    const pathChanged = prevProps.entry.relativePath !== this.props.entry.relativePath;
    const blobsChanged =
      prevProps.blobs.base !== this.props.blobs.base ||
      prevProps.blobs.ours !== this.props.blobs.ours ||
      prevProps.blobs.theirs !== this.props.blobs.theirs;

    if (pathChanged || blobsChanged) {
      this.isReady = false;
      this.resultSyncWired = false;
      this.setState({ loading: true });
      await this.loadAndAttach();
    }
  }

  componentWillUnmount(): void {
    this.props.resolverRef.current = null;
  }

  private get isRebase(): boolean {
    return this.props.operationKind === 'rebase';
  }

  private get startingSideXml(): string | null {
    return this.isRebase ? this.props.blobs.theirs : this.props.blobs.ours;
  }

  private get applySideXml(): string | null {
    return this.isRebase ? this.props.blobs.ours : this.props.blobs.theirs;
  }

  private exposeImperativeApi(): void {
    this.props.resolverRef.current = {
      zoomToViewport: () => this.zoomToViewport(),
      zoomToActualSize: () => this.setZoom(1),
      zoomToSelectedElement: () => this.zoomToSelectedElement(),
      selectNextConflict: () => this.selectNextConflict(),
      selectPreviousConflict: () => this.selectPreviousConflict(),
      getCurrentConflictIndex: () => this.getCurrentConflictIndex(),
      selectElements: (ids: string[]) => this.selectElements(ids),
      getSelectedElements: () => this.getSelectedElements(),
      getClassifiedElements: () => this.classifiedElements,

      acceptOursForElement: (elementId: string) => this.acceptOursForElement(elementId),
      acceptTheirsForElement: (elementId: string) => this.acceptTheirsForElement(elementId),
      acceptOursForKey: (key: string) => this.acceptOursForKey(key),
      acceptTheirsForKey: (key: string) => this.acceptTheirsForKey(key),
      revertAutoApplied: (elementId: string) => this.revertAutoApplied(elementId),
      reapplyAutoApplied: (elementId: string) => this.reapplyAutoApplied(elementId),
      undoConflictResolution: (key: string) => this.undoConflictResolution(key),
      acceptAllOurs: () => this.acceptAllPending('ours'),
      acceptAllTheirs: () => this.acceptAllPending('theirs'),
      getResultXml: () => this.getResultXml(),
      isFullyResolved: () => this.isFullyResolved(),
      getResolutionProgress: () => this.getResolutionProgress(),
      getResolutionStatus: (key: string) => this.getResolutionStatus(key),
      getAllResolutions: () => this.getAllResolutions(),
      getConflictKeysForElement: (elementId: string) => this.getConflictKeysForElement(elementId),
      getResultModelerApi: () => this.resultModelerRef.current?.getApi() ?? null,
    };
  }

  private async loadAndAttach(): Promise<void> {
    const { blobs, conflictKind } = this.props;

    if (conflictKind === 'content' && blobs.base != null) {
      await this.computeDiffs();
    } else {
      this.classifiedElements = [];
      this.diffBaseOurs = null;
      this.diffBaseTheirs = null;
      this.applySideChanges = null;
    }

    this.setState({ loading: false }, async () => {
      if (conflictKind !== 'content') {
        if (blobs.ours != null && this.refOurs.current) {
          await this.viewerOurs.loadXml(blobs.ours);
          this.viewerOurs.attachTo(this.refOurs.current);
        }
        if (blobs.theirs != null && this.refTheirs.current) {
          await this.viewerTheirs.loadXml(blobs.theirs);
          this.viewerTheirs.attachTo(this.refTheirs.current);
        }
        if (blobs.ours != null && blobs.theirs != null && !this.viewersSynced) {
          this.viewerOurs.addSelectionSync(this.viewerTheirs);
          this.viewerTheirs.addSelectionSync(this.viewerOurs);
          this.viewerOurs.addViewboxSync(this.viewerTheirs);
          this.viewerTheirs.addViewboxSync(this.viewerOurs);
          this.viewersSynced = true;
        }
        this.isReady = true;
        this.zoomToViewport();
        this.props.onDataReady?.();
        return;
      }

      assertNotNull(blobs.ours, 'blobs.ours');
      assertNotNull(blobs.theirs, 'blobs.theirs');

      await this.viewerOurs.loadXml(blobs.ours);
      await this.viewerTheirs.loadXml(blobs.theirs);

      for (const classified of this.classifiedElements) {
        const { elementId, classification } = classified;
        if (classification === 'ours-only') {
          this.viewerOurs.addOverlay(elementId, 'ours', 'ph-duotone ph-pencil');
        } else if (classification === 'theirs-only') {
          this.viewerTheirs.addOverlay(elementId, 'theirs', 'ph-duotone ph-pencil');
        } else if (classification === 'both') {
          this.viewerOurs.addOverlay(elementId, 'conflict', 'ph-duotone ph-warning');
          this.viewerTheirs.addOverlay(elementId, 'conflict', 'ph-duotone ph-warning');
        }
      }

      if (this.refOurs.current) {
        this.viewerOurs.attachTo(this.refOurs.current);
      }
      if (this.refTheirs.current) {
        this.viewerTheirs.attachTo(this.refTheirs.current);
      }

      if (!this.viewersSynced) {
        this.viewerOurs.addSelectionSync(this.viewerTheirs);
        this.viewerTheirs.addSelectionSync(this.viewerOurs);
        this.viewerOurs.addViewboxSync(this.viewerTheirs);
        this.viewerTheirs.addViewboxSync(this.viewerOurs);
        this.viewersSynced = true;
      }

      this.isReady = true;
      this.zoomToViewport();
      this.props.onDataReady?.();
    });
  }

  private async computeDiffs(): Promise<void> {
    const { blobs } = this.props;

    if (blobs.base == null || blobs.ours == null || blobs.theirs == null) {
      this.classifiedElements = [];
      this.applySideChanges = null;
      return;
    }

    this.diffBaseOurs = new DmnDiff(blobs.base, blobs.ours);
    this.diffBaseTheirs = new DmnDiff(blobs.base, blobs.theirs);

    let changesOurs: DmnDiffChangesByAction;
    let changesTheirs: DmnDiffChangesByAction;

    try {
      [changesOurs, changesTheirs] = await Promise.all([this.diffBaseOurs.diff(), this.diffBaseTheirs.diff()]);
    } catch {
      this.classifiedElements = [];
      this.applySideChanges = null;
      return;
    }

    this.applySideChanges = this.isRebase ? changesOurs : changesTheirs;
    this.classifiedElements = this.classifyElements(changesOurs, changesTheirs);
  }

  private classifyElements(
    oursChanges: DmnDiffChangesByAction,
    theirsChanges: DmnDiffChangesByAction,
  ): DmnClassifiedElement[] {
    const oursBySide = this.collectSideEntries(oursChanges);
    const theirsBySide = this.collectSideEntries(theirsChanges);

    const allIds = new Set([...oursBySide.keys(), ...theirsBySide.keys()]);
    const result: DmnClassifiedElement[] = [];

    for (const elementId of allIds) {
      const oursEntries = oursBySide.get(elementId) ?? null;
      const theirsEntries = theirsBySide.get(elementId) ?? null;

      const inOurs = oursEntries != null;
      const inTheirs = theirsEntries != null;

      let classification: DmnMergeElementClassification;
      if (inOurs && inTheirs) {
        classification = 'both';
      } else if (inOurs) {
        classification = 'ours-only';
      } else {
        classification = 'theirs-only';
      }

      const representativeEntry = oursEntries?.[0] ?? theirsEntries?.[0];
      const { displayName, type } = this.resolveElementDisplay(elementId, representativeEntry);

      result.push({
        elementId,
        classification,
        displayName,
        type,
        oursActions: oursEntries ? this.collectActions(oursEntries) : [],
        theirsActions: theirsEntries ? this.collectActions(theirsEntries) : [],
      });
    }

    return result;
  }

  private collectSideEntries(changes: DmnDiffChangesByAction): Map<string, DmnDiffChange[]> {
    const map = new Map<string, DmnDiffChange[]>();
    for (const bucket of [changes.added, changes.removed, changes.updated, changes.layoutChanged]) {
      for (const [id, entries] of Object.entries(bucket)) {
        const list = map.get(id) ?? [];
        list.push(...entries);
        map.set(id, list);
      }
    }
    return map;
  }

  private resolveElementDisplay(
    elementId: string,
    entry: DmnDiffChange | undefined,
  ): { displayName: string; type: string } {
    if (entry == null) {
      return { displayName: elementId, type: 'Element' };
    }

    const model = entry.change?.model ?? entry.change ?? entry;
    const rawType = model.$type ?? entry.$type ?? 'dmn:Element';
    const type = rawType.replace(/^dmn:/, '');
    const name = model.name;
    const displayName = name != null && name !== '' ? name : elementId;

    return { displayName, type };
  }

  private collectActions(entries: DmnDiffChange[]): string[] {
    const actions: string[] = [];
    for (const entry of entries) {
      const action = entry.action;
      if (!actions.includes(action)) {
        actions.push(action);
      }
    }
    return actions;
  }

  acceptOursForElement(elementId: string): void {
    const resultModeler = this.resultModelerRef.current;
    if (resultModeler == null) {
      return;
    }
    if (this.isRebase) {
      resultModeler.acceptApplySideForElement(elementId);
    } else {
      resultModeler.acceptStartingSideForElement(elementId);
    }
  }

  acceptTheirsForElement(elementId: string): void {
    const resultModeler = this.resultModelerRef.current;
    if (resultModeler == null) {
      return;
    }
    if (this.isRebase) {
      resultModeler.acceptStartingSideForElement(elementId);
    } else {
      resultModeler.acceptApplySideForElement(elementId);
    }
  }

  acceptOursForKey(key: string): void {
    const resultApi = this.resultModelerRef.current?.getApi();
    if (resultApi == null) {
      return;
    }
    if (this.isRebase) {
      resultApi.acceptApplySideForKey(key);
    } else {
      resultApi.acceptStartingSideForKey(key);
    }
  }

  acceptTheirsForKey(key: string): void {
    const resultApi = this.resultModelerRef.current?.getApi();
    if (resultApi == null) {
      return;
    }
    if (this.isRebase) {
      resultApi.acceptStartingSideForKey(key);
    } else {
      resultApi.acceptApplySideForKey(key);
    }
  }

  acceptAllPending(side: 'ours' | 'theirs'): void {
    const resultModeler = this.resultModelerRef.current;
    if (resultModeler == null) {
      return;
    }
    if (side === 'ours') {
      if (this.isRebase) {
        resultModeler.acceptAllApplySide();
      } else {
        resultModeler.acceptAllStartingSide();
      }
    } else {
      if (this.isRebase) {
        resultModeler.acceptAllStartingSide();
      } else {
        resultModeler.acceptAllApplySide();
      }
    }
  }

  async getResultXml(): Promise<string | null> {
    if (this.resultModelerRef.current == null) {
      return null;
    }
    return this.resultModelerRef.current.getResultXml();
  }

  isFullyResolved(): boolean {
    return this.resultModelerRef.current?.isFullyResolved() ?? false;
  }

  getResolutionProgress(): MergeResolutionProgress {
    return (
      this.resultModelerRef.current?.getResolutionProgress() ?? {
        totalConflicts: 0,
        resolvedConflicts: 0,
        isComplete: false,
      }
    );
  }

  getResolutionStatus(key: string): ElementResolutionStatus | null {
    return this.resultModelerRef.current?.getApi().getResolutionStatus(key) ?? null;
  }

  getAllResolutions(): ElementResolution[] {
    return this.resultModelerRef.current?.getAllResolutions() ?? [];
  }

  getConflictKeysForElement(elementId: string): string[] {
    return this.resultModelerRef.current?.getApi().getConflictKeysForElement(elementId) ?? [];
  }

  revertAutoApplied(elementId: string): void {
    this.resultModelerRef.current?.revertAutoApplied(elementId);
  }

  reapplyAutoApplied(elementId: string): void {
    this.resultModelerRef.current?.reapplyAutoApplied(elementId);
  }

  undoConflictResolution(key: string): void {
    this.resultModelerRef.current?.undoConflictResolution(key);
  }

  zoomToViewport(): void {
    if (!this.isReady) {
      return;
    }
    this.viewerOurs.zoomToViewport();
    this.viewerTheirs.zoomToViewport();
    this.resultModelerRef.current?.getApi().zoomToViewport();
  }

  setZoom(percentage: number): void {
    this.viewerOurs.setZoom(percentage);
  }

  zoomToSelectedElement(): void {
    const elements = this.getSelectedElements();
    if (elements.length > 0) {
      void this.zoomToElements(elements);
    }
  }

  selectElements(elementIds: string[]): void {
    const registryOurs = this.viewerOurs.getElementRegistry();
    const registryTheirs = this.viewerTheirs.getElementRegistry();
    const selectionOurs = this.viewerOurs.getSelection();
    const selectionTheirs = this.viewerTheirs.getSelection();

    if (registryOurs != null && selectionOurs != null) {
      const shapesOurs = elementIds.map((id) => registryOurs.get(id)).filter(Boolean);
      if (shapesOurs.length > 0) {
        selectionOurs.select(shapesOurs);
      }
    }
    if (registryTheirs != null && selectionTheirs != null) {
      const shapesTheirs = elementIds.map((id) => registryTheirs.get(id)).filter(Boolean);
      if (shapesTheirs.length > 0) {
        selectionTheirs.select(shapesTheirs);
      }
    }

    const resultApi = this.resultModelerRef.current?.getApi();
    if (resultApi != null) {
      const resultRegistry = resultApi.getElementRegistry();
      const resultSelection = resultApi.getSelection();
      if (resultRegistry && resultSelection) {
        const shapesResult = elementIds.map((id) => resultRegistry.get(id)).filter(Boolean);
        if (shapesResult.length > 0) {
          resultSelection.select(shapesResult);
        }
      }
    }
  }

  selectNextConflict(): void {
    const conflicts = this.getConflictElements();
    if (conflicts.length === 0) {
      return;
    }

    const selectedId = this.getSelectedElementId();
    const currentIndex = conflicts.findIndex((element) => element.elementId === selectedId);
    const nextIndex = currentIndex < conflicts.length - 1 ? currentIndex + 1 : 0;
    this.selectElements([conflicts[nextIndex].elementId]);
  }

  selectPreviousConflict(): void {
    const conflicts = this.getConflictElements();
    if (conflicts.length === 0) {
      return;
    }

    const selectedId = this.getSelectedElementId();
    const currentIndex = conflicts.findIndex((element) => element.elementId === selectedId);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : conflicts.length - 1;
    this.selectElements([conflicts[previousIndex].elementId]);
  }

  getCurrentConflictIndex(): { current: number | null; total: number } {
    const conflicts = this.getConflictElements();
    const selectedId = this.getSelectedElementId();
    const currentIndex = conflicts.findIndex((element) => element.elementId === selectedId);
    return {
      current: currentIndex === -1 ? null : currentIndex + 1,
      total: conflicts.length,
    };
  }

  getConflictElements(): DmnClassifiedElement[] {
    return this.classifiedElements.filter((element) => element.classification === 'both');
  }

  getSelectedElements(): string[] {
    const oursSelection = this.viewerOurs.getSelection()?.get() ?? [];
    const theirsSelection = this.viewerTheirs.getSelection()?.get() ?? [];
    return [...oursSelection, ...theirsSelection].map((element) => element.id);
  }

  async zoomToElements(elementIds: string[]): Promise<void> {
    const registryOurs = this.viewerOurs.getElementRegistry();
    const registryTheirs = this.viewerTheirs.getElementRegistry();
    const oursIds = registryOurs != null ? elementIds.filter((id) => registryOurs.get(id) != null) : [];
    const theirsIds = registryTheirs != null ? elementIds.filter((id) => registryTheirs.get(id) != null) : [];

    if (oursIds.length > 0) {
      await this.viewerOurs.focusViewOnElements(oursIds);
    }
    if (theirsIds.length > 0) {
      await this.viewerTheirs.focusViewOnElements(theirsIds);
    }
  }

  private getSelectedElementId(): string | undefined {
    let selected = this.viewerOurs.getSelection()?.get()[0];
    if (selected == null) {
      selected = this.viewerTheirs.getSelection()?.get()[0];
    }
    return selected?.id;
  }

  private handleResultModelerReady = (): void => {
    this.wireResultModelerSync();
    this.props.onDataReady?.();
  };

  private wireResultModelerSync(): void {
    if (this.resultSyncWired) {
      return;
    }
    const resultViewer = this.resultModelerRef.current?.getApi().getViewer();
    if (resultViewer == null) {
      return;
    }

    this.viewerOurs.addViewboxSync(resultViewer);
    this.resultSyncWired = true;
  }

  private handleResolutionChanged = (progress: MergeResolutionProgress): void => {
    this.props.onResolutionChanged?.(progress);
    this.forceUpdate();
  };

  render(): React.JSX.Element {
    if (this.state.loading) {
      return (
        <div className="editor-loading__backdrop">
          <div className="editor-loading__content ph-3x">
            <Icon id="ph-light ph-gear ph-spin" />
          </div>
        </div>
      );
    }

    const { conflictKind } = this.props;
    const isOursDeleted = conflictKind === 'ours-deleted';
    const isTheirsDeleted = conflictKind === 'theirs-deleted';
    const isContent = conflictKind === 'content';

    const oursLabel = this.isRebase ? 'Theirs (base branch)' : 'Ours (current branch)';
    const theirsLabel = this.isRebase ? 'Ours (current branch)' : 'Theirs (incoming branch)';

    const viewersPanel = (
      <SplitterLayout
        customClassName="splitter-layout--bpmn-merge"
        percentage={true}
        secondaryInitialSize={50}
        primaryMinSize={10}
        secondaryMinSize={10}
      >
        <div className="bpmn-merge__ours" data-test--dmn-merge-ours>
          {isOursDeleted ? (
            <div className="bpmn-merge__deleted-placeholder">
              <Icon id="ph-duotone ph-trash" />
              <p>This file was deleted on your branch.</p>
            </div>
          ) : (
            <>
              <div className="diff-title diff-title--ours">{oursLabel}</div>
              <div ref={this.refOurs} className="bpmn-merge__viewer" />
            </>
          )}
        </div>
        <div className="bpmn-merge__theirs" data-test--dmn-merge-theirs>
          {isTheirsDeleted ? (
            <div className="bpmn-merge__deleted-placeholder">
              <Icon id="ph-duotone ph-trash" />
              <p>This file was deleted on the incoming branch.</p>
            </div>
          ) : (
            <>
              <div className="diff-title diff-title--theirs">{theirsLabel}</div>
              <div ref={this.refTheirs} className="bpmn-merge__viewer" />
            </>
          )}
        </div>
      </SplitterLayout>
    );

    if (!isContent || this.startingSideXml == null || this.applySideXml == null) {
      return viewersPanel;
    }

    return (
      <SplitterLayout
        customClassName="splitter-layout--bpmn-merge-vertical"
        vertical={true}
        percentage={true}
        secondaryInitialSize={45}
        primaryMinSize={15}
        secondaryMinSize={15}
      >
        {viewersPanel}
        <div className="bpmn-merge__result" data-test--dmn-merge-result>
          <div className="diff-title diff-title--result">Result</div>
          <DmnMergeResultModeler
            ref={this.resultModelerRef}
            studio={this.props.studio}
            startingSideXml={this.startingSideXml}
            applySideXml={this.applySideXml}
            applySideChanges={this.applySideChanges}
            classifiedElements={this.classifiedElements}
            operationKind={this.props.operationKind}
            onResolutionChanged={this.handleResolutionChanged}
            onReady={this.handleResultModelerReady}
          />
        </div>
      </SplitterLayout>
    );
  }
}
