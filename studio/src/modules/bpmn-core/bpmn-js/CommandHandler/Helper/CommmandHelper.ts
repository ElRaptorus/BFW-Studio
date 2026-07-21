import type { ElementLike } from 'diagram-js/lib/model/Types';

import type { BpmnElementCustomProperty } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

/** Descriptor passed to `commandStack.execute(cmd, context)`. */
export type CmdHelperDescriptor = { cmd: string; context: any };

function updateProperties(element: ElementLike | undefined, properties: Record<string, unknown>): CmdHelperDescriptor {
  return {
    cmd: 'element.updateProperties',
    context: { element: element, properties: properties },
  };
}

function updateBusinessObject(
  element: ElementLike | undefined,
  businessObject: any,
  newProperties: Record<string, unknown>,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectHandler',
    context: {
      element: element,
      businessObject: businessObject,
      properties: newProperties,
    },
  };
}

function addElementsTolist(
  element: ElementLike | undefined,
  businessObject: any,
  listPropertyName: string,
  objectsToAdd: any[],
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectListHandler',
    context: {
      element: element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      objectsToAdd: objectsToAdd,
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
      element: element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      referencePropertyName: referencePropertyName,
      objectsToRemove: objectsToRemove,
    },
  };
}

function addAndRemoveElementsFromList(
  element: ElementLike | undefined,
  businessObject: any,
  listPropertyName: string,
  referencePropertyName: string | undefined,
  objectsToAdd: any[],
  objectsToRemove: any[],
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessObjectListHandler',
    context: {
      element: element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      referencePropertyName: referencePropertyName,
      objectsToAdd: objectsToAdd,
      objectsToRemove: objectsToRemove,
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
      element: element,
      currentObject: businessObject,
      propertyName: listPropertyName,
      updatedObjectList: updatedObjectList,
    },
  };
}

function updateOrCreateMessage(element: ElementLike | undefined, newMessageName: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateMessageHandler',
    context: {
      element: element,
      newMessageName: newMessageName,
    },
  };
}

function updateOrCreateSignal(element: ElementLike | undefined, newSignalName: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateSignalHandler',
    context: {
      element: element,
      newSignalName: newSignalName,
    },
  };
}

function updateOrCreateError(
  element: ElementLike | undefined,
  errorName: string,
  errorCode?: string,
  errorMessage?: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateErrorHandler',
    context: {
      element: element,
      newErrorName: errorName,
      newErrorCode: errorCode,
      newErrorMessage: errorMessage,
    },
  };
}

function updateOrCreateTimer(
  element: ElementLike | undefined,
  timerType: string,
  timerDefinition: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateTimerHandler',
    context: {
      element: element,
      newTimerType: timerType,
      newTimerDefinition: timerDefinition,
    },
  };
}

function updateOrCreateCondition(
  element: ElementLike | undefined,
  newConditionExpression: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateConditionHandler',
    context: {
      element: element,
      newConditionExpression: newConditionExpression,
    },
  };
}

function updateOrCreateLink(element: ElementLike | undefined, newLinkName: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateLinkHandler',
    context: {
      element: element,
      newLinkName: newLinkName,
    },
  };
}

function updateOrCreateScript(
  element: ElementLike | undefined,
  newScript?: string,
  newScriptRef?: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateScriptHandler',
    context: {
      element: element,
      newScript: newScript,
      newScriptRef: newScriptRef,
    },
  };
}

function updateOrCreateCallActivity(
  element: ElementLike | undefined,
  newProcessModelId?: string,
  newStartEventId?: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateCallActivityHandler',
    context: {
      element: element,
      newProcessModelId: newProcessModelId,
      newStartEventId: newStartEventId,
    },
  };
}

function createCustomProperty(
  element: ElementLike | undefined,
  customProperty: BpmnElementCustomProperty,
): CmdHelperDescriptor {
  return {
    cmd: 'CustomPropertyHandler',
    context: {
      element: element,
      command: 'create',
      customProperty: customProperty,
    },
  };
}

function updateCustomProperty(
  element: ElementLike | undefined,
  index: number,
  customProperty: BpmnElementCustomProperty,
  removeOnEmptyValue: boolean = true,
): CmdHelperDescriptor {
  return {
    cmd: 'CustomPropertyHandler',
    context: {
      element: element,
      command: 'update',
      index: index,
      customProperty: customProperty,
      removeOnEmptyValue: removeOnEmptyValue,
    },
  };
}

function deleteCustomProperty(element: ElementLike | undefined, index: number): CmdHelperDescriptor {
  return {
    cmd: 'CustomPropertyHandler',
    context: {
      element: element,
      command: 'delete',
      index: index,
    },
  };
}

