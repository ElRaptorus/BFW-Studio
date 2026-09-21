import type EventBus from 'diagram-js/lib/core/EventBus';

const BFW_PREFIX = 'bfw:';

/**
 * Filters `bfw:` extension properties during copy-paste so that task-specific
 * extensions do not leak onto incompatible target element types.
 *
 * The moddle descriptor's `meta.allowedIn` is used as the source of truth:
 * if the pasted target element's type is not in the property's `allowedIn`
 * list, the property is dropped.
 */
function BfwCopyPasteBehavior(this: any, eventBus: EventBus, moddle: any) {
  eventBus.on('moddleCopy.canCopyProperty', (event: any) => {
    const property = event.property;
    if (property == null || typeof property !== 'object') {
      return;
    }

    const propertyType: string | undefined = property.$type;
    if (propertyType == null || !propertyType.startsWith(BFW_PREFIX)) {
      return;
    }

    const targetElement = event.parent;
    if (targetElement == null) {
      return;
    }

    const targetType = resolveHostType(targetElement);
    if (targetType == null) {
      return;
    }

    const descriptor = moddle.getTypeDescriptor(propertyType);
    const allowedIn: string[] | undefined = descriptor?.meta?.allowedIn;

    if (allowedIn == null || allowedIn.includes('*')) {
      return;
    }

    if (!allowedIn.includes(targetType)) {
      return false;
    }
  });
}

function resolveHostType(moddleElement: any): string | null {
  let current = moddleElement;
  while (current != null) {
    const type: string | undefined = current.$type;
    if (type != null && !type.endsWith('ExtensionElements') && !type.startsWith('bfw:')) {
      return type;
    }
    current = current.$parent;
  }
  return null;
}

(BfwCopyPasteBehavior as any).$inject = ['eventBus', 'moddle'];

export default BfwCopyPasteBehavior;
