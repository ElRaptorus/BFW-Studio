import type {
  ConflictKey,
  ElementResolution,
  ElementResolutionStatus,
  MergeOperationKind,
  MergeResolutionProgress,
} from '#bifrost/contracts/MergeTypes';

import React from 'react';

import type { DmnDiffChangesByAction } from '../../dmn-core/diff';
import { DmnViewerWithSync } from '../../dmn-core/diff';
import { type ResolutionMap, dmnXmlMergeEngine } from './dmnXmlMergeEngine';

export type DmnClassifiedElement = {
  elementId: string;
  classification: 'ours-only' | 'theirs-only' | 'both';
  displayName: string;
  type: string;
  oursActions: string[];
  theirsActions: string[];
};

export type ResultModelerApi = {
  acceptStartingSideForKey: (key: ConflictKey) => void;
  acceptApplySideForKey: (key: ConflictKey) => void;
  acceptStartingSideForElement: (elementId: string) => void;
  acceptApplySideForElement: (elementId: string) => void;
  revertAutoApplied: (elementId: string) => void;
  reapplyAutoApplied: (elementId: string) => void;
  undoConflictResolution: (key: ConflictKey) => void;
  getResultXml: () => Promise<string>;
  isFullyResolved: () => boolean;
  getResolutionProgress: () => MergeResolutionProgress;
  getResolutionStatus: (key: ConflictKey) => ElementResolutionStatus | null;
  getAllResolutions: () => ElementResolution[];
  getConflictKeysForElement: (elementId: string) => ConflictKey[];
  zoomToViewport: () => void;
  getElementRegistry: () => any;
  getSelection: () => any;
  getCanvas: () => any;
  getOverlays: () => any;
  getViewer: () => DmnViewerWithSync | null;
};

type DmnMergeResultModelerProps = {
  studio: any;
  startingSideXml: string;
  applySideXml: string;
  applySideChanges: DmnDiffChangesByAction | null;
  classifiedElements: DmnClassifiedElement[];
  operationKind: MergeOperationKind;
  onResolutionChanged?: (progress: MergeResolutionProgress) => void;
  onReady?: () => void;
};

type DmnMergeResultModelerState = {
  loading: boolean;
};

/**
 * Read-only result preview for the DMN merge editor.
 *
 * Uses the XML-level merge engine (`dmnXmlMergeEngine`) both for initial
 * auto-apply AND for every subsequent conflict resolution. When the user
 * accepts ours/theirs for a conflict, the engine re-runs with an adjusted
 * skip set and the viewer is refreshed with the rebuilt XML.
 *
 * Resolution is tracked at the **element ID** level (no custom properties).
 */
export default class DmnMergeResultModeler extends React.Component<
  DmnMergeResultModelerProps,
  DmnMergeResultModelerState
