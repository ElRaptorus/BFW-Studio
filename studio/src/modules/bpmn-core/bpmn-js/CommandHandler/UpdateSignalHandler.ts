import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { generateRandomId, getRoot } from './Utils/Utils';

const MODDLE_BPMN_SIGNAL_TYPE = 'bpmn:Signal';
const MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE = 'bpmn:SignalEventDefinition';

export function UpdateSignalHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateSignalHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateSignalHandler.prototype.preExecute = function (context: any) {
  const { element, newSignalName } = context;

  const businessObject = getBusinessObject(element);

  const elementIsSignalEventDefinition =
    businessObject.eventDefinitions != null &&
    businessObject.eventDefinitions.length !== 0 &&
    businessObject.eventDefinitions.some((definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE);

  let selectedSignal;

  if (elementIsSignalEventDefinition) {
    selectedSignal = businessObject.eventDefinitions.find(
      (definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE,
    )?.signalRef;
  } else {
    selectedSignal = undefined;
  }

  const root = getRoot(businessObject);

  const createSignalAndUpdateCurrentElement = () => {
    const commands: any = [];

    const newElement = this.bpmnFactory.create(MODDLE_BPMN_SIGNAL_TYPE, {
      name: newSignalName,
      id: `Signal_${generateRandomId()}`,
    });
    newElement.$parent = root;

    commands.push(CmdHelper.addElementsTolist(element, root, 'rootElements', [newElement]));

    const props = {
      signalRef: newElement,
    };

    commands.push(CmdHelper.updateBusinessObject(element, businessObject.eventDefinitions[0], props));
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);

    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const elementsWithSelectedSignalAsSignalRef = this.elementRegistry.filter((element) => {
    const businessObject = getBusinessObject(element);

    const elementIsSignalEventDefinition =
      businessObject.eventDefinitions != null &&
      businessObject.eventDefinitions.length !== 0 &&
      businessObject.eventDefinitions.some(
        (definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE,
      );

    if (elementIsSignalEventDefinition) {
      if (element.type === 'label') {
        return false;
      }
      return (
        businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE,
        )?.signalRef?.id === selectedSignal?.id
      );
    } else {
      return false;
    }
  });

  const signalIsSingleSelected = elementsWithSelectedSignalAsSignalRef.length < 2;
  if (selectedSignal != null && signalIsSingleSelected) {
    if (selectedSignal.name === newSignalName) {
      return;
    }

    const props = {
      name: newSignalName,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, selectedSignal, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  } else {
    createSignalAndUpdateCurrentElement();
  }
};

export default UpdateSignalHandler;
