import type {
  LandscapeElementEvent,
  LandscapeElementSnapshot,
  LandscapeShapeSnapshot,
} from '@elraptorus/bfw_studio_sdk';

import type { LandscapeElement } from '../LandscapeMapFile';
import { resolveRelativeUri } from '../LandscapeMapFile';
import type LandscapeModeler from '../modeler/LandscapeModeler';
import { logicalParentOf, rootOf } from '../modeler/landscapeHierarchy';

/** What a plugin sees of one canvas element: the file element plus the geometry and parent the canvas holds. */
export function snapshotOfCanvasElement(mapUri: string, element: any): LandscapeElementSnapshot {
  if (element.type === 'connector') {
    const { sourceId, targetId, label } = element.businessObject;
    return { id: element.id, type: 'connector', sourceId, targetId, label };
  }
  const file: LandscapeElement = element.businessObject;
  const shape: LandscapeShapeSnapshot = {
    id: element.id,
    type: file.type,
    parentId: logicalParentOf(element)?.id ?? null,
    x: Math.round(element.x),
    y: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
    label: file.type === 'note' ? null : file.label,
    text: file.type === 'note' ? file.text : null,
    processId: file.type === 'process' ? file.processId : null,
    fileHint: file.type === 'process' ? file.fileHint : null,
    mapUri: file.type === 'mapLink' ? resolveRelativeUri(mapUri, file.mapPath) : null,
    style: file.style == null ? null : { fill: file.style.fill, stroke: file.style.stroke },
    shape: file.type === 'process' || file.type === 'placeholder' ? file.shape : null,
    collapsed: file.type === 'group' ? file.collapsed : null,
  };
  return shape;
}

/**
 * The elements of a map as snapshots. `plane` is what is on screen (the map or the open group, hidden connectors
 * left out); `all` is every element of every plane.
 */
export function snapshotLandscapeElements(
  modeler: LandscapeModeler,
  mapUri: string,
  scope: 'plane' | 'all',
): LandscapeElementSnapshot[] {
  const currentRoot = modeler.get('canvas').getRootElement();
  return modeler
    .get('elementRegistry')
    .filter(
      (element: any) =>
        element.parent != null &&
        element.businessObject != null &&
        (scope === 'all' || (rootOf(element) === currentRoot && element.hidden !== true)),
    )
    .map((element: any) => snapshotOfCanvasElement(mapUri, element));
}

/** The text a plugin reads as an element's name: the label or the text of a note. */
export function elementNameOf(snapshot: LandscapeElementSnapshot): string | null {
  if (snapshot.type === 'connector') {
    return snapshot.label === '' ? null : snapshot.label;
  }
  return snapshot.label ?? snapshot.text;
}

export function elementEventOf(snapshot: LandscapeElementSnapshot): LandscapeElementEvent {
  return { elementId: snapshot.id, elementType: snapshot.type, elementName: elementNameOf(snapshot) };
}

/** Changes whenever a plugin's overlay factory could return something else for the element. */
export const fingerprintOfSnapshot = (snapshot: LandscapeElementSnapshot): string => JSON.stringify(snapshot);
