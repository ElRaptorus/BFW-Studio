/**
 * Helpers on diagram-js shapes for the group hierarchy. A collapsed group owns a plane: a root element
 * (`plane.group` is the group, `group.plane` the plane) that holds the group's contents. Everything else lives on the
 * map's top-level root, which has neither a business object nor a `group`.
 */

export const COLLAPSED_SIZE = { width: 200, height: 80 };

export const isShape = (element: any): boolean => element.waypoints == null;

export const isCollapsedGroup = (element: any): boolean =>
  element?.type === 'group' && element.businessObject.collapsed === true;

/** The group or band a shape belongs to, seen through planes; `null` for a shape on the map's top level. */
export function logicalParentOf(shape: any): any | null {
  const parent = shape.parent;
  if (parent == null) {
    return null;
  }
  if (parent.group != null) {
    return parent.group;
  }
  return parent.businessObject == null ? null : parent;
}

/** The collapsed groups above a shape, innermost first. */
export function collapsedAncestorsOf(shape: any): any[] {
  const ancestors: any[] = [];
  for (let ancestor = logicalParentOf(shape); ancestor != null; ancestor = logicalParentOf(ancestor)) {
    if (isCollapsedGroup(ancestor)) {
      ancestors.push(ancestor);
    }
  }
  return ancestors;
}

/** How many groups hold the group; bands are not levels. */
export function levelDepthOf(group: any): number {
  let depth = 0;
  for (let ancestor = logicalParentOf(group); ancestor != null; ancestor = logicalParentOf(ancestor)) {
    if (ancestor.type === 'group') {
      depth++;
    }
  }
  return depth;
}

/**
 * What stands for the shape on the root of `rootGroup` (`null` is the top-level root): the shape itself, or its
 * outermost collapsed ancestor below that root. `null` when the shape is not on that root's side of the hierarchy.
 */
export function representativeOf(shape: any, rootGroup: any | null): any | null {
  let representative = shape;
  let ancestor = logicalParentOf(shape);
  while (ancestor != null && ancestor !== rootGroup) {
    if (isCollapsedGroup(ancestor)) {
      representative = ancestor;
    }
    ancestor = logicalParentOf(ancestor);
  }
  return ancestor === rootGroup ? representative : null;
}

/**
 * Where a connector between two real elements is drawn: on the plane of their innermost shared collapsed group, or on
 * the top-level root, between the shapes that stand for the two ends there.
 */
export function placeConnection(source: any, target: any): { rootGroup: any | null; source: any; target: any } {
  const targetAncestors = collapsedAncestorsOf(target);
  const rootGroup = collapsedAncestorsOf(source).find((group) => targetAncestors.includes(group)) ?? null;
  return { rootGroup, source: representativeOf(source, rootGroup), target: representativeOf(target, rootGroup) };
}

export function rootOf(element: any): any {
  let current = element;
  while (current.parent != null) {
    current = current.parent;
  }
  return current;
}

export const mainRootOf = (canvas: any): any => canvas.getRootElements().find((root: any) => root.group == null);
