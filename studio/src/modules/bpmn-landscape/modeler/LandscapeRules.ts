import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

import { createElementId } from '../LandscapeMapFile';

const isConnection = (element: any): boolean => element.waypoints != null;
const isRelation = (element: any): boolean => element?.type === 'relation';

/** The root holds everything; groups and bands hold everything but bands; nothing else holds elements. */
function canContain(target: any, elementType: string): boolean {
  if (target == null || isConnection(target)) {
    return false;
  }
  if (target.businessObject == null) {
    return true;
  }
  return (target.type === 'group' || target.type === 'band') && elementType !== 'band';
}

/** Groups dropped on an element that holds nothing go into that element's parent, see `LandscapeOrdering`. */
function containerFor(target: any, shapes: any[]): any {
  if (target?.businessObject == null || isConnection(target) || target.type === 'group' || target.type === 'band') {
    return target;
  }
  return shapes.every((shape) => shape.type === 'group') ? target.parent : target;
}

/** Connectors run between two different map elements; bands and lines are no ends. */
function canConnect(source: any, target: any): boolean {
  const isEnd = (element: any): boolean =>
    element?.businessObject != null && !isConnection(element) && element.type !== 'band';
  return isEnd(source) && isEnd(target) && source !== target;
}

export default class LandscapeRules extends RuleProvider {
  static $inject = ['eventBus', 'elementRegistry'];

  private elementRegistry: ElementRegistry;

  constructor(eventBus: EventBus, elementRegistry: ElementRegistry) {
    super(eventBus);
    this.elementRegistry = elementRegistry;
    // Segment moves never ask the `connection.updateWaypoints` rule.
    eventBus.on('connectionSegment.move.init', ({ connection }: any) => (isRelation(connection) ? false : undefined));
  }

  init(): void {
    this.addRule(
      'shape.create',
      ({ shape, target }: any) => !this.isProcessOnMap(shape) && canContain(containerFor(target, [shape]), shape.type),
    );

    this.addRule('elements.create', ({ elements, target }: any) => {
      const shapes = elements.filter((element: any) => !isConnection(element));
      const topLevel = shapes.filter((shape: any) => shape.parent == null || !elements.includes(shape.parent));
      const container = containerFor(target, topLevel);
      return (
        shapes.every((shape: any) => !this.isProcessOnMap(shape)) &&
        topLevel.every((shape: any) => canContain(container, shape.type))
      );
    });

    this.addRule('elements.move', ({ shapes, target }: any) => {
      if (shapes.every(isRelation)) {
        return false;
      }
      if (target == null) {
        return true;
      }
      const container = containerFor(target, shapes);
      return shapes
        .filter((shape: any) => !isConnection(shape))
        .every((shape: any) => canContain(container, shape.type));
    });

    // Relation lines are derived: they are hidden, never deleted, and follow their shapes.
    this.addRule('elements.delete', ({ elements }: any) => {
      const removable = elements.filter((element: any) => !isRelation(element));
      return removable.length === 0 ? false : removable;
    });

    this.addRule('shape.resize', () => true);
    this.addRule('element.autoResize', ({ target }: any) => target?.type === 'group' || target?.type === 'band');

    this.addRule('connection.create', ({ source, target }: any) =>
      canConnect(source, target)
        ? { type: 'connector', id: createElementId('connector', (id) => this.elementRegistry.get(id) != null) }
        : false,
    );
    this.addRule(
      'connection.reconnect',
      ({ connection, source, target }: any) => connection.type === 'connector' && canConnect(source, target),
    );
    this.addRule('connection.updateWaypoints', ({ connection }: any) => !isRelation(connection));

    // A pasted process would always be a second shape of the same process on this map.
    this.addRule('element.copy', ({ element }: any) => element.type !== 'process' && !isRelation(element));
  }

  private isProcessOnMap(shape: any): boolean {
    if (shape.type !== 'process') {
      return false;
    }
    const processId = shape.businessObject.processId;
    return (
      this.elementRegistry.find(
        (element: any) =>
          element !== shape && element.type === 'process' && element.businessObject.processId === processId,
      ) != null
    );
  }
}
