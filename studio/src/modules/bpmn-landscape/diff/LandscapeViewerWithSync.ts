import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { ElementLike } from 'diagram-js/lib/model/Types';
import { getBBox } from 'diagram-js/lib/util/Elements';
import type { Rect } from 'diagram-js/lib/util/Types';

import type { LandscapeMap, LandscapeProcessElement } from '../LandscapeMapFile';
import { parseLandscapeMap, resolveRelativeUri } from '../LandscapeMapFile';
import type { LandscapeSolutionScan } from '../LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from '../LandscapeSolutionScan';
import LandscapeModeler from '../modeler/LandscapeModeler';
import type { LandscapeRendererConfig } from '../modeler/LandscapeRenderer';
import { resolveProcessReference } from '../resolveProcessReference';

const isPresent = (element: ElementLike | undefined): element is ElementLike => element != null;

/** The change and conflict markers; the drill-down buttons of collapsed groups are overlays too. */
const MARKER_OVERLAY_TYPE = 'landscape-change-marker';

/** A read-only map canvas that keeps its viewbox and selection in step with another one, for diff and merge views. */
export class LandscapeViewerWithSync extends AbstractEmitter {
  private readonly modeler: LandscapeModeler;
  private readonly selectWithoutEmit: Selection['select'];
  private overlayElements = new Map<string, HTMLElement[]>();
  private subscriptions: AbstractSubscription[] = [];

  constructor(config: LandscapeRendererConfig) {
    super();
    this.modeler = new LandscapeModeler(config, [], { readOnly: true });
    this.getEventBus().on('selection.changed', ({ oldSelection, newSelection }: any) => {
      this.updateOverlaySelectionMarker(oldSelection, newSelection);
      const selectedElementIds = newSelection.map((element: ElementLike) => element.id);
      this.emit(EVENT_METADATA_UPDATED, [{ selectedElementIds }]);
    });
    this.selectWithoutEmit = this.getSelection().select;
  }

  attachTo(htmlElement: HTMLDivElement): void {
    htmlElement.appendChild(this.modeler.container);
    this.getCanvas().resized();
  }

  async loadXml(text: string): Promise<void> {
    const result = await parseLandscapeMap(text);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
    this.loadMap(result.map);
  }

  loadMap(map: LandscapeMap): void {
    this.overlayElements.clear();
    this.modeler.importMap(map);
  }

  addViewboxSync(other: LandscapeViewerWithSync): void {
    const canvas = this.getCanvas();
    const eventBus = this.getEventBus();
    const viewboxChanged = (): void => this.emit('sync_viewbox', [canvas.viewbox()]);
    eventBus.on('canvas.viewbox.changed', viewboxChanged);
    this.subscriptions.push(
      other.on('sync_viewbox', (viewbox: CanvasViewbox) => {
        eventBus.off('canvas.viewbox.changed', viewboxChanged);
        canvas.viewbox(viewbox as Rect);
        eventBus.on('canvas.viewbox.changed', viewboxChanged);
      }),
    );
    viewboxChanged();
  }

  addSelectionSync(other: LandscapeViewerWithSync): void {
    const selection = this.getSelection();
    selection.select = (elements: ElementLike | ElementLike[] | null, add?: boolean) => {
      this.emit('sync_select', [elements, add]);
      this.selectWithoutEmit.call(selection, elements, add);
    };
    this.subscriptions.push(
      other.on('sync_select', (elements: ElementLike | ElementLike[] | null, add?: boolean) => {
        const elementIds = (Array.isArray(elements) ? elements : [elements]).flatMap((element) =>
          element == null ? [] : [element.id],
        );
        this.selectIds(elementIds, add);
      }),
    );
  }

  addOverlay(elementId: string, modifier: string, cssClass: string): boolean {
    const element = this.getElementRegistry().get(elementId);
    if (element == null) {
      return false;
    }
    // A connector's overlay is placed relative to the box around its waypoints.
    const { width, height } = getBBox(element as any);

    const container = document.createElement('div');
    container.className = `highlight-overlay highlight-overlay--${modifier}`;
    container.classList.toggle('highlight-overlay--selected', this.getSelection().isSelected(element));
    container.style.width = `${width + 10}px`;
    container.style.height = `${height + 10}px`;
    container.innerHTML = `<div class="bpmn-diff-overlay bpmn-diff-overlay--${modifier}"><span class="${cssClass}"></span></div>`;

    this.modeler
      .get<Overlays>('overlays')
      .add(elementId, MARKER_OVERLAY_TYPE, { position: { top: -5, left: -5 }, html: container });

    const existing = this.overlayElements.get(elementId) ?? [];
    existing.push(container);
    this.overlayElements.set(elementId, existing);
    return true;
  }

  removeOverlays(): void {
    this.modeler.get<Overlays>('overlays').remove({ type: MARKER_OVERLAY_TYPE });
    this.overlayElements.clear();
  }

