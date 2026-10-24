import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';

import type LandscapeUpdates from './LandscapeUpdates';
import { collapsedAncestorsOf, isCollapsedGroup, mainRootOf } from './landscapeHierarchy';

const OVERLAY_TYPE = 'landscape-drilldown';

type Viewbox = { x: number; y: number; width: number; height: number };

/**
 * Opens a collapsed group's plane: an overlay button and a double-click on the group, breadcrumbs that lead back, and
 * a viewbox kept per plane, so a plane looks the way it was left.
 */
export default class LandscapeDrilldown {
  static $inject = ['eventBus', 'canvas', 'overlays', 'landscapeUpdates'];

  private readonly canvas: Canvas;
  private readonly overlays: any;
  private readonly landscapeUpdates: LandscapeUpdates;
  private readonly breadcrumbs: HTMLUListElement;
  // A weak map lets a removed plane be collected; the command stack holds it for undo, not this map.
  private viewboxes = new WeakMap<object, Viewbox>();

  constructor(eventBus: EventBus, canvas: Canvas, overlays: any, landscapeUpdates: LandscapeUpdates) {
    this.canvas = canvas;
    this.overlays = overlays;
    this.landscapeUpdates = landscapeUpdates;
    this.breadcrumbs = document.createElement('ul');
    this.breadcrumbs.className = 'landscape-breadcrumbs';
    this.breadcrumbs.style.display = 'none';
    canvas.getContainer().appendChild(this.breadcrumbs);

    eventBus.on('root.set', ({ element }: any) => {
      this.restoreViewbox(element);
      this.renderBreadcrumbs();
    });
    eventBus.on('canvas.viewbox.changed', ({ viewbox }: { viewbox: Viewbox }) => {
      this.viewboxes.set(canvas.getRootElement(), viewbox);
    });
    eventBus.on('diagram.clear', () => {
      this.viewboxes = new WeakMap();
      this.breadcrumbs.replaceChildren();
      this.breadcrumbs.style.display = 'none';
    });
    eventBus.on('shape.added', ({ element }: any) => this.syncOverlay(element));
    eventBus.on('elements.changed', ({ elements }: { elements: any[] }) => {
      elements.forEach((element) => this.syncOverlay(element));
      if (canvas.getRootElement()?.group != null) {
        this.renderBreadcrumbs();
      }
    });
    eventBus.on('element.dblclick', ({ element }: any) => {
      if (isCollapsedGroup(element)) {
        this.open(element);
      }
    });
  }

  open(group: any): void {
    if (group.plane != null) {
      this.canvas.setRootElement(group.plane);
    }
  }

  private syncOverlay(element: any): void {
    // A removed group is in `elements.changed` too, without a parent.
    if (element.type !== 'group' || element.parent == null) {
      return;
    }
    const existing: any[] = this.overlays.get({ element, type: OVERLAY_TYPE });
    if (!isCollapsedGroup(element)) {
      existing.forEach((overlay) => this.overlays.remove(overlay.id));
      return;
    }
    if (existing.length > 0) {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'landscape-drilldown';
    button.title = 'Open this group';
    button.setAttribute('data-test--landscape-drilldown', element.id);
    const icon = document.createElement('i');
    icon.className = 'ph ph-arrows-out-simple';
    button.appendChild(icon);
    button.addEventListener('click', () => this.open(element));
    this.overlays.add(element, OVERLAY_TYPE, { position: { bottom: 4, right: 4 }, html: button });
  }

  private restoreViewbox(root: any): void {
    const { width, height } = this.canvas.getSize();
    if (!this.canvas.getContainer().isConnected || width === 0 || height === 0) {
      return;
    }
    const stored = this.viewboxes.get(root);
    if (stored != null) {
      this.canvas.viewbox(stored);
    } else if (root.group != null) {
      // An empty plane has nothing to fit.
      this.canvas.zoom(root.children.some((child: any) => child.waypoints == null) ? 'fit-viewport' : 1);
    }
  }

  private renderBreadcrumbs(): void {
    const root: any = this.canvas.getRootElement();
    this.breadcrumbs.replaceChildren();
    this.breadcrumbs.style.display = root?.group == null ? 'none' : '';
    if (root?.group == null) {
      return;
    }
    const trail = [
      { label: this.landscapeUpdates.getMapProperties().name || 'Map', target: mainRootOf(this.canvas) },
      ...collapsedAncestorsOf(root.group)
        .reverse()
        .map((group) => ({ label: group.businessObject.label || 'Group', target: group.plane })),
      { label: root.group.businessObject.label || 'Group', target: root },
    ];
    trail.forEach((crumb, index) => {
      const item = document.createElement('li');
      if (crumb.target === root) {
        item.textContent = crumb.label;
        item.classList.add('landscape-breadcrumbs__current');
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = crumb.label;
        button.setAttribute('data-test--landscape-breadcrumb', String(index));
        button.addEventListener('click', () => this.canvas.setRootElement(crumb.target));
        item.appendChild(button);
      }
      this.breadcrumbs.appendChild(item);
    });
  }
}
