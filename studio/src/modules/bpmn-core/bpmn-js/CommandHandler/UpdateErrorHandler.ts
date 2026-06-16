import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { setEvilBodyExtension } from './Utils/EvilExtensionHelper';
import { generateRandomId, getRoot } from './Utils/Utils';

const MODDLE_BPMN_ERROR_TYPE = 'bpmn:Error';
const MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE = 'bpmn:ErrorEventDefinition';

export function UpdateErrorHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateErrorHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateErrorHandler.prototype.preExecute = function (context: any) {
  const { element, newErrorName, newErrorCode, newErrorMessage } = context;

  const businessObject = getBusinessObject(element);

  const errorEventDefinition = businessObject.eventDefinitions?.find(
    (definition: any) => definition.$type === MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE,
  );

  if (errorEventDefinition == null) {
    return;
  }

  const selectedError = errorEventDefinition.errorRef;
  const root = getRoot(businessObject);

  const elementsWithSelectedErrorAsErrorRef = this.elementRegistry.filter((registryElement: any) => {
    const registryBusinessObject = getBusinessObject(registryElement);
    if (registryElement.type === 'label') {
      return false;
    }
    return registryBusinessObject.eventDefinitions?.some(
      (definition: any) =>
        definition.$type === MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE && definition.errorRef?.id === selectedError?.id,
    );
  });

  const commands: any[] = [];

  const errorIsSingleSelected = elementsWithSelectedErrorAsErrorRef.length === 1;
  if (selectedError != null && errorIsSingleSelected) {
    commands.push(
      CmdHelper.updateBusinessObject(element, selectedError, {
        name: newErrorName,
      }),
    );
  } else {
    const newError = this.bpmnFactory.create(MODDLE_BPMN_ERROR_TYPE, {
      name: newErrorName,
      id: `Error_${generateRandomId()}`,
    });
    newError.$parent = root;

    commands.push(CmdHelper.addElementsTolist(element, root, 'rootElements', [newError]));
    commands.push(CmdHelper.updateBusinessObject(element, errorEventDefinition, { errorRef: newError }));
  }

  const eventDefElement = { businessObject: errorEventDefinition };
  commands.push(...setEvilBodyExtension(eventDefElement, this.bpmnFactory, 'evil:ErrorCode', newErrorCode || null));
  commands.push(
    ...setEvilBodyExtension(eventDefElement, this.bpmnFactory, 'evil:ErrorMessage', newErrorMessage || null),
  );

  const commandToExecute = CmdHelper.executeMultipleCommands(commands);
  this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
};

export default UpdateErrorHandler;
