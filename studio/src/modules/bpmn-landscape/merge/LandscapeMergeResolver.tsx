import type {
  ConflictKey,
  ElementResolution,
  ElementResolutionStatus,
  MergeResolutionProgress,
  MergeResolverProps,
} from '#bifrost/contracts/MergeTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { Icon } from '#components/Icon';
import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React from 'react';

import '../../bpmn-core/diff/styles/component.bpmn-diff-infrastructure.scss';
import '../../bpmn-core/diff/styles/component.bpmn-merge.scss';
import type { LandscapeMap } from '../LandscapeMapFile';
import { createEmptyLandscapeMap, parseLandscapeMap, serializeLandscapeMap } from '../LandscapeMapFile';
import { RELATION_LINES_HINT } from '../diff/LandscapeDiffDocumentRenderer';
import { createLandscapeViewerConfig, LandscapeViewerWithSync } from '../diff/LandscapeViewerWithSync';
import type { LandscapeItemChange, LandscapeItemType, LandscapeMapDiff } from '../diff/landscapeMapDiff';
import { diffLandscapeMaps } from '../diff/landscapeMapDiff';
import '../styles/landscape-diff.scss';
import '../styles/landscape.scss';
import LandscapeMergeResultView from './LandscapeMergeResultView';
import type { LandscapeMergeResult } from './landscapeMergeEngine';
import { MAP_PROPERTIES_KEY, mergeLandscapeMaps } from './landscapeMergeEngine';

export type LandscapeClassifiedItem = {
  elementId: string;
  classification: 'ours-only' | 'theirs-only' | 'both';
  displayName: string;
  type: string;
  oursActions: string[];
  theirsActions: string[];
};

type MergeSides = { base: LandscapeMap; ours: LandscapeMap; theirs: LandscapeMap };

const TYPE_LABELS: Record<LandscapeItemType, string> = {
  band: 'Band',
  group: 'Group',
  process: 'Process',
  placeholder: 'Placeholder',
  mapLink: 'Map link',
  note: 'Note',
  connector: 'Connector',
  level: 'Level',
};

async function readMap(text: string | null): Promise<LandscapeMap | null> {
  if (text == null) {
    return null;
  }
  const result = await parseLandscapeMap(text);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
  return result.map;
}

type SideChange = { type: string; displayName: string; actions: string[] };

/** Item id → what one side changed. */
function changesById(diff: LandscapeMapDiff): Map<string, SideChange> {
  const byId = new Map<string, SideChange>();
  const buckets: [string, LandscapeItemChange[]][] = [
    ['added', diff.added],
    ['removed', diff.removed],
    ['updated', diff.modified],
    ['layoutChanged', diff.layoutChanged],
  ];
  for (const [action, changes] of buckets) {
    for (const change of changes) {
      const entry = byId.get(change.id) ?? {
        type: TYPE_LABELS[change.itemType],
        displayName: change.displayName,
        actions: [],
      };
      entry.actions.push(action);
      if (action === 'updated' && change.layoutChanged) {
        entry.actions.push('layoutChanged');
      }
      byId.set(change.id, entry);
    }
  }
  if (diff.mapProperties.length > 0) {
    byId.set(MAP_PROPERTIES_KEY, { type: 'Map', displayName: 'Map properties', actions: ['updated'] });
  }
  return byId;
}

function classifyItems(sides: MergeSides): LandscapeClassifiedItem[] {
  const ours = changesById(diffLandscapeMaps(sides.base, sides.ours));
  const theirs = changesById(diffLandscapeMaps(sides.base, sides.theirs));
  return [...new Set([...ours.keys(), ...theirs.keys()])].map((id) => {
    const oursEntry = ours.get(id);
    const theirsEntry = theirs.get(id);
    const { type, displayName } = (oursEntry ?? theirsEntry)!;
    let classification: LandscapeClassifiedItem['classification'] = 'both';
    if (theirsEntry == null) {
      classification = 'ours-only';
    } else if (oursEntry == null) {
      classification = 'theirs-only';
    }
    return {
      elementId: id,
      classification,
      displayName,
      type,
      oursActions: oursEntry?.actions ?? [],
      theirsActions: theirsEntry?.actions ?? [],
    };
  });
}

