import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { Debugger } from 'debug';
import Debug from 'debug';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import DrdOutlineModule from 'dmn-js-drd/lib/features/outline';
import DmnNavigatedViewer from 'dmn-js/lib/NavigatedViewer';

import type { DmnView, DmnViewType } from './DmnModelerComponentAdapter';

export const EVENT_DMN_VIEWER_READY_FOR_INTERACTION = 'EVENT_DMN_VIEWER_READY_FOR_INTERACTION';
export const EVENT_DMN_VIEWER_ATTACHED_TO_HTML = 'EVENT_DMN_VIEWER_ATTACHED_TO_HTML';
export const EVENT_DMN_VIEWER_SELECTION_CHANGED = 'EVENT_DMN_VIEWER_SELECTION_CHANGED';
export const EVENT_DMN_VIEWER_VIEW_CHANGED = 'EVENT_DMN_VIEWER_VIEW_CHANGED';

export interface DmnViewerOptions {
  drdRenderer?: {
    defaultFillColor: string;
    defaultStrokeColor: string;
  };
}

/**
 * Read-only adapter wrapping `dmn-js/lib/NavigatedViewer` for the Engine DMN Viewer.
 *
 * Mirrors the lifecycle of {@link BpmnViewerComponentAdapter} and the multi-view
 * event wiring from {@link DmnModelerComponentAdapter}.
 */
export class DmnViewerComponentAdapter extends AbstractEmitter {
  private log: Debugger;
  private viewer: any;
  private readyForInteraction: boolean = false;
  private activeViewerEventCleanup: (() => void) | null = null;

  constructor(uri: string, options?: DmnViewerOptions) {
    super();
    this.log = Debug(`dmn/${this.constructor.name}(${uri})`);

    this.viewer = new DmnNavigatedViewer({
      drd: {
        additionalModules: [DrdOutlineModule],
        drdRenderer: {
          defaultFillColor: options?.drdRenderer?.defaultFillColor ?? 'var(--color-dmn-defaultFillColor)',
          defaultStrokeColor: options?.drdRenderer?.defaultStrokeColor ?? 'var(--color-dmn-defaultStrokeColor)',
        },
      },
    });

    this.viewer.on('import.done', (event: any) => {
      if (event.warnings?.length) {
        this.log('Warnings found while importing the DMN diagram', event.warnings);
      }
    });

    this.viewer.on('views.changed', (event: any) => {
      this.log('views.changed', event.activeView?.type);
      this.rewireActiveViewerEvents();
      this.emit(EVENT_DMN_VIEWER_VIEW_CHANGED, [{ views: event.views, activeView: event.activeView }]);
    });
  }

  async initialize(xml: string): Promise<void> {
    this.once(EVENT_DMN_VIEWER_ATTACHED_TO_HTML, () => {
      this.readyForInteraction = true;
      this.emit(EVENT_DMN_VIEWER_READY_FOR_INTERACTION);
    });

    try {
      const result = await this.viewer.importXML(xml);
      if (result.warnings?.length) {
        console.warn('[DmnViewerComponentAdapter] Import warnings:', result.warnings);
      }
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : (error?.error?.message ?? error?.message ?? JSON.stringify(error));
      throw new Error(`ERROR: failed to import DMN xml\n\nError given:\n\n${message}`, { cause: error });
    }
  }

  attachToHtmlElement(htmlElement: HTMLElement): void {
    const emitAttachedToHtml = () => {
      this.viewer.off('attach', emitAttachedToHtml);
      this.resizeActiveViewer();
      this.emit(EVENT_DMN_VIEWER_ATTACHED_TO_HTML);
    };
    this.viewer.on('attach', emitAttachedToHtml);
    this.viewer.attachTo(htmlElement);
  }

  onceInteractive(callbackFn: () => void | Promise<void>): void {
    setTimeout(() => {
      if (this.readyForInteraction) {
        callbackFn();
      } else {
        this.once(EVENT_DMN_VIEWER_READY_FOR_INTERACTION, () => callbackFn());
      }
    }, 1);
  }

  dispose(): void {
    this.cleanupActiveViewerEvents();
    this.viewer.destroy();
  }

  //#region View Management

  getViews(): DmnView[] {
    return this.viewer.getViews() as DmnView[];
  }

  getActiveView(): DmnView | null {
    return (this.viewer.getActiveView() as DmnView) ?? null;
  }