function updateProcess(
  element: ElementLike | undefined,
  newProcessId: string,
  newProcessName: string,
  newVersion: string,
  newCorrelationKey: string | undefined,
  newIsExecutable: boolean,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateProcessHandler',
    context: {
      element: element,
      newProcessId: newProcessId,
      newProcessName: newProcessName,
      newVersion: newVersion,
      newCorrelationKey: newCorrelationKey,
      newIsExecutable: newIsExecutable,
    },
  };
}

function updateConditionalEvent(element: ElementLike | undefined, newCondition: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateConditionalEventHandler',
    context: {
      element: element,
      newCondition: newCondition,
    },
  };
}

function updateEscalationEvent(
  element: ElementLike | undefined,
  newName: string,
  newEscalationCode: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateEscalationHandler',
    context: {
      element: element,
      newName: newName,
      newEscalationCode: newEscalationCode,
    },
  };
}

function updateServiceTaskType(element: ElementLike | undefined, newImplementation: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateServiceTaskHandler',
    context: {
      element: element,
      command: 'updateType',
      newImplementation: newImplementation,
    },
  };
}

function updateLoopCharacteristics(element: ElementLike | undefined, loopConfig: any): CmdHelperDescriptor {
  return {
    cmd: 'UpdateLoopCharacteristicsHandler',
    context: {
      element: element,
      ...loopConfig,
    },
  };
}

function updateAdHocSubprocess(element: ElementLike | undefined, properties: any): CmdHelperDescriptor {
  return {
    cmd: 'UpdateAdHocSubprocessHandler',
    context: {
      element: element,
      ...properties,
    },
  };
}

function updateUserTaskResources(
  element: ElementLike | undefined,
  resources: { assignee?: string; candidateUsers?: string },
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateUserTaskResourcesHandler',
    context: {
      element: element,
      ...resources,
    },
  };
}

function updateHttpServiceTask(
  element: ElementLike | undefined,
  newMethod?: string,
  newUrl?: string,
  newBody?: string,
  newAuthHeader?: string,
  newResponseHeaders?: string,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateServiceTaskHandler',
    context: {
      element: element,
      command: 'updateHttpTask',
      newMethod: newMethod,
      newUrl: newUrl,
      newBody: newBody,
      newAuthHeader: newAuthHeader,
      newResponseHeaders: newResponseHeaders,
    },
  };
}

function updateBusinessRuleTask(
  element: ElementLike | undefined,
  command: string,
  args: Record<string, unknown>,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateBusinessRuleTaskHandler',
    context: {
      element: element,
      command: command,
      ...args,
    },
  };
}

function updateDefinitionId(element: ElementLike | undefined, newDefinitionId: string): CmdHelperDescriptor {
  return {
    cmd: 'UpdateDefinitionHandler',
    context: {
      element: element,
      newDefinitionId: newDefinitionId,
    },
  };
}

function updateCorrelationRetrievalExpression(
  element: ElementLike | undefined,
  value: string | null,
): CmdHelperDescriptor {
  return {
    cmd: 'UpdateCorrelationRetrievalExpressionHandler',
    context: {
      element: element,
      value: value,
    },
  };
}

function updateDataPipeline(element: ElementLike | undefined, pipelineConfig: any): CmdHelperDescriptor {
  return {
    cmd: 'UpdateDataPipelineHandler',
    context: {
      element: element,
      ...pipelineConfig,
    },
  };
}

function executeMultipleCommands(arrayOfCommands: any[]): CmdHelperDescriptor {
  return {
    cmd: 'MultiCommandHandler',
    context: arrayOfCommands.flat(1000),
  };
}

export const CmdHelper = {
  addAndRemoveElementsFromList,
  addElementsTolist,
  createCustomProperty,
  deleteCustomProperty,
  executeMultipleCommands,
  removeElementsFromList,
  setList,
  updateBusinessObject,
  updateConditionalEvent,
  updateCustomProperty,
  updateOrCreateCallActivity,
  updateOrCreateCondition,
  updateOrCreateError,
  updateOrCreateLink,
  updateOrCreateMessage,
  updateOrCreateScript,
  updateOrCreateSignal,
  updateOrCreateTimer,
  updateProcess,
  updateProperties,
  updateEscalationEvent,
  updateServiceTaskType,
  updateHttpServiceTask,
  updateDefinitionId,
  updateBusinessRuleTask,
  updateLoopCharacteristics,
  updateUserTaskResources,
  updateCorrelationRetrievalExpression,
  updateDataPipeline,
  updateAdHocSubprocess,
};
