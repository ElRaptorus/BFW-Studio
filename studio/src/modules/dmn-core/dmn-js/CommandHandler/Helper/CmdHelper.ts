import type { ElementLike } from 'diagram-js/lib/model/Types';

export type CmdHelperDescriptor = { cmd: string; context: any };

function updateBusinessObject(
  element: ElementLike | undefined,
  businessObject: any,
  newProperties: Record<string, unknown>,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectHandler',
    context: {
      element,
      businessObject,
      properties: newProperties,
    },
  };
}

function addElementsToList(
  element: ElementLike | undefined,
  businessObject: any,
  listPropertyName: string,
  objectsToAdd: any[],
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectListHandler',
    context: {
      element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      objectsToAdd,
    },
  };
}

function removeElementsFromList(
  element: ElementLike | undefined,
  businessObject: any,
  listPropertyName: string,
  referencePropertyName: string | undefined,
  objectsToRemove: any[],
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectListHandler',
    context: {
      element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      referencePropertyName,
      objectsToRemove,
    },
  };
}

function setList(
  element: ElementLike | undefined,
  businessObject: any,
  listPropertyName: string,
  updatedObjectList: any[],
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectListHandler',
    context: {
      element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      updatedObjectList,
    },
  };
}

function executeMultipleCommands(arrayOfCommands: CmdHelperDescriptor[]): CmdHelperDescriptor {
  return {
    cmd: 'MultiCommandHandler',
    context: arrayOfCommands.flat(1000),
  };
}

export const CmdHelper = {
  addElementsToList,
  executeMultipleCommands,
  removeElementsFromList,
  setList,
  updateBusinessObject,
};
