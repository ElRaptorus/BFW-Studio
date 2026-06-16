import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { ElementLike } from 'diagram-js/lib/model/Types';

function getProperties(businessObject: any, propertyNames: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  propertyNames.forEach((name) => {
    result[name] = businessObject.get(name);
  });
  return result;
}

function setProperties(businessObject: any, properties: Record<string, unknown>): void {
  Object.entries(properties).forEach(([key, value]) => {
    businessObject.set(key, value);
  });
}

export function UpdateBusinessObjectHandler(this: any, elementRegistry: ElementRegistry): void {
  this.elementRegistry = elementRegistry;
}

UpdateBusinessObjectHandler.$inject = ['elementRegistry'];

UpdateBusinessObjectHandler.prototype.execute = (context: any): ElementLike[] => {
  const { element, businessObject, properties } = context;
  const changed = [element];

  if (!element) {
    throw new Error('element required');
  }
  if (!businessObject) {
    throw new Error('businessObject required');
  }

  const oldProperties = context.oldProperties || getProperties(businessObject, Object.keys(properties));
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
