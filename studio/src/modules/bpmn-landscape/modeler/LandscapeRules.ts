import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

import { createElementId } from '../LandscapeMapFile';
import { isCollapsedGroup } from './landscapeHierarchy';

const isConnection = (element: any): boolean => element.waypoints != null;
const isRelation = (element: any): boolean => element?.type === 'relation';

/**
 * The top-level root holds everything; a plane holds everything but bands; groups and bands hold everything but
 * bands, except a collapsed group, which holds nothing until it is expanded.
 */
function canContain(target: any, elementType: string): boolean {
  if (target == null || isConnection(target)) {
    return false;
  }
  if (target.businessObject == null) {
    return target.group == null || elementType !== 'band';
  }
  return (target.type === 'group' || target.type === 'band') && !isCollapsedGroup(target) && elementType !== 'band';
}

/**
 * Groups dropped on an element that holds nothing, a collapsed group included, go into that element's parent, see
 * `LandscapeOrdering`.
 */
function containerFor(target: any, shapes: any[]): any {
  const isOpenContainer = (target?.type === 'group' && !isCollapsedGroup(target)) || target?.type === 'band';
  if (target?.businessObject == null || isConnection(target) || isOpenContainer) {
    return target;
  }
  return shapes.every((shape) => shape.type === 'group') ? target.parent : target;
}

/** Bands and lines are no ends of a connector. */
const isConnectorEnd = (element: any): boolean =>
  element?.businessObject != null && !isConnection(element) && element.type !== 'band';

/** Connectors run between two different map elements. */
function canConnect(source: any, target: any): boolean {
  return isConnectorEnd(source) && isConnectorEnd(target) && source !== target;
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

    // Relation lines are derived: they are hidden, never deleted, and follow their shapes. A hidden connector, between
    // a collapsed group and its contents, can only be lassoed by accident.
    this.addRule('elements.delete', ({ elements }: any) => {
      const removable = elements.filter((element: any) => !isRelation(element) && element.hidden !== true);
      return removable.length === 0 ? false : removable;
    });

    this.addRule('shape.resize', ({ shape }: any) => !isCollapsedGroup(shape));
    this.addRule(
      'element.autoResize',
      ({ target }: any) => (target?.type === 'group' || target?.type === 'band') && !isCollapsedGroup(target),
    );

    // The global connect tool asks this before it lets the user start a connector at an element.
    this.addRule('connection.start', ({ source }: any) => isConnectorEnd(source));

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

    // A pasted process would always be a second shape of the same process on this map, and a collapsed group would
    // paste without its contents.
    this.addRule(
      'element.copy',
      ({ element }: any) =>
        element.type !== 'process' && !isRelation(element) && !isCollapsedGroup(element) && element.hidden !== true,
    );
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
