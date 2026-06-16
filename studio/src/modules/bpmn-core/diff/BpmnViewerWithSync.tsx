import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';
import OutlineModule from 'bpmn-js/lib/features/outline';
import minimapModule from 'diagram-js-minimap';
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
import evilPlatformModdleDescriptor from '../bpmn-js/moddle/evil-platform.json';

export class BpmnViewerWithSync extends AbstractEmitter {
  private viewer: BpmnViewer;
  private oldSelectFunction: (this: unknown, elements?: unknown) => void;
  private overlayElements = new Map<string, HTMLElement[]>();

  constructor() {
    super();

    const bpmnComponentOptions = {
      bpmnRenderer: {
        defaultFillColor: 'var(--color-bpmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-bpmn-defaultStrokeColor)',
      },
    };

    this.viewer = new BpmnViewer({
      additionalModules: [minimapModule, OutlineModule],
      moddleExtensions: {
        evil: evilPlatformModdleDescriptor,
      },
      ...bpmnComponentOptions,
    });
    this.viewer.on('selection.changed', (event: DjsEvent & Record<string, any>) => {
      this.updateOverlaySelectionMarker(event.oldSelection, event.newSelection);
      this.onViewerSelectionChange(event);
    });
    this.oldSelectFunction = this.getSelection().select;
  }

  attachTo(htmlElement: HTMLDivElement): void {
    this.viewer.attachTo(htmlElement);
  }

  async loadXml(xml: string): Promise<void> {
    this.overlayElements.clear();
    await this.viewer.importXML(xml);
  }

  addViewboxSync(otherBpmn: BpmnViewerWithSync): void {
    const canvas = this.viewer.get('canvas') as Canvas;

    const viewBoxChangedCallback = () => {
      const viewbox = canvas.viewbox();
      this.emit('sync_viewbox', [viewbox]);
    };
    this.viewer.on('canvas.viewbox.changed', viewBoxChangedCallback);

    otherBpmn.on('sync_viewbox', (viewbox: CanvasViewbox) => {
      this.viewer.off('canvas.viewbox.changed', viewBoxChangedCallback);
      canvas.viewbox(viewbox as Rect);
      this.viewer.on('canvas.viewbox.changed', viewBoxChangedCallback);
    });

    viewBoxChangedCallback();
  }

  addSelectionSync(otherBpmn: BpmnViewerWithSync): void {
    const selection = this.viewer.get('selection') as Selection;
    const elementRegistry = this.viewer.get('elementRegistry') as ElementRegistry;

    const oldSelect = selection.select;
    selection.select = (delta: any) => {
      this.emit('sync_select', [delta]);

      return oldSelect.apply(selection, [delta]);
    };

    otherBpmn.on('sync_select', (delta: ElementLike | ElementLike[] | null) => {
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

  addOverlay(elementId: string, modifier: string, cssClass: string): boolean {
    const overlays = this.viewer.get('overlays') as unknown as Overlays;
    const elementRegistry = this.viewer.get('elementRegistry') as ElementRegistry;
    const shape = elementRegistry.get(elementId) as Shape | undefined;

    if (shape == null) {
      return false;
    }

    const container = document.createElement('div');
    container.className = `highlight-overlay highlight-overlay--${modifier}`;
    container.style.width = `${shape.width + 10}px`;
    container.style.height = `${shape.height + 10}px`;
    container.innerHTML = `<div class="bpmn-diff-overlay bpmn-diff-overlay--${modifier}"><span class="${cssClass}"></span></div>`;

    overlays.add(elementId, {
      position: {
        top: -5,
        left: -5,
      },
      html: container,
    });

    const existing = this.overlayElements.get(elementId) ?? [];
    existing.push(container);
    this.overlayElements.set(elementId, existing);

    return true;
  }

  getElementRegistry(): ElementRegistry {
    return this.viewer.get('elementRegistry') as ElementRegistry;
  }

  getSelection(): Selection {
    return this.viewer.get('selection') as Selection;
  }

  selectWithoutSync(elements?: ElementLike[]): void {
    const selection = this.getSelection();

    this.oldSelectFunction.apply(selection, [elements]);
  }

  resetZoom(): void {
    (this.viewer.get('canvas') as Canvas).zoom('fit-viewport', 'auto' as any);
  }

  /**
   * The SVG selection outline lives below the HTML overlay layer, so it is
   * invisible for elements that have diff highlight overlays. This method
   * mirrors the selection state onto the overlay DOM elements instead.
   */
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

  async focusViewOnElements(elementIds: string[]): Promise<void> {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    const elementRegistry = this.getElementRegistry();

    const elements = elementIds.map((elementId) => elementRegistry.get(elementId)).filter((el) => el != null);
    const rect = this.getBounds(elements);
    const newViewbox = {
      x: rect.x + rect.width / 2 - viewbox.outer.width / 2,
      y: rect.y + rect.height / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    };

    const locationChanged = this.awaitNextLocationChange();
    canvas.viewbox(newViewbox);
    canvas.zoom(1);

    await locationChanged;
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

    const viewboxAfter = canvas.viewbox();
    const zoomAfter = viewboxAfter.scale * ZOOM_CORRECTION;

    this.getCanvas().zoom(zoomAfter, center);
  }

  setZoom(percentage: number): void {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const center = {
      x: viewbox.outer.width / 2,
      y: viewbox.outer.height / 2,
    };

    this.getCanvas().zoom(percentage, center);
  }

  getCanvas(): Canvas {
    return this.viewer.get('canvas') as Canvas;
  }

  private getBounds(elementOrElements: ElementLike | ElementLike[], abort: boolean = false): Rect {
    const elements = Array.isArray(elementOrElements) ? elementOrElements : [elementOrElements];
    let minX: number | null = null;
    let minY: number | null = null;
    let maxX: number | null = null;
    let maxY: number | null = null;
    abort = !!abort;

    elements.forEach((element: ElementLike) => {
      let bbox: { x: number; y: number; width?: number; height?: number } = element as Shape;
      if (element.waypoints && !abort) {
        bbox = this.getBounds(element.waypoints as ElementLike[], true);
      }

      const x = bbox.x,
        y = bbox.y,
        height = bbox.height || 0,
        width = bbox.width || 0;

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

    return {
      x: minX,
      y: minY,
      height: maxY - minY,
      width: maxX - minX,
    };
  }

  private awaitNextLocationChange(): Promise<void> {
    return new Promise((resolve, _reject) => {
      const resolveCallbackFn = () => {
        this.viewer.off('canvas.viewbox.changed', resolveCallbackFn);

        resolve();
      };
      this.viewer.on('canvas.viewbox.changed', resolveCallbackFn);
    });
  }
}
