import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';
import { add as collectionAdd, remove as collectionRemove } from 'diagram-js/lib/util/Collections';

import { UPDATE_ELEMENT_COMMAND } from './LandscapeUpdates';
import { COLLAPSED_SIZE, isCollapsedGroup, isShape, mainRootOf, placeConnection, rootOf } from './landscapeHierarchy';

const TOGGLE_COLLAPSE_COMMAND = 'landscape.toggleCollapse';
const ADD_PLANE_COMMAND = 'landscape.addPlane';
const REMOVE_PLANE_COMMAND = 'landscape.removePlane';
const REWIRE_CONNECTOR_COMMAND = 'landscape.rewireConnector';

const NO_MOVE = { x: 0, y: 0 };
/** The space a group keeps free inside its border; the top holds the title. */
const EXPANDED_PADDING = { left: 10, right: 10, top: 30, bottom: 10 };
const FALLBACK_EXPANDED_SIZE = { width: 400, height: 240 };

type Attachment = { parent: any; source: any; target: any; hidden: boolean };
type Point = { x: number; y: number };

const roundedPoints = (points: Point[]): Point[] =>
  points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));

/** Where the contents of one axis go on expand: the shift that brings them inside, and how much the group grows. */
function fitOnAxis(
  blockStart: number,
  blockLength: number,
  innerStart: number,
  innerLength: number,
): { shift: number; growth: number } {
  if (blockLength > innerLength) {
    return { shift: innerStart - blockStart, growth: blockLength - innerLength };
  }
  if (blockStart < innerStart) {
    return { shift: innerStart - blockStart, growth: 0 };
  }
  const overshoot = blockStart + blockLength - (innerStart + innerLength);
  return { shift: overshoot > 0 ? -overshoot : 0, growth: 0 };
}

/**
 * Collapsing a group puts its contents on a plane of their own and shrinks the group to a box; expanding reverses
 * that. Both run as one command, so one undo reverts them. After every toggle, connectors are re-attached to the
 * shapes that stand for their real ends on the plane they are drawn on; the real ends stay in the connector's file
 * element.
 */
export default class LandscapeCollapse extends CommandInterceptor {
  static $inject = ['eventBus', 'commandStack', 'modeling', 'canvas', 'elementRegistry', 'elementFactory', 'layouter'];

  private commandStack: any;
  private modeling: any;
  private canvas: any;
  private elementRegistry: any;
  private elementFactory: any;
  private layouter: any;

