import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { isSequenceFlowConditional } from './Utils/Utils';

const MODDLE_BPMN_CONDITION_SELECTOR = 'conditionExpression';
const MODDLE_BPMN_FORMAL_EXPRESSION_TYPE = 'bpmn:FormalExpression';

export function UpdateConditionHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateConditionHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateConditionHandler.prototype.preExecute = function (context: any) {
  const { element, newConditionExpression } = context;

  const businessObject = getBusinessObject(element);

  const sequenceFlowIsConditional = isSequenceFlowConditional(element);

  let selectedConditionExpression;

  if (sequenceFlowIsConditional) {
    selectedConditionExpression = businessObject.get(MODDLE_BPMN_CONDITION_SELECTOR);
  }

  if (selectedConditionExpression != null) {
    if (selectedConditionExpression.body === newConditionExpression) {
      return;
    }

    const props = {
      body: newConditionExpression,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, selectedConditionExpression, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  } else {
    const conditionExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION_TYPE, {
      body: newConditionExpression,
    });
    conditionExpression.$parent = businessObject;

    const props = {
      conditionExpression: conditionExpression,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, element.businessObject, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateConditionHandler;
