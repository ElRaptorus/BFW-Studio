import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { generateRandomId, getRoot } from './Utils/Utils';

const MODDLE_BPMN_MESSAGE_TYPE = 'bpmn:Message';
const MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE = 'bpmn:MessageEventDefinition';
const MODDLE_BPMN_MESSAGE_SELECTOR = 'messageRef';

export function UpdateMessageHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateMessageHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateMessageHandler.prototype.preExecute = function (context: any) {
  const { element, newMessageName } = context;

  const businessObject = getBusinessObject(element);
  const elementIsMessageEventDefinition =
    businessObject.eventDefinitions &&
    businessObject.eventDefinitions.length !== 0 &&
    businessObject.eventDefinitions.some(
      (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
    );

  let selectedMessage;

  if (elementIsMessageEventDefinition) {
    selectedMessage = element.businessObject.eventDefinitions.find(
      (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
    )?.messageRef;
  } else {
    selectedMessage = element.businessObject.get(MODDLE_BPMN_MESSAGE_SELECTOR);
  }

  const root = getRoot(businessObject);

  const createMessageAndUpdateCurrentElement = () => {
    const commands: any = [];

    const newElement = this.bpmnFactory.create(MODDLE_BPMN_MESSAGE_TYPE, {
      name: newMessageName,
      id: `Message_${generateRandomId()}`,
    });
    newElement.$parent = root;

    commands.push(CmdHelper.addElementsTolist(element, root, 'rootElements', [newElement]));

    const props = {
      messageRef: newElement,
    };

    const objectToUpdate = elementIsMessageEventDefinition ? businessObject.eventDefinitions[0] : businessObject;
    commands.push(CmdHelper.updateBusinessObject(element, objectToUpdate, props));
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);

    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const elementsWithSelectedMessageAsMessageRef = this.elementRegistry.filter((element) => {
    const businessObject = getBusinessObject(element);

    const elementIsMessageEventDefinition =
      businessObject.eventDefinitions &&
      businessObject.eventDefinitions.length !== 0 &&
      businessObject.eventDefinitions.some(
        (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
      );

    let messageToReturn;
    if (elementIsMessageEventDefinition) {
      messageToReturn =
        businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
        )?.messageRef?.id === selectedMessage?.id;
    } else {
      messageToReturn = businessObject.messageRef?.id === selectedMessage?.id;
    }

    return messageToReturn;
  });

  const messageIsSingleSelected = elementsWithSelectedMessageAsMessageRef.length < 2;
  if (selectedMessage != null && messageIsSingleSelected) {
    if (selectedMessage.name === newMessageName) {
      return;
    }

    const props = {
      name: newMessageName,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, selectedMessage, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  } else {
    createMessageAndUpdateCurrentElement();
  }
};

export default UpdateMessageHandler;