> {
  private containerRef: React.RefObject<HTMLDivElement | null>;
  private viewer: DmnViewerWithSync | null = null;
  private resolutionMap: ResolutionMap = new Map();
  private isInitialized = false;

  /** Element IDs that were auto-applied during the initial merge. */
  private initialAutoAppliedIds = new Set<string>();

  constructor(props: DmnMergeResultModelerProps) {
    super(props);
    this.containerRef = React.createRef();
    this.state = { loading: true };
  }

  async componentDidMount(): Promise<void> {
    await this.initialize();
  }

  async componentDidUpdate(prevProps: DmnMergeResultModelerProps): Promise<void> {
    if (prevProps.startingSideXml !== this.props.startingSideXml) {
      this.isInitialized = false;
      this.setState({ loading: true });
      await this.initialize();
    }
  }

  componentWillUnmount(): void {
    this.dispose();
  }

  private async initialize(): Promise<void> {
    this.dispose();
    this.resolutionMap = new Map();
    this.initialAutoAppliedIds = new Set();

    const conflictIds = new Set(
      this.props.classifiedElements
        .filter((element) => element.classification === 'both')
        .map((element) => element.elementId),
    );

    let mergedXml = this.props.startingSideXml;

    if (this.props.applySideChanges != null) {
      const result = dmnXmlMergeEngine(
        this.props.startingSideXml,
        this.props.applySideXml,
        this.props.applySideChanges,
        conflictIds,
      );
      mergedXml = result.mergedXml;
      this.initialAutoAppliedIds = result.autoAppliedIds;
    }

    this.initializeConflictKeys();

    for (const elementId of this.initialAutoAppliedIds) {
      this.resolutionMap.set(elementId, 'auto-applied');
    }

    this.viewer = new DmnViewerWithSync();

    this.setState({ loading: false }, async () => {
      if (this.containerRef.current && this.viewer) {
        await this.viewer.loadXml(mergedXml);
        this.viewer.attachTo(this.containerRef.current);
        this.applyResolutionOverlays();
        this.isInitialized = true;
        this.notifyResolutionChanged();

        requestAnimationFrame(() => {
          this.viewer?.zoomToViewport();
          this.props.onReady?.();
        });
      }
    });
  }

  /** For each conflicting element, register a single pending key (the element ID). */
  private initializeConflictKeys(): void {
    for (const element of this.props.classifiedElements) {
      if (element.classification !== 'both') {
        continue;
      }
      this.resolutionMap.set(element.elementId, 'pending');
    }
  }

  private dispose(): void {
    this.viewer = null;
    this.isInitialized = false;
  }

  // ---------------------------------------------------------------------------
  // XML rebuild — re-runs the merge engine with the current resolution state
  // ---------------------------------------------------------------------------

  /**
   * Computes the effective skip set by adjusting the initial conflict IDs
   * based on the current resolution state:
   * - Conflict elements resolved to "apply side" are removed from the skip set
   *   (so the engine applies the donor version)
   * - Auto-applied elements that were reverted to "pending" are added to the
   *   skip set (so the engine leaves the starting-side version)
   */
  private computeEffectiveSkipIds(): Set<string> {
    const skipIds = new Set(
      this.props.classifiedElements
        .filter((element) => element.classification === 'both')
        .map((element) => element.elementId),
    );

    const isRebase = this.props.operationKind === 'rebase';
    const applySideStatus: ElementResolutionStatus = isRebase ? 'accepted-ours' : 'accepted-theirs';

    for (const elementId of [...skipIds]) {
      const keys = this.getConflictKeysForElement(elementId);
      if (keys.length === 0) {
        continue;
      }
      const hasApplySide = keys.some((key) => this.resolutionMap.get(key) === applySideStatus);
      if (hasApplySide) {
        skipIds.delete(elementId);
      }
    }

    for (const elementId of this.initialAutoAppliedIds) {
      const status = this.resolutionMap.get(elementId);
      if (status === 'reverted') {
        skipIds.add(elementId);
      }
    }

    return skipIds;
  }

  private buildResolvedXml(): string {
    if (this.props.applySideChanges == null) {
      return this.props.startingSideXml;
    }

    const skipIds = this.computeEffectiveSkipIds();
    const { mergedXml } = dmnXmlMergeEngine(
      this.props.startingSideXml,
      this.props.applySideXml,
      this.props.applySideChanges,
      skipIds,
    );

    return mergedXml;
  }

  private async rebuildAndRefresh(): Promise<void> {
    if (this.viewer == null || this.containerRef.current == null) {
      return;
    }

    try {
      const resolvedXml = this.buildResolvedXml();
      await this.viewer.loadXml(resolvedXml);
      this.viewer.attachTo(this.containerRef.current);
      this.applyResolutionOverlays();
      requestAnimationFrame(() => {
        this.viewer?.zoomToViewport();
      });
    } catch (error) {
      console.warn('[DmnMergeResultModeler] Failed to rebuild and refresh:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  private applyResolutionOverlays(): void {
    if (this.viewer == null) {
      return;
    }

    const elementStatuses = this.computeElementOverlayStatuses();
    for (const [elementId, status] of elementStatuses) {
      this.applyOverlayForElement(elementId, status);
    }
  }

  private computeElementOverlayStatuses(): Map<string, ElementResolutionStatus> {
    const result = new Map<string, ElementResolutionStatus>();

    for (const [key, status] of this.resolutionMap) {
      const elementId = key;
      const existing = result.get(elementId);

      if (existing == null) {
        result.set(elementId, status);
        continue;
      }

      if (status === 'pending') {
        result.set(elementId, 'pending');
      } else if (existing === 'accepted-ours' && status === 'accepted-theirs') {
        result.set(elementId, 'custom');
      } else if (existing === 'accepted-theirs' && status === 'accepted-ours') {
        result.set(elementId, 'custom');
      }
    }

    return result;
  }

  private applyOverlayForElement(elementId: string, status: ElementResolutionStatus): void {
    if (this.viewer == null) {
      return;
    }

    let modifier: string;
    let cssClass: string;

    switch (status) {
      case 'pending':
        modifier = 'pending';
        cssClass = 'ph-duotone ph-warning';
        break;
      case 'reverted':
        modifier = 'reverted';
        cssClass = 'ph-duotone ph-arrow-counter-clockwise';
        break;
      case 'auto-applied':
        modifier = 'auto-applied';
        cssClass = 'ph-duotone ph-check';
        break;
      case 'accepted-ours':
        modifier = 'resolved-ours';
        cssClass = 'ph-duotone ph-check-circle';
        break;
      case 'accepted-theirs':
        modifier = 'resolved-theirs';
        cssClass = 'ph-duotone ph-check-circle';
        break;
      case 'custom':
        modifier = 'resolved';
        cssClass = 'ph-duotone ph-check-circle';
        break;
      default:
        return;
    }

    this.viewer.addOverlay(elementId, modifier, cssClass);
  }

  private notifyResolutionChanged(): void {
    this.props.onResolutionChanged?.(this.getResolutionProgress());
  }

  // --- Public imperative API ---

  getApi(): ResultModelerApi {
    return {
      acceptStartingSideForKey: (key: ConflictKey) => this.acceptStartingSideForKey(key),
      acceptApplySideForKey: (key: ConflictKey) => this.acceptApplySideForKey(key),
      acceptStartingSideForElement: (elementId: string) => this.acceptStartingSideForElement(elementId),
      acceptApplySideForElement: (elementId: string) => this.acceptApplySideForElement(elementId),
      revertAutoApplied: (elementId: string) => this.revertAutoApplied(elementId),
      reapplyAutoApplied: (elementId: string) => this.reapplyAutoApplied(elementId),
      undoConflictResolution: (key: ConflictKey) => this.undoConflictResolution(key),
      getResultXml: () => this.getResultXml(),
      isFullyResolved: () => this.isFullyResolved(),
      getResolutionProgress: () => this.getResolutionProgress(),
      getResolutionStatus: (key: ConflictKey) => this.resolutionMap.get(key) ?? null,
      getAllResolutions: () => this.getAllResolutions(),
      getConflictKeysForElement: (elementId: string) => this.getConflictKeysForElement(elementId),
      zoomToViewport: () => this.viewer?.zoomToViewport(),
      getElementRegistry: () => this.viewer?.getElementRegistry(),
      getSelection: () => this.viewer?.getSelection(),
      getCanvas: () => this.viewer?.getCanvas(),
      getOverlays: () => null,
      getViewer: () => this.viewer,
    };
  }

  getConflictKeysForElement(elementId: string): ConflictKey[] {
    if (this.resolutionMap.has(elementId)) {
      return [elementId];
    }
    return [];
  }

  // --- Key-level resolution ---

  acceptStartingSideForKey(key: ConflictKey): void {
    const currentStatus = this.resolutionMap.get(key);
    if (currentStatus == null || currentStatus === 'auto-applied') {
      return;
    }

    const isRebase = this.props.operationKind === 'rebase';
    this.resolutionMap.set(key, isRebase ? 'accepted-theirs' : 'accepted-ours');
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  acceptApplySideForKey(key: ConflictKey): void {
    const currentStatus = this.resolutionMap.get(key);
    if (currentStatus == null || currentStatus === 'auto-applied') {
      return;
    }

    const isRebase = this.props.operationKind === 'rebase';
    this.resolutionMap.set(key, isRebase ? 'accepted-ours' : 'accepted-theirs');
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  // --- Element-level batch resolution ---

  acceptStartingSideForElement(elementId: string): void {
    const keys = this.getConflictKeysForElement(elementId);
    const isRebase = this.props.operationKind === 'rebase';
    for (const key of keys) {
      const currentStatus = this.resolutionMap.get(key);
      if (currentStatus != null && currentStatus !== 'auto-applied') {
        this.resolutionMap.set(key, isRebase ? 'accepted-theirs' : 'accepted-ours');
      }
    }
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  acceptApplySideForElement(elementId: string): void {
    const keys = this.getConflictKeysForElement(elementId);
    const isRebase = this.props.operationKind === 'rebase';
    for (const key of keys) {
      const currentStatus = this.resolutionMap.get(key);
      if (currentStatus != null && currentStatus !== 'auto-applied') {
        this.resolutionMap.set(key, isRebase ? 'accepted-ours' : 'accepted-theirs');
      }
    }
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  revertAutoApplied(elementId: string): void {
    const currentStatus = this.resolutionMap.get(elementId);
    if (currentStatus !== 'auto-applied') {
      return;
    }

    this.resolutionMap.set(elementId, 'reverted');
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  reapplyAutoApplied(elementId: string): void {
    const currentStatus = this.resolutionMap.get(elementId);
    if (currentStatus !== 'reverted') {
      return;
    }

    this.resolutionMap.set(elementId, 'auto-applied');
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  undoConflictResolution(key: ConflictKey): void {
    const currentStatus = this.resolutionMap.get(key);
    if (currentStatus !== 'accepted-ours' && currentStatus !== 'accepted-theirs' && currentStatus !== 'custom') {
      return;
    }

    this.resolutionMap.set(key, 'pending');
    this.notifyResolutionChanged();
    this.rebuildAndRefresh();
  }

  acceptAllStartingSide(): void {
    const isRebase = this.props.operationKind === 'rebase';
    const status: ElementResolutionStatus = isRebase ? 'accepted-theirs' : 'accepted-ours';
    let changed = false;
    for (const [key, current] of this.resolutionMap) {
      if (current === 'pending') {
        this.resolutionMap.set(key, status);
        changed = true;
      }
    }
    if (changed) {
      this.notifyResolutionChanged();
      this.rebuildAndRefresh();
    }
  }

  acceptAllApplySide(): void {
    const isRebase = this.props.operationKind === 'rebase';
    const status: ElementResolutionStatus = isRebase ? 'accepted-ours' : 'accepted-theirs';
    let changed = false;
    for (const [key, current] of this.resolutionMap) {
      if (current === 'pending') {
        this.resolutionMap.set(key, status);
        changed = true;
      }
    }
    if (changed) {
      this.notifyResolutionChanged();
      this.rebuildAndRefresh();
    }
  }

  // --- Result XML ---

  async getResultXml(): Promise<string> {
    return this.buildResolvedXml();
  }

  isFullyResolved(): boolean {
    const conflictElementIds = new Set(
      this.props.classifiedElements
        .filter((element) => element.classification === 'both')
        .map((element) => element.elementId),
    );
    for (const [key, status] of this.resolutionMap) {
      if (conflictElementIds.has(key) && status === 'pending') {
        return false;
      }
    }
    return true;
  }

  getResolutionProgress(): MergeResolutionProgress {
    const conflictElementIds = new Set(
      this.props.classifiedElements
        .filter((element) => element.classification === 'both')
        .map((element) => element.elementId),
    );

    let totalConflicts = 0;
    let resolvedConflicts = 0;

    for (const [key, status] of this.resolutionMap) {
      if (!conflictElementIds.has(key)) {
        continue;
      }
      totalConflicts++;
      if (status !== 'pending') {
        resolvedConflicts++;
      }
    }

    return {
      totalConflicts,
      resolvedConflicts,
      isComplete: totalConflicts > 0 && resolvedConflicts === totalConflicts,
    };
  }

  getAllResolutions(): ElementResolution[] {
    return Array.from(this.resolutionMap.entries()).map(([key, status]) => ({
      key,
      elementId: key,
      status,
    }));
  }

  // --- Render ---

  render(): React.JSX.Element {
    return <div ref={this.containerRef} className="dmn-merge__result-container" />;
  }
}
