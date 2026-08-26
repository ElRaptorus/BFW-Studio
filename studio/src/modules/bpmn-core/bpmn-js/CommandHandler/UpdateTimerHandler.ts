import { BpmnTimerType } from '#modules/bpmn-editor/BpmnElementTypes';
import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';

const MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE = 'bpmn:TimerEventDefinition';
const MODDLE_BPMN_FORMAL_EXPRESSION_TYPE = 'bpmn:FormalExpression';

export function UpdateTimerHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateTimerHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateTimerHandler.prototype.preExecute = function (context: any) {
  const { element, newTimerType, newTimerDefinition } = context;

  const businessObject = getBusinessObject(element);

  const selectedTimer = businessObject.eventDefinitions?.find(
    (definition: any) => definition.$type === MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE,
  );

  if (selectedTimer == null) {
    return;
  }

  const timerExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION_TYPE, {
    body: newTimerDefinition,
  });
  timerExpression.$parent = selectedTimer;

  let props: Record<string, unknown>;
  if (newTimerType === BpmnTimerType.Cycle) {
    props = {
      timeCycle: timerExpression,
      timeDate: undefined,
      timeDuration: undefined,
    };
  } else if (newTimerType === BpmnTimerType.Date) {
    props = {
      timeDate: timerExpression,
      timeCycle: undefined,
      timeDuration: undefined,
    };
  } else if (newTimerType === BpmnTimerType.Duration) {
    props = {
      timeDuration: timerExpression,
      timeDate: undefined,
      timeCycle: undefined,
    };
  } else {
    return;
  }

  const commandToExecute = CmdHelper.updateBusinessObject(element, selectedTimer, props);
  this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
};

export default UpdateTimerHandler;
