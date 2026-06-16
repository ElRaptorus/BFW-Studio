import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { ElementLike } from 'diagram-js/lib/model/Types';

export function UpdateBusinessObjectListHandler(this: any, elementRegistry: ElementRegistry, bpmnFactory: any): void {
  this._elementRegistry = elementRegistry;
  this._bpmnFactory = bpmnFactory;
}

UpdateBusinessObjectListHandler.$inject = ['elementRegistry', 'bpmnFactory'];

function ensureNotNull<T>(prop: T | null | undefined, name: string): T {
  if (!prop) {
    throw new Error(name + 'required');
  }
  return prop;
}

UpdateBusinessObjectListHandler.prototype.execute = function (context: any): ElementLike[] {
  const currentObject = ensureNotNull(context.currentObject, 'currentObject'),
    propertyName = ensureNotNull(context.propertyName, 'propertyName'),
    updatedObjectList = context.updatedObjectList,
    objectsToRemove = context.objectsToRemove || [],
    objectsToAdd = context.objectsToAdd || [],
    changed = [context.element],
    referencePropertyName = context.referencePropertyName ? context.referencePropertyName : undefined;

  const objectList = currentObject[propertyName] ?? [];

  context.previousList = currentObject[propertyName];

  if (updatedObjectList) {
    currentObject[propertyName] = updatedObjectList;
  } else {
    let listCopy: any = [];
    // remove all objects which should be removed
    objectList.forEach((object) => {
      if (objectsToRemove.indexOf(object) == -1) {
        listCopy.push(object);
      }
    });

    // add all objects which should be added
    listCopy = listCopy.concat(objectsToAdd);

    // set property to new list
    if (listCopy.length > 0 || !referencePropertyName) {
      // as long as there are elements in the list update the list
      currentObject[propertyName] = listCopy;
    } else if (referencePropertyName) {
      // remove the list when it is empty
      const parentObject = currentObject.$parent;
      parentObject.set(referencePropertyName, undefined);
    }
  }

  context.changed = changed;

  return changed;
};

UpdateBusinessObjectListHandler.prototype.revert = function (context: any): ElementLike[] {
  const currentObject = context.currentObject,
    propertyName = context.propertyName,
    previousList = context.previousList,
    parentObject = currentObject.$parent;

  if (context.referencePropertyName) {
    parentObject.set(context.referencePropertyName, currentObject);
  }

  // remove new element
  currentObject.set(propertyName, previousList);

  return context.changed;
};

export default UpdateBusinessObjectListHandler;
