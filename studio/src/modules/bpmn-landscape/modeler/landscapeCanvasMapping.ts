import type { LandscapeConnector, LandscapeElement, LandscapeMap, LandscapePoint } from '../LandscapeMapFile';

/** A canvas shape as the exporter reads it; `businessObject` is the file element the shape was created from. */
export type CanvasShapeLike = {
  x: number;
  y: number;
  width: number;
  height: number;
  businessObject: LandscapeElement;
  children?: CanvasNodeLike[];
};

export type CanvasConnectionLike = {
  waypoints: LandscapePoint[];
  businessObject: LandscapeConnector;
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
 * order; geometry and parents come from the canvas, every other field from the element the shape carries.
 */
export function canvasToMap(root: { children: CanvasNodeLike[] }, previousMap: LandscapeMap): LandscapeMap {
  const elements: LandscapeElement[] = [];
  const connectors: LandscapeConnector[] = [];
  const visit = (nodes: CanvasNodeLike[], parentId: string | null): void => {
    for (const node of nodes) {
      if ('waypoints' in node) {
        connectors.push({
          ...node.businessObject,
          sourceId: node.source.businessObject.id,
          targetId: node.target.businessObject.id,
          waypoints: node.waypoints.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
        });
        continue;
      }
      elements.push({
        ...node.businessObject,
        parentId,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: Math.round(node.width),
        height: Math.round(node.height),
      });
      visit(node.children ?? [], node.businessObject.id);
    }
  };
  visit(root.children, null);
  return { ...previousMap, elements, connectors };
}
