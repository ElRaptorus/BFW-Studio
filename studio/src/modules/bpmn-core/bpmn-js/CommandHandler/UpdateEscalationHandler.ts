import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { generateRandomId, getRoot } from './Utils/Utils';

const MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE = 'bpmn:EscalationEventDefinition';
const MODDLE_BPMN_ESCALATION_TYPE = 'bpmn:Escalation';

export function UpdateEscalationHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateEscalationHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateEscalationHandler.prototype.preExecute = function (context: any) {
  const { element, newName, newEscalationCode } = context;

  const businessObject = getBusinessObject(element);

  const elementIsEscalationEventDefinition = businessObject.eventDefinitions?.some(
    (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
  );

  let selectedEscalation;

  if (elementIsEscalationEventDefinition) {
    selectedEscalation = businessObject.eventDefinitions.find(
      (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
    )?.escalationRef;
  }

  const root = getRoot(businessObject);

  const createEscalationAndUpdateCurrentElement = () => {
    const commands: any = [];

    const newElement = this.bpmnFactory.create(MODDLE_BPMN_ESCALATION_TYPE, {
      name: newName || undefined,
      escalationCode: newEscalationCode || undefined,
      id: `Escalation_${generateRandomId()}`,
    });
    newElement.$parent = root;

    commands.push(CmdHelper.addElementsTolist(element, root, 'rootElements', [newElement]));

    const props = {
      escalationRef: newElement,
    };

    const escalationEventDefinition = businessObject.eventDefinitions.find(
      (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
    );

    commands.push(CmdHelper.updateBusinessObject(element, escalationEventDefinition, props));
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);

    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const elementsWithSelectedEscalationAsEscalationRef = this.elementRegistry.filter((element) => {
    const businessObject = getBusinessObject(element);

    const elementIsEscalationEventDefinition = businessObject.eventDefinitions?.some(
      (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
    );

    if (elementIsEscalationEventDefinition) {
      if (element.type === 'label') {
        return false;
      }
      return (
        businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
        )?.escalationRef?.id === selectedEscalation?.id
      );
    } else {
      return false;
    }
  });

  const escalationIsSingleSelected = elementsWithSelectedEscalationAsEscalationRef.length === 1;
  if (selectedEscalation != null && escalationIsSingleSelected) {
    const commands: any[] = [];

    const name = newName || undefined;
    const escalationCode = newEscalationCode || undefined;

    if (name == null && escalationCode == null) {
      commands.push(CmdHelper.removeElementsFromList(element, root, 'rootElements', undefined, [selectedEscalation]));

      const escalationEventDefinition = businessObject.eventDefinitions.find(
        (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
      );
      commands.push(CmdHelper.updateBusinessObject(element, escalationEventDefinition, { escalationRef: undefined }));
    } else {
      const props = {
        name: name,
        escalationCode: escalationCode,
      };

      commands.push(CmdHelper.updateBusinessObject(element, selectedEscalation, props));
    }

    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  } else {
    createEscalationAndUpdateCurrentElement();
  }
};

export default UpdateEscalationHandler;
