import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';

import { isCollapsedGroup, isShape, rootOf } from './landscapeHierarchy';

const isContainer = (element: any): boolean => element.type === 'group' || element.type === 'band';
/** An expanded group or band holds exactly the shapes it encloses; a collapsed group's box holds nothing. */
const holdsByEnclosure = (element: any): boolean => isContainer(element) && !isCollapsedGroup(element);

const encloses = (outer: any, inner: any): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

function isInside(element: any, ancestor: any): boolean {
  for (let current = element; current != null; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * After a group or band is created, resized or moved, it holds exactly the shapes it fully encloses: enclosed siblings
 * move in, children that stick out move to the smallest container outside the group that encloses them. The moves
 * run inside the triggering command, so one undo reverts them together.
 */
export default class LandscapeGroupMembership extends CommandInterceptor {
  static $inject = ['eventBus', 'modeling', 'elementRegistry'];

  private modeling: any;
  private elementRegistry: any;

  constructor(eventBus: EventBus, modeling: any, elementRegistry: any) {
    super(eventBus);
    this.modeling = modeling;
    this.elementRegistry = elementRegistry;

    this.postExecuted(['shape.create', 'shape.resize'], ({ context }: any) => {
      if (holdsByEnclosure(context.shape)) {
        this.updateMembership(context.shape);
      }
    });
    this.postExecuted('elements.move', ({ context }: any) => {
      for (const shape of context.shapes) {
        if (isShape(shape) && holdsByEnclosure(shape)) {
          this.updateMembership(shape);
        }
      }
    });
  }

  private updateMembership(group: any): void {
    const leaving = group.children.filter((child: any) => isShape(child) && !encloses(group, child));
    for (const child of leaving) {
      this.moveInto([child], this.enclosingContainerOutside(child, group));
    }
    const arriving = group.parent.children.filter(
      (sibling: any) => sibling !== group && isShape(sibling) && sibling.type !== 'band' && encloses(group, sibling),
    );
    if (arriving.length > 0) {
      this.moveInto(arriving, group);
    }
  }

  private enclosingContainerOutside(shape: any, group: any): any {
    const root = rootOf(group);
    const candidates = this.elementRegistry
      .filter(
        (candidate: any) =>
          holdsByEnclosure(candidate) &&
          !isInside(candidate, group) &&
          rootOf(candidate) === root &&
          encloses(candidate, shape),
      )
      .sort((first: any, second: any) => first.width * first.height - second.width * second.height);
    return candidates[0] ?? root;
  }

  private moveInto(shapes: any[], target: any): void {
    this.modeling.moveElements(shapes, { x: 0, y: 0 }, target, { autoResize: false });
  }
}
