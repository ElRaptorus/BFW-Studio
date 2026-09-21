import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { CmdHelper } from './Helper/CommmandHelper';
import { setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const MODDLE_BPMN_SCRIPT_SELECTOR = 'script';
const MODDLE_BPMN_SCRIPT_TASK_TYPE = 'bpmn:ScriptTask';

export function UpdateScriptHandler(
  this: any,
  commandStack: CommandStack,
  bpmnFactory: any,
  elementRegistry: ElementRegistry,
): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
  this.elementRegistry = elementRegistry;
}

UpdateScriptHandler.$inject = ['commandStack', 'bpmnFactory', 'elementRegistry'];

UpdateScriptHandler.prototype.preExecute = function (context: any) {
  const { element, newScript, newScriptRef } = context;

  const businessObject = getBusinessObject(element);
  const elementIsScriptTask = element.type === MODDLE_BPMN_SCRIPT_TASK_TYPE;

  if (!elementIsScriptTask) {
    return;
  }

  const commands: any[] = [];

  if (newScript !== undefined) {
    const selectedScript = businessObject.get(MODDLE_BPMN_SCRIPT_SELECTOR);
    if (selectedScript !== newScript) {
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { script: newScript }));
    }
  }

  if (newScriptRef !== undefined) {
    commands.push(...setBfwBodyExtension(element, this.bpmnFactory, 'bfw:ScriptRef', newScriptRef || null));
  }

  if (commands.length > 0) {
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateScriptHandler;
