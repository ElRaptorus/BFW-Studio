import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';

import type { RelationLine } from '../buildRelationLines';

const RELATION_TYPE = 'relation';
const PARALLEL_LINE_SPACING = 12;

/**
 * Shows the derived relation lines as connections of type `relation`. A line is not bound to its shapes: it has no
 * `source` and `target`, so it never enters the `incoming` and `outgoing` lists that diagram-js follows when it moves
 * or deletes a shape, and no command ever holds it. The shapes it joins are kept as `relationSource` and
 * `relationTarget`; every change of the map lays the lines out again, so a line follows its shapes after the move.
 * The lines are changed without commands.
 */
export default class LandscapeRelationLayer {
  static $inject = ['eventBus', 'canvas', 'elementRegistry', 'elementFactory', 'layouter'];

  private readonly eventBus: EventBus;
  private readonly canvas: Canvas;
  private readonly elementRegistry: ElementRegistry;
  private readonly elementFactory: any;
  private readonly layouter: any;

  constructor(
    eventBus: EventBus,
    canvas: Canvas,
    elementRegistry: ElementRegistry,
    elementFactory: any,
    layouter: any,
  ) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.elementRegistry = elementRegistry;
    this.elementFactory = elementFactory;
    this.layouter = layouter;

    // A line in a selection that is moved stays where it is; the shapes move and the lines follow afterwards.
    eventBus.on('shape.move.start', 1400, ({ context }: any) => {
      context.shapes = context.shapes.filter((shape: any) => shape.type !== RELATION_TYPE);
      context.validatedShapes = context.shapes;
      if (context.shapes.length === 0) {
        return false;
      }
      return undefined;
    });
    eventBus.on('commandStack.elements.move.preExecute', 2000, ({ context }: any) => {
      context.shapes = context.shapes.filter((shape: any) => shape.type !== RELATION_TYPE);
    });
  }

  show(lines: RelationLine[]): void {
    const wanted = new Map(lines.map((line) => [line.id, line]));
    const root = this.canvas.getRootElement();
    const relationConnections: any[] = this.elementRegistry.filter((element: any) => element.type === RELATION_TYPE);
    for (const connection of relationConnections) {
      const line = wanted.get(connection.id);
      const source = line == null ? undefined : this.elementRegistry.get(line.sourceElementId);
      const target = line == null ? undefined : this.elementRegistry.get(line.targetElementId);
      // Undoing a collapse removes the plane, and with it the graphics of a line drawn there.
      if (line == null || source == null || target == null || connection.parent !== root) {
        this.canvas.removeConnection(connection);
        continue;
      }
      connection.businessObject = line;
      connection.relationSource = source;
      connection.relationTarget = target;
    }

    for (const line of lines) {
      if (this.elementRegistry.get(line.id) != null) {
        continue;
      }
      const source = this.elementRegistry.get(line.sourceElementId);
      const target = this.elementRegistry.get(line.targetElementId);
      if (source == null || target == null) {
        continue;
      }
      const connection = this.elementFactory.createConnection({
        id: line.id,
        type: RELATION_TYPE,
        waypoints: [getMid(source as any), getMid(target as any)],
        businessObject: line,
      });
      connection.relationSource = source;
      connection.relationTarget = target;
      this.canvas.addConnection(connection, root);
    }

    this.layoutAll();
  }

  /** Lines between the same two shapes are spread apart, so they do not cover each other. */
  private layoutAll(): void {
    const connections = this.elementRegistry.filter((element: any) => element.type === RELATION_TYPE);
    const connectionsByPair = new Map<string, any[]>();
    for (const connection of connections) {
      const pair = [connection.relationSource.id, connection.relationTarget.id].sort().join('\n');
      connectionsByPair.set(pair, [...(connectionsByPair.get(pair) ?? []), connection]);
    }
    for (const pairConnections of connectionsByPair.values()) {
      pairConnections.sort((first, second) => first.id.localeCompare(second.id));
      pairConnections.forEach((connection, index) => {
        const offset = (index - (pairConnections.length - 1) / 2) * PARALLEL_LINE_SPACING;
        const sourceMid = getMid(connection.relationSource);
        const targetMid = getMid(connection.relationTarget);
        connection.waypoints = this.layouter.layoutConnection(
          { ...connection, waypoints: undefined },
          {
            source: connection.relationSource,
            target: connection.relationTarget,
            connectionStart: { x: sourceMid.x, y: sourceMid.y + offset },
            connectionEnd: { x: targetMid.x, y: targetMid.y + offset },
          },
        );
      });
    }
    if (connections.length > 0) {
      this.eventBus.fire('elements.changed', { elements: connections });
    }
  }
}
