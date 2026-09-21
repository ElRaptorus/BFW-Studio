import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { getBfwBodyValue, setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const CALLED_ELEMENT_SELECTOR = 'calledElement';

export function UpdateCallActivityHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateCallActivityHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateCallActivityHandler.prototype.preExecute = function (context: any) {
  const { element, newProcessModelId, newStartEventId, newCalledProcessVersion } = context;

  const businessObject = getBusinessObject(element);
  const calledElement = businessObject.get(CALLED_ELEMENT_SELECTOR);
  const currentStartEventId = getBfwBodyValue(businessObject, 'bfw:StartEventId');
  const currentCalledProcessVersion = getBfwBodyValue(businessObject, 'bfw:CalledProcessVersion');

  const calledElementChanged = newProcessModelId !== undefined && newProcessModelId !== calledElement;
  const startEventIdChanged = newStartEventId !== undefined && newStartEventId !== currentStartEventId;
  const calledProcessVersionChanged =
    newCalledProcessVersion !== undefined && newCalledProcessVersion !== (currentCalledProcessVersion ?? '');

  if (!calledElementChanged && !startEventIdChanged && !calledProcessVersionChanged) {
    return;
  }

  if (calledElementChanged) {
    const cmd = CmdHelper.updateBusinessObject(element, businessObject, {
      calledElement: newProcessModelId || undefined,
    });
    this.commandStack.execute(cmd.cmd, cmd.context);
  }

  if (startEventIdChanged) {
    const cmds = setBfwBodyExtension(element, this.bpmnFactory, 'bfw:StartEventId', newStartEventId || null);
    for (const cmd of cmds) {
      this.commandStack.execute(cmd.cmd, cmd.context);
    }
  }

  if (calledProcessVersionChanged) {
    const cmds = setBfwBodyExtension(
      element,
      this.bpmnFactory,
      'bfw:CalledProcessVersion',
      newCalledProcessVersion || null,
    );
    for (const cmd of cmds) {
      this.commandStack.execute(cmd.cmd, cmd.context);
    }
  }
};

export default UpdateCallActivityHandler;
