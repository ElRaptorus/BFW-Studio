import { is } from 'bpmn-js/lib/util/ModelUtil';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import { getRoot } from './Utils/Utils';

function getProperties(businessObject: any, propertyNames: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  propertyNames.forEach((name) => {
    result[name] = businessObject.get(name);
  });

  return result;
}

function setProperties(businessObject: any, properties: Record<string, unknown>): void {
  Object.entries(properties).forEach((property) => {
    businessObject.set(property[0], property[1]);
  });
}

export function UpdateBusinessObjectHandler(this: any, elementRegistry: ElementRegistry): void {
  this.elementRegistry = elementRegistry;
}

UpdateBusinessObjectHandler.$inject = ['elementRegistry'];

UpdateBusinessObjectHandler.prototype.execute = (context: any): ElementLike[] => {
  const { element, businessObject, referenceType, referenceProperty, properties } = context;
  const rootElements = getRoot(businessObject).rootElements;
  const changed = [element];

  if (!element) {
    throw new Error('element required');
  }

  if (!businessObject) {
    throw new Error('businessObject required');
  }

  const oldProperties = context.oldProperties || getProperties(businessObject, Object.keys(properties));

  // check if there the update needs an external element for reference
  if (typeof referenceType !== 'undefined' && typeof referenceProperty !== 'undefined') {
    Object.entries(rootElements).forEach((element) => {
      const rootElement: any = element[1];
      if (is(rootElement, referenceType)) {
        if (rootElement.id === properties[referenceProperty]) {
          properties[referenceProperty] = rootElement;
        }
      }
    });
  }

  setProperties(businessObject, properties);

  context.oldProperties = oldProperties;
  context.changed = changed;

  return changed;
};

UpdateBusinessObjectHandler.prototype.revert = (context: any): ElementLike[] => {
  const { oldProperties, businessObject } = context;

  setProperties(businessObject, oldProperties);

  return context.changed;
};

export default UpdateBusinessObjectHandler;
