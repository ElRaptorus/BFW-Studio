import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Event as DjsEvent } from 'diagram-js/lib/core/EventBus';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { ElementLike, Shape } from 'diagram-js/lib/model/Types';
import type { Rect } from 'diagram-js/lib/util/Types';

import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import { EVENT_METADATA_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';

export class DmnViewerWithSync extends AbstractEmitter {
  private viewer: any;
  private drdViewer: any | null = null;
  private oldSelectFunction: (this: unknown, elements?: unknown) => void;
  private overlayElements = new Map<string, HTMLElement[]>();
  private xmlLoaded = false;

  constructor() {
    super();

    const DmnViewer = require('dmn-js/lib/NavigatedViewer').default;

    this.viewer = new DmnViewer({
      drd: {
        drdRenderer: {
          defaultFillColor: 'var(--color-dmn-defaultFillColor)',
          defaultStrokeColor: 'var(--color-dmn-defaultStrokeColor)',
        },
      },
    });

    this.oldSelectFunction = () => {};
  }

  attachTo(htmlElement: HTMLDivElement): void {
    this.viewer.attachTo(htmlElement);

    if (this.xmlLoaded && this.drdViewer == null) {
      this.initDrdViewer();
    }
  }

  async loadXml(xml: string): Promise<void> {
    this.overlayElements.clear();
    this.drdViewer = null;
    await this.viewer.importXML(xml);
    this.xmlLoaded = true;
    this.initDrdViewer();
  }

  private initDrdViewer(): void {
    const views = this.viewer.getViews();
    const drdView = views.find((view: any) => view.type === 'drd');
    if (drdView == null) {
      return;
    }

    this.viewer.open(drdView);
    this.drdViewer = this.viewer._getViewer(drdView);

    if (this.drdViewer != null) {
      this.drdViewer.on('selection.changed', (event: DjsEvent & Record<string, any>) => {
        this.updateOverlaySelectionMarker(event.oldSelection, event.newSelection);
        this.onViewerSelectionChange(event);
      });
      const selection = this.getSelection();
      if (selection != null) {
        this.oldSelectFunction = selection.select;
      }
    }
  }

  private static hasValidViewbox(viewbox: CanvasViewbox): boolean {
    return (
      isFinite(viewbox.width) &&
      isFinite(viewbox.height) &&
      viewbox.width > 0 &&
      viewbox.height > 0 &&
      viewbox.outer.width > 0 &&
      viewbox.outer.height > 0
    );
  }

  addViewboxSync(other: DmnViewerWithSync): void {
    const canvas = this.getCanvas();
    if (canvas == null || this.drdViewer == null) {
      return;
    }

    const drdViewer = this.drdViewer;

    const viewBoxChangedCallback = () => {
      const viewbox = canvas.viewbox();
      if (!DmnViewerWithSync.hasValidViewbox(viewbox)) {
        return;
      }
      this.emit('sync_viewbox', [viewbox]);
    };
    drdViewer.on('canvas.viewbox.changed', viewBoxChangedCallback);

    other.on('sync_viewbox', (viewbox: CanvasViewbox) => {
      if (!DmnViewerWithSync.hasValidViewbox(viewbox)) {
        return;
      }
      drdViewer.off('canvas.viewbox.changed', viewBoxChangedCallback);
      canvas.viewbox(viewbox as Rect);
      drdViewer.on('canvas.viewbox.changed', viewBoxChangedCallback);
    });

    viewBoxChangedCallback();
  }

  addSelectionSync(other: DmnViewerWithSync): void {
    if (this.drdViewer == null) {
      return;
    }
    const selection = this.getSelection();
    const elementRegistry = this.getElementRegistry();
    if (selection == null || elementRegistry == null) {
      return;
    }

    const oldSelect = selection.select;
    selection.select = (delta: any) => {
      this.emit('sync_select', [delta]);
      return oldSelect.apply(selection, [delta]);
    };

    other.on('sync_select', (delta: ElementLike | ElementLike[] | null) => {
      if (delta === null) {
        oldSelect.apply(selection, [delta]);
        return;
      }

      const elements = Array.isArray(delta)
        ? delta.map((entry) => elementRegistry.get(entry.id))
        : elementRegistry.get(delta.id);

      oldSelect.apply(selection, [elements]);
    });
  }

  addOverlay(elementId: string, modifier: string, cssClass: string): void {
    const overlays = this.getOverlays();
    const elementRegistry = this.getElementRegistry();
    if (overlays == null || elementRegistry == null) {
      return;
    }

    const shape = elementRegistry.get(elementId) as Shape | undefined;
    if (shape == null) {
      return;
    }

    const container = document.createElement('div');
    container.className = `highlight-overlay highlight-overlay--${modifier}`;
    container.style.width = `${shape.width + 10}px`;
    container.style.height = `${shape.height + 10}px`;
    container.innerHTML = `<div class="bpmn-diff-overlay bpmn-diff-overlay--${modifier}"><span class="${cssClass}"></span></div>`;

    overlays.add(elementId, {
      position: { top: -5, left: -5 },
      html: container,
    });

    const existing = this.overlayElements.get(elementId) ?? [];
    existing.push(container);
    this.overlayElements.set(elementId, existing);
  }

  getElementRegistry(): ElementRegistry | null {
    return (this.drdViewer?.get('elementRegistry') as ElementRegistry) ?? null;
  }

  getSelection(): Selection | null {
    return (this.drdViewer?.get('selection') as Selection) ?? null;
  }

  selectWithoutSync(elements?: ElementLike[]): void {
    const selection = this.getSelection();
    if (selection != null) {
      this.oldSelectFunction.apply(selection, [elements]);
    }
  }

  resetZoom(): void {
    const canvas = this.getCanvas();
    if (canvas == null) {
      return;
    }
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }
    canvas.zoom('fit-viewport', 'auto' as any);
  }

  setZoom(percentage: number): void {
    const canvas = this.getCanvas();
    if (canvas == null) {
      return;
    }
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }
    const center = { x: viewbox.outer.width / 2, y: viewbox.outer.height / 2 };
    canvas.zoom(percentage, center);
  }

  zoomToViewport(): void {
    const ZOOM_CORRECTION = 0.9;
    const PADDING_CORRECTION = 36;
    const canvas = this.getCanvas();
    if (canvas == null) {
      return;
    }
    const viewbox = canvas.viewbox();
    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }
    const center = {
      x: viewbox.outer.width / 2 + PADDING_CORRECTION * 4,
      y: viewbox.outer.height / 2,
    };
    canvas.zoom('fit-viewport', center);
    const viewboxAfter = canvas.viewbox();
    const zoomAfter = viewboxAfter.scale * ZOOM_CORRECTION;
    canvas.zoom(zoomAfter, center);
  }

  async focusViewOnElements(elementIds: string[]): Promise<void> {
    const canvas = this.getCanvas();
    const elementRegistry = this.getElementRegistry();
    if (canvas == null || elementRegistry == null) {
      return;
    }
    const viewbox = canvas.viewbox();
    const elements = elementIds.map((id) => elementRegistry.get(id)).filter((el) => el != null);
    const rect = this.getBounds(elements);
    const newViewbox = {
      x: rect.x + rect.width / 2 - viewbox.outer.width / 2,
      y: rect.y + rect.height / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    };
    canvas.viewbox(newViewbox);
    canvas.zoom(1);
  }

  getCanvas(): Canvas | null {
    return (this.drdViewer?.get('canvas') as Canvas) ?? null;
  }

  private getOverlays(): Overlays | null {
    return (this.drdViewer?.get('overlays') as unknown as Overlays) ?? null;
  }

  private updateOverlaySelectionMarker(oldSelection: ElementLike[], newSelection: ElementLike[]): void {
    for (const element of oldSelection) {
      for (const el of this.overlayElements.get(element.id) ?? []) {
        el.classList.remove('highlight-overlay--selected');
      }
    }
    for (const element of newSelection) {
      for (const el of this.overlayElements.get(element.id) ?? []) {
        el.classList.add('highlight-overlay--selected');
      }
    }
  }

  private onViewerSelectionChange(event: DjsEvent & Record<string, any>): void {
    const selectedElementIds = event.newSelection.map((selectedElement: ElementLike) => selectedElement.id);
    this.emit(EVENT_METADATA_UPDATED, [{ selectedElementIds }]);
  }

  private getBounds(elementOrElements: ElementLike | ElementLike[], abort: boolean = false): Rect {
    const elements = Array.isArray(elementOrElements) ? elementOrElements : [elementOrElements];
    let minX: number | null = null;
    let minY: number | null = null;
    let maxX: number | null = null;
    let maxY: number | null = null;

    elements.forEach((element: ElementLike) => {
      let bbox: { x: number; y: number; width?: number; height?: number } = element as Shape;
      if ((element as any).waypoints && !abort) {
        bbox = this.getBounds((element as any).waypoints as ElementLike[], true);
      }
      const x = bbox.x;
      const y = bbox.y;
      const height = bbox.height || 0;
      const width = bbox.width || 0;

      if (minX == null || x < minX) {
        minX = x;
      }
      if (minY == null || y < minY) {
        minY = y;
      }
      if (maxX == null || x + width > maxX) {
        maxX = x + width;
      }
      if (maxY == null || y + height > maxY) {
        maxY = y + height;
      }
    });

    if (minX == null || maxX == null || minY == null || maxY == null) {
      throw new Error('Could not get bounds');
    }

    return { x: minX, y: minY, height: maxY - minY, width: maxX - minX };
  }
}