  getElementRegistry(): ElementRegistry {
    return this.modeler.get<ElementRegistry>('elementRegistry');
  }

  getSelection(): Selection {
    return this.modeler.get<Selection>('selection');
  }

  getCanvas(): Canvas {
    return this.modeler.get<Canvas>('canvas');
  }

  selectWithoutSync(elementIds: string[] = []): void {
    this.selectIds(elementIds, false);
  }

  /** Centres the elements at 100 %, on the plane of the first one when it lies inside a collapsed group. */
  async focusViewOnElements(elementIds: string[]): Promise<void> {
    const canvas = this.getCanvas();
    const elementRegistry = this.getElementRegistry();
    const elements = elementIds.map((elementId) => elementRegistry.get(elementId)).filter(isPresent);
    if (elements.length === 0) {
      return;
    }
    const root = canvas.findRoot(elements[0]);
    if (root != null && root !== canvas.getRootElement()) {
      canvas.setRootElement(root);
    }
    const viewbox = canvas.viewbox();
    const bounds = getBBox(elements.filter((element) => canvas.findRoot(element) === root) as any[]);
    canvas.viewbox({
      x: bounds.x + bounds.width / 2 - viewbox.outer.width / 2,
      y: bounds.y + bounds.height / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    });
    canvas.zoom(1);
  }

  resetZoom(): void {
    const canvas = this.getCanvas();
    // diagram-js caches the viewbox, including the container size it had when it was last hidden or resized.
    canvas.resized();
    const size = canvas.getSize();
    if (size.width === 0 || size.height === 0) {
      return;
    }
    canvas.zoom('fit-viewport', 'auto' as any);
  }

  zoomToViewport(): void {
    const ZOOM_CORRECTION = 0.9;
    const PADDING_CORRECTION = 36;

    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }
    const center = {
      x: viewbox.outer.width / 2 + PADDING_CORRECTION * 4,
      y: viewbox.outer.height / 2,
    };
    canvas.zoom('fit-viewport', center);
    canvas.zoom(canvas.viewbox().scale * ZOOM_CORRECTION, center);
  }

  setZoom(percentage: number): void {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }
    canvas.zoom(percentage, { x: viewbox.outer.width / 2, y: viewbox.outer.height / 2 });
  }

  destroy(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.modeler.destroy();
  }

  private getEventBus(): EventBus {
    return this.modeler.get<EventBus>('eventBus');
  }

  private selectIds(elementIds: string[], add?: boolean): void {
    const elementRegistry = this.getElementRegistry();
    const elements = elementIds.map((elementId) => elementRegistry.get(elementId)).filter(isPresent);
    this.selectWithoutEmit.call(this.getSelection(), elements, add);
  }

  /** The SVG selection outline lies below the HTML overlays, so the overlays of selected elements are marked instead. */
  private updateOverlaySelectionMarker(oldSelection: ElementLike[], newSelection: ElementLike[]): void {
    for (const element of oldSelection) {
      this.overlayElements
        .get(element.id)
        ?.forEach((overlay) => overlay.classList.remove('highlight-overlay--selected'));
    }
    for (const element of newSelection) {
      this.overlayElements.get(element.id)?.forEach((overlay) => overlay.classList.add('highlight-overlay--selected'));
    }
  }
}

/**
 * Draws a map as the map editor does, with process names, decision badges and broken references taken from the
 * solution as it is now. Before the first solution scan, or without a solution, no reference counts as broken.
 * Plugin entries, placeholder actions and connector warnings belong to the editor and do nothing here.
 */
export function createLandscapeViewerConfig(bifrost: Bifrost, mapUri: string): LandscapeRendererConfig {
  const solutionScan = bifrost.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
  const getSnapshot = () => (bifrost.solution.getSolution() == null ? null : solutionScan.getSnapshot());
  const resolveProcess = (element: LandscapeProcessElement) => {
    const snapshot = getSnapshot();
    return snapshot == null ? null : resolveProcessReference(snapshot.catalog, mapUri, element);
  };
  const resolvedProcessOf = (element: LandscapeProcessElement) => {
    const resolution = resolveProcess(element);
    return resolution?.status === 'resolved' ? resolution.process : null;
  };
  return {
    getProcessLabel: (element) => element.label ?? (resolvedProcessOf(element)?.name || element.processId),
    getDecisionCount: (element) => resolvedProcessOf(element)?.decisionRefs.length ?? 0,
    getProcessStatus: (element) => resolveProcess(element)?.status ?? 'resolved',
    getMapLinkStatus: (element) => {
      const snapshot = getSnapshot();
      const targetUri = resolveRelativeUri(mapUri, element.mapPath);
      return snapshot == null || snapshot.maps.some((entry) => entry.uri === targetUri) ? 'resolved' : 'missing';
    },
    getConnectorWarning: () => null,
    executePluginCommand: () => {},
    runPlaceholderAction: () => {},
    hasFreeProcesses: () => false,
  };
}