  constructor(
    eventBus: EventBus,
    commandStack: any,
    modeling: any,
    canvas: any,
    elementRegistry: any,
    elementFactory: any,
    layouter: any,
  ) {
    super(eventBus);
    this.commandStack = commandStack;
    this.modeling = modeling;
    this.canvas = canvas;
    this.elementRegistry = elementRegistry;
    this.elementFactory = elementFactory;
    this.layouter = layouter;

    this.registerCommands();

    // A moved collapsed group carries its contents, once per move even when a selection names it and its parent.
    this.postExecuted('shape.move', ({ context }: any) => {
      const { shape, delta } = context;
      if (!isCollapsedGroup(shape) || shape.plane == null || (delta.x === 0 && delta.y === 0)) {
        return;
      }
      const contents = this.contentsOf(shape);
      if (contents.length > 0) {
        this.modeling.moveElements(contents, delta, undefined, { autoResize: false });
      }
    });

    this.preExecute('shape.delete', ({ context }: any) => {
      const { shape } = context;
      if (shape.plane != null) {
        this.modeling.removeElements(this.contentsOf(shape, true));
      }
      for (const connector of this.connectorsEndingAt(shape.businessObject.id)) {
        if (connector.source !== shape && connector.target !== shape) {
          this.modeling.removeConnection(connector);
        }
      }
    });
    this.postExecuted('shape.delete', ({ context }: any) => {
      if (context.shape.plane != null) {
        this.commandStack.execute(REMOVE_PLANE_COMMAND, { group: context.shape });
      }
    });

    // A replaced shape has a new id; connectors drawn at a collapsed group still name the old one.
    this.postExecute('shape.replace', ({ context }: any) => {
      const { oldShape, newShape } = context;
      if (newShape == null) {
        return;
      }
      const oldId = oldShape.businessObject.id;
      const newId = newShape.businessObject.id;
      for (const connector of this.connectorsEndingAt(oldId)) {
        const properties = {
          ...(connector.businessObject.sourceId === oldId ? { sourceId: newId } : {}),
          ...(connector.businessObject.targetId === oldId ? { targetId: newId } : {}),
        };
        this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element: connector, properties });
      }
    });

    // A user reconnect changes the real end on the side that moved; the other side may stand for a hidden real end.
    this.postExecuted('connection.reconnect', ({ context }: any) => {
      const { connection, newSource, newTarget, oldSource, oldTarget } = context;
      if (connection.type !== 'connector') {
        return;
      }
      const changedEnds = {
        ...(newSource == null || newSource === oldSource ? {} : { sourceId: newSource.businessObject.id }),
        ...(newTarget == null || newTarget === oldTarget ? {} : { targetId: newTarget.businessObject.id }),
      };
      if (Object.keys(changedEnds).length === 0) {
        return;
      }
      // Stored bends belong to the old ends; keep them only while the line is drawn at its real ends.
      const ends = { ...connection.businessObject, ...changedEnds };
      const isDrawnAtItsEnds =
        connection.source.businessObject.id === ends.sourceId && connection.target.businessObject.id === ends.targetId;
      const properties = isDrawnAtItsEnds ? changedEnds : { ...changedEnds, waypoints: [] };
      this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element: connection, properties });
    });
  }

  toggle(group: any): void {
    this.commandStack.execute(TOGGLE_COLLAPSE_COMMAND, { group, collapse: !isCollapsedGroup(group) });
  }

  /** Creates the plane of a group that is imported collapsed; not undoable. */
  createPlane(group: any): any {
    const plane = this.elementFactory.createRoot({ id: `plane:${group.id}`, group });
    this.canvas.addRootElement(plane);
    group.plane = plane;
    return plane;
  }

  private registerCommands(): void {
    this.commandStack.register(TOGGLE_COLLAPSE_COMMAND, {
      preExecute: (context: any) => this.moveContentsToPlane(context),
      execute: (context: any) => {
        const { group, collapse } = context;
        context.oldExpandedBounds = group.expandedBounds;
        group.businessObject.collapsed = collapse;
        group.expandedBounds = collapse ? { width: group.width, height: group.height } : null;
        return [group];
      },
      // Expanding moves the contents back only now, once the group is a container again for ordering and membership.
      postExecute: (context: any) => {
        const { group, collapse } = context;
        if (collapse) {
          this.modeling.resizeShape(group, { x: group.x, y: group.y, ...COLLAPSED_SIZE });
        } else {
          const { bounds, shift } = this.expandedLayoutOf(group, context.oldExpandedBounds);
          this.modeling.resizeShape(group, bounds);
          this.moveShapes(this.contentsOf(group), group, shift);
        }
        this.syncConnectors();
        if (!collapse) {
          this.commandStack.execute(REMOVE_PLANE_COMMAND, { group });
        }
      },
      revert: (context: any) => {
        context.group.businessObject.collapsed = !context.collapse;
        context.group.expandedBounds = context.oldExpandedBounds;
        return [context.group];
      },
    });

    this.commandStack.register(ADD_PLANE_COMMAND, {
      execute: (context: any) => {
        if (context.plane == null) {
          context.plane = this.createPlane(context.group);
        } else {
          this.canvas.addRootElement(context.plane);
          context.group.plane = context.plane;
        }
        return [];
      },
      revert: (context: any) => this.detachPlane(context.group, context.plane),
    });

    this.commandStack.register(REMOVE_PLANE_COMMAND, {
      execute: (context: any) => {
        context.plane = context.group.plane;
        return this.detachPlane(context.group, context.plane);
      },
      revert: (context: any) => {
        this.canvas.addRootElement(context.plane);
        context.group.plane = context.plane;
        return [];
      },
    });

    this.commandStack.register(REWIRE_CONNECTOR_COMMAND, {
      execute: (context: any) => {
        const { connection, parent, source, target, hidden } = context;
        const { businessObject } = connection;
        context.previous = {
          parent: connection.parent,
          parentIndex: connection.parent.children.indexOf(connection),
          source: connection.source,
          target: connection.target,
          hidden: connection.hidden === true,
          waypoints: connection.waypoints,
          storedWaypoints: businessObject.waypoints,
        };
        // The file element keeps the real bends while the line is drawn to something else than its real ends.
        if (this.isDrawnAtItsEnds(connection)) {
          businessObject.waypoints = roundedPoints(connection.waypoints);
        }
        this.attach(connection, { parent, source, target, hidden });
        const endsChanged = source !== context.previous.source || target !== context.previous.target;
        const storedBends: Point[] = businessObject.waypoints;
        if (hidden) {
          connection.waypoints = [getMid(source), getMid(target)];
        } else if (endsChanged && this.isDrawnAtItsEnds(connection) && storedBends.length >= 2) {
          connection.waypoints = this.layouter.layoutConnection(
            { ...connection, waypoints: storedBends.map((point) => ({ ...point })) },
            { source, target },
          );
        } else if (endsChanged) {
          connection.waypoints = this.layouter.layoutConnection(
            { ...connection, waypoints: undefined },
            { source, target },
          );
        }
        return [connection];
      },
      revert: (context: any) => {
        const { connection, previous } = context;
        this.attach(connection, previous, previous.parentIndex);
        connection.waypoints = previous.waypoints;
        connection.businessObject.waypoints = previous.storedWaypoints;
        return [connection];
      },
    });
  }

  /** Removes a plane from the canvas; the contents are gone from it by then. */
  private detachPlane(group: any, plane: any): any[] {
    if (this.canvas.getRootElement() === plane) {
      this.canvas.setRootElement(group.parent == null ? mainRootOf(this.canvas) : rootOf(group));
    }
    this.canvas.removeRootElement(plane);
    group.plane = null;
    return [];
  }

  private moveContentsToPlane(context: any): void {
    const { group, collapse } = context;
    if (collapse) {
      this.commandStack.execute(ADD_PLANE_COMMAND, { group });
      this.moveShapes(group.children.filter(isShape), group.plane);
    }
  }

  private moveShapes(shapes: any[], target: any, delta: Point = NO_MOVE): void {
    if (shapes.length > 0) {
      this.modeling.moveElements(shapes, delta, target, { autoResize: false });
    }
  }

  /** What a collapsed group holds: its plane's children, relation lines aside. */
  private contentsOf(group: any, includeConnections = false): any[] {
    return group.plane.children.filter(
      (child: any) => child.type !== 'relation' && (includeConnections || isShape(child)),
    );
  }

  /**
   * The group's bounds on expand and how far its contents move. The contents move as one block back inside the
   * stored size when they fit; the group grows to the right and down, never to the left or up, only by the excess.
   */
  private expandedLayoutOf(
    group: any,
    expandedSize: { width: number; height: number } | null | undefined,
  ): { bounds: { x: number; y: number; width: number; height: number }; shift: Point } {
    const size = expandedSize ?? FALLBACK_EXPANDED_SIZE;
    const contents = this.contentsOf(group);
    if (contents.length === 0) {
      return { bounds: { x: group.x, y: group.y, ...size }, shift: NO_MOVE };
    }
    const left = Math.min(...contents.map((shape: any) => shape.x));
    const top = Math.min(...contents.map((shape: any) => shape.y));
    const right = Math.max(...contents.map((shape: any) => shape.x + shape.width));
    const bottom = Math.max(...contents.map((shape: any) => shape.y + shape.height));
    const horizontal = fitOnAxis(
      left,
      right - left,
      group.x + EXPANDED_PADDING.left,
      size.width - EXPANDED_PADDING.left - EXPANDED_PADDING.right,
    );
    const vertical = fitOnAxis(
      top,
      bottom - top,
      group.y + EXPANDED_PADDING.top,
      size.height - EXPANDED_PADDING.top - EXPANDED_PADDING.bottom,
    );
    return {
      bounds: { x: group.x, y: group.y, width: size.width + horizontal.growth, height: size.height + vertical.growth },
      shift: { x: horizontal.shift, y: vertical.shift },
    };
  }

  private connectorsEndingAt(elementId: string): any[] {
    return this.elementRegistry.filter(
      (element: any) =>
        element.type === 'connector' &&
        (element.businessObject.sourceId === elementId || element.businessObject.targetId === elementId),
    );
  }

  /** Re-attaches every connector to the shapes that stand for its real ends on the plane it belongs to. */
  private syncConnectors(): void {
    const mainRoot = mainRootOf(this.canvas);
    const connectors: any[] = this.elementRegistry.filter((element: any) => element.type === 'connector');
    for (const connection of connectors) {
      const realSource = this.elementRegistry.get(connection.businessObject.sourceId);
      const realTarget = this.elementRegistry.get(connection.businessObject.targetId);
      if (realSource == null || realTarget == null) {
        continue;
      }
      const placement = placeConnection(realSource, realTarget);
      const parent = placement.rootGroup?.plane ?? mainRoot;
      // A connector between a group and something inside it has nothing to draw while the group is collapsed.
      const hidden = placement.source === placement.target;
      const isUpToDate =
        rootOf(connection) === parent &&
        connection.source === placement.source &&
        connection.target === placement.target &&
        (connection.hidden === true) === hidden;
      if (!isUpToDate) {
        this.commandStack.execute(REWIRE_CONNECTOR_COMMAND, {
          connection,
          parent,
          source: placement.source,
          target: placement.target,
          hidden,
        });
      }
    }
  }

  /** Whether the line is drawn between the shapes of its real ends, not between groups that stand for them. */
  private isDrawnAtItsEnds(connection: any): boolean {
    return (
      connection.source.businessObject.id === connection.businessObject.sourceId &&
      connection.target.businessObject.id === connection.businessObject.targetId
    );
  }

  private attach(connection: any, attachment: Attachment, parentIndex?: number): void {
    if (connection.parent !== attachment.parent) {
      collectionRemove(connection.parent.children, connection);
      collectionAdd(attachment.parent.children, connection, parentIndex);
      connection.parent = attachment.parent;
    }
    if (connection.source !== attachment.source) {
      collectionRemove(connection.source.outgoing, connection);
      collectionAdd(attachment.source.outgoing, connection);
      connection.source = attachment.source;
    }
    if (connection.target !== attachment.target) {
      collectionRemove(connection.target.incoming, connection);
      collectionAdd(attachment.target.incoming, connection);
      connection.target = attachment.target;
    }
    connection.hidden = attachment.hidden;
  }
}