  getActiveViewType(): DmnViewType | null {
    return this.getActiveView()?.type ?? null;
  }

  openView(view: DmnView): void {
    this.viewer.open(view);
  }

  openDrd(): void {
    const drdView = this.getViews().find((view) => view.type === 'drd');
    if (drdView) {
      this.openView(drdView);
    }
  }

  isDrdActive(): boolean {
    return this.getActiveViewType() === 'drd';
  }

  hasDrdView(): boolean {
    return this.getViews().some((view) => view.type === 'drd');
  }

  //#endregion View Management

  //#region DRD Canvas Services

  getDrdCanvas(): Canvas | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('canvas') as Canvas;
    } catch {
      return null;
    }
  }

  getDrdElementRegistry(): ElementRegistry | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('elementRegistry') as ElementRegistry;
    } catch {
      return null;
    }
  }

  getDrdSelection(): Selection | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('selection') as Selection;
    } catch {
      return null;
    }
  }

  getDrdOverlays(): Overlays | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('overlays') as Overlays;
    } catch {
      return null;
    }
  }

  //#endregion DRD Canvas Services

  //#region Zoom

  zoomToViewport(): void {
    if (!this.isDrdActive()) {
      return;
    }

    const canvas = this.getDrdCanvas();
    if (!canvas) {
      return;
    }

    const ZOOM_CORRECTION = 0.9;
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const newScale =
      Math.min(1, viewbox.outer.width / viewbox.inner.width, viewbox.outer.height / viewbox.inner.height) *
      ZOOM_CORRECTION;

    const newViewbox = {
      x: viewbox.inner.x + viewbox.inner.width / 2 - viewbox.outer.width / newScale / 2,
      y: viewbox.inner.y + viewbox.inner.height / 2 - viewbox.outer.height / newScale / 2,
      width: viewbox.outer.width / newScale,
      height: viewbox.outer.height / newScale,
    };

    canvas.viewbox(newViewbox);
  }

  zoomToActualSize(): void {
    if (!this.isDrdActive()) {
      return;
    }

    const canvas = this.getDrdCanvas();
    if (!canvas) {
      return;
    }

    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const center = {
      x: viewbox.outer.width / 2,
      y: viewbox.outer.height / 2,
    };

    canvas.zoom(1, center);
  }

  getZoom(): number {
    if (!this.isDrdActive()) {
      return 1;
    }
    const canvas = this.getDrdCanvas();
    return canvas?.zoom() ?? 1;
  }

  //#endregion Zoom

  //#region Export

  async getSvg(): Promise<string> {
    const drdViewer = this.getDrdViewer();
    if (!drdViewer) {
      throw new Error('No DRD viewer available for SVG export');
    }
    const { svg } = await drdViewer.saveSVG();
    return svg;
  }

  //#endregion Export

  //#region Private internals

  private getDrdViewer(): any | null {
    const drdView = this.getViews().find((view) => view.type === 'drd');
    if (!drdView) {
      return null;
    }
    return this.viewer._getViewer(drdView);
  }

  private resizeActiveViewer(): void {
    const activeView = this.getActiveView();
    if (!activeView) {
      return;
    }
    const viewer = this.viewer._getViewer(activeView);
    if (!viewer) {
      return;
    }
    try {
      (viewer.get('canvas') as Canvas).resized();
    } catch {
      // Table and expression viewers do not expose a diagram-js canvas
    }
  }

  private rewireActiveViewerEvents(): void {
    this.cleanupActiveViewerEvents();

    const activeView = this.getActiveView();
    if (!activeView) {
      return;
    }
    const viewer = this.viewer._getViewer(activeView);
    if (!viewer) {
      return;
    }

    const onSelectionChanged = (event: any) => {
      this.emit(EVENT_DMN_VIEWER_SELECTION_CHANGED, [event.newSelection ?? event.selection ?? []]);
    };

    try {
      viewer.on('selection.changed', onSelectionChanged);
    } catch {
      // Not all viewers have selection events
    }

    this.activeViewerEventCleanup = () => {
      try {
        viewer.off('selection.changed', onSelectionChanged);
      } catch {
        /* already destroyed */
      }
    };
  }

  private cleanupActiveViewerEvents(): void {
    this.activeViewerEventCleanup?.();
    this.activeViewerEventCleanup = null;
  }

  //#endregion Private internals
}
