import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';

import type { RelationLine } from '../buildRelationLines';

const RELATION_TYPE = 'relation';
const PARALLEL_LINE_SPACING = 12;

const isOnCanvas = (elementRegistry: ElementRegistry, element: any): boolean =>
  element != null && elementRegistry.get(element.id) === element;

/**
 * Shows the derived relation lines as connections of type `relation`, attached to their shapes so they follow a
 * drag. The lines are changed without commands. Commands may still hold a line (a deleted shape takes its lines
 * along), so lines are kept by id rather than rebuilt: an undo then restores the same object the diff keeps.
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
  }

  show(lines: RelationLine[]): void {
    const wanted = new Map(lines.map((line) => [line.id, line]));
    const relationConnections: any[] = this.elementRegistry.filter((element: any) => element.type === RELATION_TYPE);
    for (const connection of relationConnections) {
      const line = wanted.get(connection.id);
      const endsOnCanvas =
        isOnCanvas(this.elementRegistry, connection.source) && isOnCanvas(this.elementRegistry, connection.target);
      if (line == null || !endsOnCanvas) {
        this.canvas.removeConnection(connection);
        connection.source = null;
        connection.target = null;
        continue;
      }
      connection.businessObject = line;
    }

    const root = this.canvas.getRootElement();
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
        source,
        target,
        waypoints: [getMid(source as any), getMid(target as any)],
        businessObject: line,
      });
      this.canvas.addConnection(connection, root);
    }

    this.layoutAll();
  }

  /** Lines between the same two shapes are spread apart, so they do not cover each other. */
  private layoutAll(): void {
    const connections = this.elementRegistry.filter((element: any) => element.type === RELATION_TYPE);
    const connectionsByPair = new Map<string, any[]>();
    for (const connection of connections) {
      const pair = [connection.source.id, connection.target.id].sort().join('\n');
      connectionsByPair.set(pair, [...(connectionsByPair.get(pair) ?? []), connection]);
    }
    for (const pairConnections of connectionsByPair.values()) {
      pairConnections.sort((first, second) => first.id.localeCompare(second.id));
      pairConnections.forEach((connection, index) => {
        const offset = (index - (pairConnections.length - 1) / 2) * PARALLEL_LINE_SPACING;
        const sourceMid = getMid(connection.source);
        const targetMid = getMid(connection.target);
        connection.waypoints = this.layouter.layoutConnection(
          { ...connection, waypoints: undefined },
          {
            source: connection.source,
            target: connection.target,
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
