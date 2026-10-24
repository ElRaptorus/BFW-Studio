import type { LandscapeConnector, LandscapeElement, LandscapeMap, LandscapePoint } from '../LandscapeMapFile';

/** A canvas shape as the exporter reads it; `businessObject` is the file element the shape was created from. */
export type CanvasShapeLike = {
  x: number;
  y: number;
  width: number;
  height: number;
  businessObject: LandscapeElement;
  children?: CanvasNodeLike[];
  /** The plane of a collapsed group, which holds the group's contents. */
  plane?: { children: CanvasNodeLike[] } | null;
  /** The size of a collapsed group when expanded; this is what the file stores as its size. */
  expandedBounds?: { width: number; height: number } | null;
};

export type CanvasConnectionLike = {
  /** `connector` for a saved connector; `relation` for a derived relation line, which is never saved. */
  type?: string;
  waypoints: LandscapePoint[];
  businessObject: LandscapeConnector;
  /** The shapes the line is drawn between; for a connector inside a collapsed group these are the group. */
  source: { businessObject: LandscapeElement };
  target: { businessObject: LandscapeElement };
};

type CanvasNodeLike = CanvasShapeLike | CanvasConnectionLike;

/** The attributes for `elementFactory.createShape`; the shape carries its file element as `businessObject`. */
export function shapeAttributesOf(element: LandscapeElement): Record<string, unknown> {
  const { id, type, x, y, width, height } = element;
  return { id, type, x, y, width, height, businessObject: element };
}

/**
 * The file elements in the order the canvas needs them: every parent before its children, and bands and groups
 * before their other siblings, so they are drawn behind them.
 */
export function mapToCanvasDescriptors(map: LandscapeMap): {
  shapes: LandscapeElement[];
  connections: LandscapeConnector[];
} {
  const childrenByParentId = new Map<string | null, LandscapeElement[]>();
  for (const element of map.elements) {
    const siblings = childrenByParentId.get(element.parentId) ?? [];
    siblings.push(element);
    childrenByParentId.set(element.parentId, siblings);
  }
  const isContainer = (element: LandscapeElement): boolean => element.type === 'band' || element.type === 'group';
  const shapes: LandscapeElement[] = [];
  const visit = (parentId: string | null): void => {
    const siblings = childrenByParentId.get(parentId) ?? [];
    for (const element of [...siblings.filter(isContainer), ...siblings.filter((sibling) => !isContainer(sibling))]) {
      shapes.push(element);
      visit(element.id);
    }
  };
  visit(null);
  return { shapes, connections: map.connectors };
}

/**
 * Reads the canvas back into a map. Elements are written depth-first, so the file order follows the stacking
 * order; geometry and parents come from the canvas, every other field from the element the shape carries. A
 * collapsed group is written with its expanded size and followed by its plane's contents. A connector keeps the ends
 * its file element names, which differ from the shapes it is drawn between while a group hides them; such a
 * connector is written with the bends its file element holds, because the canvas line runs to the group.
 */
export function canvasToMap(root: { children: CanvasNodeLike[] }, previousMap: LandscapeMap): LandscapeMap {
  const elements: LandscapeElement[] = [];
  const connectors: LandscapeConnector[] = [];
  const visit = (nodes: CanvasNodeLike[], parentId: string | null): void => {
    for (const node of nodes) {
      if ('waypoints' in node) {
        if (node.type === 'relation') {
          continue;
        }
        const isDrawnAtItsEnds =
          node.source.businessObject.id === node.businessObject.sourceId &&
          node.target.businessObject.id === node.businessObject.targetId;
        const waypoints = isDrawnAtItsEnds ? node.waypoints : node.businessObject.waypoints;
        connectors.push({
          ...node.businessObject,
          waypoints: waypoints.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
        });
        continue;
      }
      const size = node.expandedBounds ?? node;
      elements.push({
        ...node.businessObject,
        parentId,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: Math.round(size.width),
        height: Math.round(size.height),
      });
      visit(node.children ?? [], node.businessObject.id);
      visit(node.plane?.children ?? [], node.businessObject.id);
    }
  };
  visit(root.children, null);
  return { ...previousMap, elements, connectors };
}
