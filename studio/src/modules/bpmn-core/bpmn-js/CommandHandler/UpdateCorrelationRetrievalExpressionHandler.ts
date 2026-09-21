import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const BFW_CORRELATION_RETRIEVAL_EXPRESSION = 'bfw:CorrelationRetrievalExpression';
const MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE = 'bpmn:MessageEventDefinition';

export function UpdateCorrelationRetrievalExpressionHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateCorrelationRetrievalExpressionHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateCorrelationRetrievalExpressionHandler.prototype.preExecute = function (context: any) {
  const { element, value } = context;
  const businessObject = getBusinessObject(element);

  const eventDef = businessObject.eventDefinitions?.find(
    (def: any) => def.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
  );

  const target = eventDef ?? businessObject;
  const targetElement = eventDef != null ? { ...element, businessObject: target } : element;

  const commands = setBfwBodyExtension(targetElement, this.bpmnFactory, BFW_CORRELATION_RETRIEVAL_EXPRESSION, value);

  if (commands.length > 0) {
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateCorrelationRetrievalExpressionHandler;
