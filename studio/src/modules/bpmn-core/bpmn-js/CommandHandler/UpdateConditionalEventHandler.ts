import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';

const MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE = 'bpmn:ConditionalEventDefinition';
const MODDLE_BPMN_CONDITION_SELECTOR = 'condition';

export function UpdateConditionalEventHandler(this: any, commandStack: CommandStack): void {
  this.commandStack = commandStack;
}

UpdateConditionalEventHandler.$inject = ['commandStack'];

UpdateConditionalEventHandler.prototype.preExecute = function (context: any) {
  const { element, newCondition } = context;

  const businessObject = getBusinessObject(element);

  const conditionalEventDefinition = businessObject.eventDefinitions?.find(
    (definition: any) => definition.$type === MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE,
  );

  if (conditionalEventDefinition == null) {
    return;
  }

  const formalExpression = conditionalEventDefinition.get(MODDLE_BPMN_CONDITION_SELECTOR);
  const formalExpressionProps = {
    body: newCondition || undefined,
  };

  const commandToExecute = CmdHelper.updateBusinessObject(element, formalExpression, formalExpressionProps);
  this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
};

export default UpdateConditionalEventHandler;
