import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { ElementLike } from 'diagram-js/lib/model/Types';

export function UpdateBusinessObjectListHandler(this: any, elementRegistry: ElementRegistry): void {
  this._elementRegistry = elementRegistry;
}

UpdateBusinessObjectListHandler.$inject = ['elementRegistry'];

function ensureNotNull<T>(prop: T | null | undefined, name: string): T {
  if (!prop) {
    throw new Error(name + ' required');
  }
  return prop;
}

UpdateBusinessObjectListHandler.prototype.execute = function (context: any): ElementLike[] {
  const currentObject = ensureNotNull(context.currentObject, 'currentObject');
  const propertyName = ensureNotNull(context.propertyName, 'propertyName');
  const updatedObjectList = context.updatedObjectList;
  const objectsToRemove = context.objectsToRemove || [];
  const objectsToAdd = context.objectsToAdd || [];
  const changed = [context.element];
  const referencePropertyName: string | undefined = context.referencePropertyName;

  const objectList = currentObject[propertyName] ?? [];
  context.previousList = currentObject[propertyName];

  if (updatedObjectList) {
    currentObject[propertyName] = updatedObjectList;
  } else {
    let listCopy: any[] = objectList.filter((object: any) => objectsToRemove.indexOf(object) === -1);
    listCopy = listCopy.concat(objectsToAdd);

    if (listCopy.length > 0 || !referencePropertyName) {
      currentObject[propertyName] = listCopy;
    } else if (referencePropertyName) {
      const parentObject = currentObject.$parent;
      parentObject.set(referencePropertyName, undefined);
    }
  }

  context.changed = changed;
  return changed;
};

UpdateBusinessObjectListHandler.prototype.revert = function (context: any): ElementLike[] {
  const currentObject = context.currentObject;
  const propertyName = context.propertyName;
  const previousList = context.previousList;
  const parentObject = currentObject.$parent;

  if (context.referencePropertyName) {
    parentObject.set(context.referencePropertyName, currentObject);
  }

  currentObject.set(propertyName, previousList);
  return context.changed;
};

export default UpdateBusinessObjectListHandler;
