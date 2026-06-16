import { type Root, createRoot } from 'react-dom/client';

import type BpmnModelerComponentAdapter from '../BpmnModelerComponentAdapter';
import type { BpmnViewerComponentAdapter } from '../BpmnViewerComponentAdapter';
import { renderBpmnElementOverlays } from './BpmnElementOverlaysRenderer';

export type Overlay = Overlay_FullCover | Overlay_PartialCover | Overlay_Positioned;

export type Overlay_FullCover = {
  type: 'full_cover';
  elementId: string;
  cssClassName: string;
};

export type Overlay_PartialCover = {
  type: 'partial_cover';
  elementId: string;
  cssClassName: string;
  height: number;
  width: number;
};

export type Overlay_Positioned = {
  type: 'positioned';
  elementId: string;
  position: OverlayPosition;
  overlayElement: React.ComponentType<any>;
  overlayProps: Record<string, any>;
};

export enum OverlayPosition {
  topLeft = 'topLeft',
  topRight = 'topRight',
  middleLeft = 'middleLeft',
  middleRight = 'middleRight',
  bottomLeft = 'bottomLeft',
  bottomRight = 'bottomRight',
  below = 'below',
}

type ElementOverlayGroups = { [elementId: string]: ElementOverlay };
type ElementOverlay = {
  cssClassName: string;
  partialCovers: Overlay_PartialCover[];
  positionedOverlays: Overlay_Positioned[];
};

type TrackedOverlay = {
  overlayId: string;
  fingerprint: string;
  reactRoot: Root | null;
};

export default class BpmnElementOverlayManager {
  private bpmnComponentAdapter: BpmnModelerComponentAdapter | BpmnViewerComponentAdapter | null;
  private activeOverlays: Map<string, TrackedOverlay> = new Map();

  constructor(bpmnComponentAdapter: BpmnModelerComponentAdapter | BpmnViewerComponentAdapter) {
    this.bpmnComponentAdapter = bpmnComponentAdapter;
  }

  updateAll(overlays: Overlay[]): void {
    const newGroups = groupOverlaysByElement(overlays);
    const newEntries = new Map<string, { group: ElementOverlay; fingerprint: string }>();

    for (const [elementId, group] of Object.entries(newGroups)) {
      newEntries.set(elementId, { group, fingerprint: computeFingerprint(group) });
    }

    for (const [elementId, tracked] of this.activeOverlays) {
      if (!newEntries.has(elementId)) {
        this.removeTrackedOverlay(tracked);
        this.activeOverlays.delete(elementId);
      }
    }

    for (const [elementId, { group, fingerprint }] of newEntries) {
      const existing = this.activeOverlays.get(elementId);

      if (existing != null && existing.fingerprint === fingerprint) {
        continue;
      }

      if (existing != null) {
        this.removeTrackedOverlay(existing);
      }

      this.addTrackedOverlay(elementId, group, fingerprint);
    }
  }

  update(elementId: string, overlays: Overlay[]): void {
    const group = groupOverlaysForElement(overlays);
    const fingerprint = computeFingerprint(group);

    const existing = this.activeOverlays.get(elementId);

    if (existing != null && existing.fingerprint === fingerprint) {
      return;
    }

    if (existing != null) {
      this.removeTrackedOverlay(existing);
    }

    this.addTrackedOverlay(elementId, group, fingerprint);
  }

  dispose(): void {
    for (const tracked of this.activeOverlays.values()) {
      this.removeTrackedOverlay(tracked);
    }
    this.activeOverlays.clear();
    this.bpmnComponentAdapter = null;
  }

  private addTrackedOverlay(elementId: string, group: ElementOverlay, fingerprint: string): void {
    if (!this.bpmnComponentAdapter) {
      return;
    }

    const shape = this.bpmnComponentAdapter.getElementRegistry().get(elementId);
    if (!shape) {
      return;
    }

    const reactElement = renderBpmnElementOverlays({
      width: shape.width || 0,
      height: shape.height || 0,
      cssClassName: group.cssClassName,
      partialCovers: group.partialCovers,
      positionedOverlays: group.positionedOverlays,
    });

    const containerId = `bifrost-bpmn-overlay-${crypto.randomUUID()}`;
    const containerMarkup = `<div id="${containerId}" style="pointer-events:none"></div>`;
    const type = shape.type.replace('bpmn:', '').toLowerCase();

    const overlayService = this.bpmnComponentAdapter.getOverlays();
    const overlayId = overlayService.add(elementId, type, {
      position: { top: 0, left: 0 },
      html: containerMarkup,
    });

    const overlayObject = overlayService.get(overlayId) as any;
    if (overlayObject?.htmlContainer instanceof HTMLElement) {
      overlayObject.htmlContainer.style.pointerEvents = 'none';
    }

    let reactRoot: Root | null = null;
    const container = document.querySelector(`#${containerId}`);
    if (container) {
      reactRoot = createRoot(container);
      reactRoot.render(reactElement);
    }

    this.activeOverlays.set(elementId, { overlayId, fingerprint, reactRoot });
  }

  private removeTrackedOverlay(tracked: TrackedOverlay): void {
    if (!this.bpmnComponentAdapter) {
      return;
    }

    tracked.reactRoot?.unmount();

    try {
      this.bpmnComponentAdapter.getOverlays().remove(tracked.overlayId);
    } catch {
      // overlay may already have been removed (e.g., element deleted from canvas)
    }
  }
}

function groupOverlaysByElement(overlays: Overlay[]): ElementOverlayGroups {
  const groups: ElementOverlayGroups = {};

  for (const overlay of overlays) {
    if (!groups[overlay.elementId]) {
      groups[overlay.elementId] = { cssClassName: '', partialCovers: [], positionedOverlays: [] };
    }

    if (overlay.type === 'full_cover') {
      groups[overlay.elementId].cssClassName += ` ${overlay.cssClassName}`;
    } else if (overlay.type === 'partial_cover') {
      groups[overlay.elementId].partialCovers.push(overlay);
    } else if (overlay.type === 'positioned') {
      groups[overlay.elementId].positionedOverlays.push(overlay);
    }
  }

  return groups;
}

function groupOverlaysForElement(overlays: Overlay[]): ElementOverlay {
  const group: ElementOverlay = { cssClassName: '', partialCovers: [], positionedOverlays: [] };

  for (const overlay of overlays) {
    if (overlay.type === 'full_cover') {
      group.cssClassName += ` ${overlay.cssClassName}`;
    } else if (overlay.type === 'partial_cover') {
      group.partialCovers.push(overlay);
    } else if (overlay.type === 'positioned') {
      group.positionedOverlays.push(overlay);
    }
  }

  return group;
}

function computeFingerprint(group: ElementOverlay): string {
  const parts: string[] = [group.cssClassName.trim()];

  for (const cover of group.partialCovers) {
    parts.push(`pc:${cover.cssClassName}:${cover.width}x${cover.height}`);
  }

  for (const overlay of group.positionedOverlays) {
    const name = overlay.overlayElement.displayName || overlay.overlayElement.name || 'anonymous';
    parts.push(`po:${overlay.position}:${name}`);
  }

  return parts.join('|');
}