/**
 * Landscape map merge resolver: Ours and Theirs read-only maps on top, the merged result below.
 *
 * Resolutions name the Git side the user picked (`accepted-ours` is always the `ours` blob); the merge engine swaps
 * the sides on a rebase. Exposes the same imperative API on `resolverRef` as the BPMN and DMN resolvers.
 */
export default class LandscapeMergeResolver extends React.Component<
  MergeResolverProps,
  { loading: boolean; error: string | null }
> {
  private readonly refOurs = React.createRef<HTMLDivElement>();
  private readonly refTheirs = React.createRef<HTMLDivElement>();
  private readonly resultViewRef = React.createRef<LandscapeMergeResultView>();

  private readonly viewerOurs: LandscapeViewerWithSync;
  private readonly viewerTheirs: LandscapeViewerWithSync;
  private viewersSynced = false;
  private resultSyncWired = false;
  private isReady = false;
  private isUnmounted = false;

  private sides: MergeSides | null = null;
  private classifiedItems: LandscapeClassifiedItem[] = [];
  private resolutions = new Map<ConflictKey, ElementResolutionStatus>();
  private result: LandscapeMergeResult | null = null;
  private mergeRun = 0;
  private resultRefused = false;

  constructor(props: MergeResolverProps) {
    super(props);
    const config = createLandscapeViewerConfig(props.studio, props.entry.uri);
    this.viewerOurs = new LandscapeViewerWithSync(config);
    this.viewerTheirs = new LandscapeViewerWithSync(config);

    this.viewerOurs.on(EVENT_METADATA_UPDATED, ({ selectedElementIds }) => {
      if (selectedElementIds.length === 0 && this.viewerTheirs.getSelection().get().length !== 0) {
        this.viewerTheirs.selectWithoutSync();
      }
      this.forceUpdate();
    });
    this.viewerTheirs.on(EVENT_METADATA_UPDATED, ({ selectedElementIds }) => {
      if (selectedElementIds.length === 0 && this.viewerOurs.getSelection().get().length !== 0) {
        this.viewerOurs.selectWithoutSync();
      }
      this.forceUpdate();
    });

    this.state = { loading: true, error: null };
  }

  async componentDidMount(): Promise<void> {
    this.exposeImperativeApi();
    await this.loadAndAttach();
  }

  async componentDidUpdate(prevProps: MergeResolverProps): Promise<void> {
    const { blobs, entry } = this.props;
    if (
      prevProps.entry.relativePath !== entry.relativePath ||
      prevProps.blobs.base !== blobs.base ||
      prevProps.blobs.ours !== blobs.ours ||
      prevProps.blobs.theirs !== blobs.theirs
    ) {
      this.isReady = false;
      this.resultSyncWired = false;
      this.setState({ loading: true, error: null });
      await this.loadAndAttach();
    }
  }

  componentWillUnmount(): void {
    this.isUnmounted = true;
    this.props.resolverRef.current = null;
    this.viewerOurs.destroy();
    this.viewerTheirs.destroy();
  }

  private exposeImperativeApi(): void {
    this.props.resolverRef.current = {
      zoomToViewport: () => this.zoomToViewport(),
      zoomToActualSize: () => this.viewerOurs.setZoom(1),
      zoomToSelectedElement: () => this.zoomToSelectedElement(),
      selectNextConflict: () => this.selectConflict(1),
      selectPreviousConflict: () => this.selectConflict(-1),
      getCurrentConflictIndex: () => this.getCurrentConflictIndex(),
      selectElements: (ids: string[]) => this.selectElements(ids),
      getSelectedElements: () => this.getSelectedElements(),
      getClassifiedElements: () => this.getClassifiedElements(),

      acceptOursForElement: (elementId: string) => this.acceptForKey(elementId, 'accepted-ours'),
      acceptTheirsForElement: (elementId: string) => this.acceptForKey(elementId, 'accepted-theirs'),
      acceptOursForKey: (key: ConflictKey) => this.acceptForKey(key, 'accepted-ours'),
      acceptTheirsForKey: (key: ConflictKey) => this.acceptForKey(key, 'accepted-theirs'),
      revertAutoApplied: (elementId: string) => this.revertAutoApplied(elementId),
      reapplyAutoApplied: (elementId: string) => this.clearResolution(elementId, 'reverted'),
      undoConflictResolution: (key: ConflictKey) => this.undoConflictResolution(key),
      acceptAllOurs: () => this.acceptAllPending('accepted-ours'),
      acceptAllTheirs: () => this.acceptAllPending('accepted-theirs'),
      getResultXml: () => this.getResultXml(),
      wasResultRefused: () => this.resultRefused,
      isFullyResolved: () => this.getResolutionProgress().isComplete,
      getResolutionProgress: () => this.getResolutionProgress(),
      getResolutionStatus: (key: ConflictKey) => this.getResolutionStatus(key),
      getAllResolutions: () => this.getAllResolutions(),
      getConflictKeysForElement: (elementId: string) => (this.isConflict(elementId) ? [elementId] : []),
      getResultModelerApi: () => {
        const viewer = this.resultViewRef.current?.getViewer();
        return viewer == null ? null : { getViewer: () => viewer, zoomToViewport: () => viewer.zoomToViewport() };
      },
    };
  }

  private async loadAndAttach(): Promise<void> {
    const { blobs, conflictKind } = this.props;
    this.sides = null;
    this.classifiedItems = [];
    this.resolutions = new Map();
    this.result = null;

    let ours: LandscapeMap | null = null;
    let theirs: LandscapeMap | null = null;
    try {
      const [base, oursMap, theirsMap] = await Promise.all([
        readMap(blobs.base),
        readMap(blobs.ours),
        readMap(blobs.theirs),
      ]);
      ours = oursMap;
      theirs = theirsMap;
      if (conflictKind === 'content' && base != null && ours != null && theirs != null) {
        this.sides = { base, ours, theirs };
        this.classifiedItems = classifyItems(this.sides);
        this.result = await this.runMerge(this.sides);
      }
    } catch (error) {
      this.setState({ loading: false, error: error instanceof Error ? error.message : String(error) });
      this.props.onDataReady?.();
      return;
    }
    if (this.isUnmounted) {
      return;
    }

    this.setState({ loading: false }, () => {
      if (ours != null && this.refOurs.current != null) {
        this.viewerOurs.loadMap(ours);
        this.viewerOurs.attachTo(this.refOurs.current);
      }
      if (theirs != null && this.refTheirs.current != null) {
        this.viewerTheirs.loadMap(theirs);
        this.viewerTheirs.attachTo(this.refTheirs.current);
      }
      this.addSideOverlays();
      if (ours != null && theirs != null && !this.viewersSynced) {
        this.viewerOurs.addSelectionSync(this.viewerTheirs);
        this.viewerTheirs.addSelectionSync(this.viewerOurs);
        this.viewerOurs.addViewboxSync(this.viewerTheirs);
        this.viewerTheirs.addViewboxSync(this.viewerOurs);
        this.viewersSynced = true;
      }
      this.isReady = true;
      this.zoomToViewport();
      this.notifyResolutionChanged();
      this.props.onDataReady?.();
    });
  }

  private runMerge(sides: MergeSides): Promise<LandscapeMergeResult> {
    const isRebase = this.props.operationKind === 'rebase';
    return mergeLandscapeMaps(
      sides.base,
      isRebase ? sides.theirs : sides.ours,
      isRebase ? sides.ours : sides.theirs,
      new Map(this.resolutions),
      this.props.operationKind,
    );
  }

  private async remerge(): Promise<void> {
    if (this.sides == null) {
      return;
    }
    const run = ++this.mergeRun;
    const result = await this.runMerge(this.sides);
    if (run !== this.mergeRun || this.isUnmounted) {
      return;
    }
    this.result = result;
    this.viewerOurs.removeOverlays();
    this.viewerTheirs.removeOverlays();
    this.addSideOverlays();
    this.notifyResolutionChanged();
    this.forceUpdate();
  }

  private notifyResolutionChanged(): void {
    if (this.sides != null) {
      this.props.onResolutionChanged?.(this.getResolutionProgress());
    }
  }

  private addSideOverlays(): void {
    const conflicts = new Set(this.result?.conflicts ?? []);
    for (const key of conflicts) {
      this.viewerOurs.addOverlay(key, 'conflict', 'ph-duotone ph-warning');
      this.viewerTheirs.addOverlay(key, 'conflict', 'ph-duotone ph-warning');
    }
    for (const item of this.classifiedItems) {
      if (conflicts.has(item.elementId)) {
        continue;
      }
      if (item.oursActions.length > 0) {
        this.viewerOurs.addOverlay(item.elementId, 'ours', 'ph-duotone ph-pencil');
      }
      if (item.theirsActions.length > 0) {
        this.viewerTheirs.addOverlay(item.elementId, 'theirs', 'ph-duotone ph-pencil');
      }
    }
  }

  private isConflict(key: ConflictKey): boolean {
    return this.result?.conflicts.includes(key) ?? false;
  }

  private isAccepted(key: ConflictKey): boolean {
    const status = this.resolutions.get(key);
    return status === 'accepted-ours' || status === 'accepted-theirs';
  }

  private setResolutions(keys: ConflictKey[], status: ElementResolutionStatus): void {
    if (keys.length === 0) {
      return;
    }
    keys.forEach((key) => this.resolutions.set(key, status));
    void this.remerge();
  }

  private clearResolution(key: ConflictKey, status: ElementResolutionStatus): void {
    if (this.resolutions.get(key) === status) {
      this.resolutions.delete(key);
      void this.remerge();
    }
  }

  private acceptForKey(key: ConflictKey, status: 'accepted-ours' | 'accepted-theirs'): void {
    if (this.isConflict(key)) {
      this.setResolutions([key], status);
    }
  }

  private acceptAllPending(status: 'accepted-ours' | 'accepted-theirs'): void {
    this.setResolutions(
      (this.result?.conflicts ?? []).filter((key) => !this.isAccepted(key)),
      status,
    );
  }

  private revertAutoApplied(elementId: string): void {
    if (this.result?.autoApplied.includes(elementId)) {
      this.setResolutions([elementId], 'reverted');
    }
  }

  private undoConflictResolution(key: ConflictKey): void {
    if (this.isAccepted(key)) {
      this.resolutions.delete(key);
      void this.remerge();
    }
  }

  private async getResultXml(): Promise<string | null> {
    this.resultRefused = false;
    if (this.sides == null) {
      return null;
    }
    const result = await this.runMerge(this.sides);
    if (result.invalidReason != null) {
      this.resultRefused = true;
      this.props.studio.notifications.open({
        type: 'error',
        content: `The merged map cannot be written: ${result.invalidReason} Resolve the conflicts in the Merge Changes pane.`,
        source: 'Landscapes',
      });
      return null;
    }
    return serializeLandscapeMap(result.map);
  }

  private getResolutionProgress(): MergeResolutionProgress {
    const conflicts = this.result?.conflicts ?? [];
    const resolvedConflicts = conflicts.filter((key) => this.isAccepted(key)).length;
    return {
      totalConflicts: conflicts.length,
      resolvedConflicts,
      isComplete: conflicts.length > 0 && resolvedConflicts === conflicts.length && this.result?.invalidReason == null,
    };
  }

  private getResolutionStatus(key: ConflictKey): ElementResolutionStatus | null {
    if (this.isConflict(key)) {
      return this.isAccepted(key) ? this.resolutions.get(key)! : 'pending';
    }
    if (this.result?.autoApplied.includes(key)) {
      return 'auto-applied';
    }
    return this.resolutions.get(key) === 'reverted' ? 'reverted' : null;
  }

  private getAllResolutions(): ElementResolution[] {
    const keys = new Set([
      ...(this.result?.conflicts ?? []),
      ...(this.result?.autoApplied ?? []),
      ...this.resolutions.keys(),
    ]);
    return [...keys].flatMap((key) => {
      const status = this.getResolutionStatus(key);
      return status == null ? [] : [{ key, elementId: key, status }];
    });
  }

  /** The diff entries, with every conflict listed as changed on both sides, including ones only an invariant raised. */
  private getClassifiedElements(): LandscapeClassifiedItem[] {
    const conflicts = this.result?.conflicts ?? [];
    const known = new Set(this.classifiedItems.map((item) => item.elementId));
    const missing = [...conflicts, ...(this.result?.autoApplied ?? [])].filter((key) => !known.has(key));
    const isRebase = this.props.operationKind === 'rebase';
    return [
      ...this.classifiedItems.map((item) =>
        conflicts.includes(item.elementId) ? { ...item, classification: 'both' as const } : item,
      ),
      ...[...new Set(missing)].map((key) => {
        let classification: LandscapeClassifiedItem['classification'] = isRebase ? 'ours-only' : 'theirs-only';
        if (conflicts.includes(key)) {
          classification = 'both';
        }
        // Every item of a side is "added" against an empty map, which gives it the name and type the diff uses.
        const described = [this.sides?.ours, this.sides?.theirs, this.sides?.base]
          .flatMap((side) => (side == null ? [] : diffLandscapeMaps(createEmptyLandscapeMap(''), side).added))
          .find((item) => item.id === key);
        return {
          elementId: key,
          classification,
          displayName: described?.displayName ?? key,
          type: described == null ? 'Item' : TYPE_LABELS[described.itemType],
          oursActions: [],
          theirsActions: [],
        };
      }),
    ];
  }

  private getConflictKeys(): ConflictKey[] {
    return this.result?.conflicts ?? [];
  }

  private zoomToViewport(): void {
    if (!this.isReady) {
      return;
    }
    this.viewerOurs.zoomToViewport();
    this.viewerTheirs.zoomToViewport();
    this.resultViewRef.current?.getViewer().zoomToViewport();
  }

  private zoomToSelectedElement(): void {
    const elementIds = this.getSelectedElements();
    for (const viewer of [this.viewerOurs, this.viewerTheirs]) {
      const present = elementIds.filter((id) => viewer.getElementRegistry().get(id) != null);
      if (present.length > 0) {
        void viewer.focusViewOnElements(present);
      }
    }
  }

  private selectElements(elementIds: string[]): void {
    const resultViewer = this.resultViewRef.current?.getViewer();
    for (const viewer of [this.viewerOurs, this.viewerTheirs, resultViewer]) {
      const shapes = viewer == null ? [] : elementIds.map((id) => viewer.getElementRegistry().get(id)).filter(Boolean);
      if (viewer != null && shapes.length > 0) {
        viewer.getSelection().select(shapes);
      }
    }
  }

  private getSelectedElements(): string[] {
    const selected = [...this.viewerOurs.getSelection().get(), ...this.viewerTheirs.getSelection().get()];
    return [...new Set(selected.map((element) => element.id))];
  }

  private getSelectedElementId(): string | undefined {
    return (this.viewerOurs.getSelection().get()[0] ?? this.viewerTheirs.getSelection().get()[0])?.id;
  }

  private selectConflict(step: 1 | -1): void {
    const conflicts = this.getConflictKeys();
    if (conflicts.length === 0) {
      return;
    }
    const currentIndex = conflicts.indexOf(this.getSelectedElementId() ?? '');
    let nextIndex = (currentIndex + step + conflicts.length) % conflicts.length;
    if (currentIndex === -1) {
      nextIndex = step === 1 ? 0 : conflicts.length - 1;
    }
    this.selectElements([conflicts[nextIndex]]);
  }

  private getCurrentConflictIndex(): { current: number | null; total: number } {
    const conflicts = this.getConflictKeys();
    const currentIndex = conflicts.indexOf(this.getSelectedElementId() ?? '');
    return { current: currentIndex === -1 ? null : currentIndex + 1, total: conflicts.length };
  }

  private handleResultViewReady = (): void => {
    const resultViewer = this.resultViewRef.current?.getViewer();
    // The result follows both sides; a two-way sync with the already linked sides would bounce viewboxes around.
    if (!this.resultSyncWired && resultViewer != null) {
      resultViewer.addViewboxSync(this.viewerOurs);
      resultViewer.addViewboxSync(this.viewerTheirs);
      this.resultSyncWired = true;
    }
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

    if (this.state.error != null) {
      return (
        <div className="bpmn-merge__deleted-placeholder" data-test--landscape-merge-error>
          <Icon id="ph-duotone ph-warning" />
          <p>This landscape map cannot be read:</p>
          <pre>{this.state.error}</pre>
        </div>
      );
    }

    const { conflictKind, operationKind } = this.props;
    const isRebase = operationKind === 'rebase';
    const oursLabel = isRebase ? 'Theirs (base branch)' : 'Ours (current branch)';
    const theirsLabel = isRebase ? 'Ours (current branch)' : 'Theirs (incoming branch)';

    const viewersPanel = (
      <SplitterLayout
        customClassName="splitter-layout--bpmn-merge"
        percentage={true}
        secondaryInitialSize={50}
        primaryMinSize={10}
        secondaryMinSize={10}
      >
        <div className="bpmn-merge__ours" data-test--landscape-merge-ours>
          {conflictKind === 'ours-deleted' ? (
            <div className="bpmn-merge__deleted-placeholder">
              <Icon id="ph-duotone ph-trash" />
              <p>This file was deleted on your branch.</p>
            </div>
          ) : (
            <>
              <div className="diff-title diff-title--ours">{oursLabel}</div>
              <div ref={this.refOurs} className="bpmn-merge__viewer landscape-diff__canvas" />
            </>
          )}
        </div>
        <div className="bpmn-merge__theirs" data-test--landscape-merge-theirs>
          {conflictKind === 'theirs-deleted' ? (
            <div className="bpmn-merge__deleted-placeholder">
              <Icon id="ph-duotone ph-trash" />
              <p>This file was deleted on the incoming branch.</p>
            </div>
          ) : (
            <>
              <div className="diff-title diff-title--theirs">{theirsLabel}</div>
              <div ref={this.refTheirs} className="bpmn-merge__viewer landscape-diff__canvas" />
            </>
          )}
        </div>
      </SplitterLayout>
    );

    const relationHint = (
      <div className="editor__hint landscape-diff__relation-hint" data-test--landscape-merge-relation-hint>
        {RELATION_LINES_HINT}
      </div>
    );

    if (this.result == null) {
      return (
        <>
          {relationHint}
          {viewersPanel}
        </>
      );
    }

    return (
      <>
        {relationHint}
        <SplitterLayout
          customClassName="splitter-layout--bpmn-merge-vertical"
          vertical={true}
          percentage={true}
          secondaryInitialSize={45}
          primaryMinSize={15}
          secondaryMinSize={15}
        >
          {viewersPanel}
          <div className="bpmn-merge__result" data-test--landscape-merge-result>
            <div className="diff-title diff-title--result">Result</div>
            <LandscapeMergeResultView
              ref={this.resultViewRef}
              studio={this.props.studio}
              mapUri={this.props.entry.uri}
              result={this.result}
              resolutions={this.getAllResolutions()}
              onReady={this.handleResultViewReady}
            />
          </div>
        </SplitterLayout>
      </>
    );
  }
}
