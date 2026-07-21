import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { setEvilBodyExtension } from './Utils/EvilExtensionHelper';

const MODDLE_BPMN_FORMAL_EXPRESSION_TYPE = 'bpmn:FormalExpression';
const MODDLE_BPMN_ADHOC_SUBPROCESS_TYPE = 'bpmn:AdHocSubProcess';

/**
 * Updates the standard BPMN attributes (`ordering`, `cancelRemainingInstances`, `implementation`),
 * the `<completionCondition>` child element, and the `evil:ActiveElements` extension body
 * on a `<bpmn:adHocSubProcess>` element.
 */
export function UpdateAdHocSubprocessHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateAdHocSubprocessHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateAdHocSubprocessHandler.prototype.preExecute = function (context: any) {
  const { element, ordering, cancelRemainingInstances, completionCondition, implementation, activeElementsExpression } =
    context;

  const businessObject = getBusinessObject(element);

  if (businessObject.$type !== MODDLE_BPMN_ADHOC_SUBPROCESS_TYPE) {
    return;
  }

  const commands: any[] = [];

  if (ordering !== undefined) {
    const newOrdering = ordering === '' ? undefined : ordering;
    if (businessObject.ordering !== newOrdering) {
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { ordering: newOrdering }));
    }
  }

  if (cancelRemainingInstances !== undefined) {
    const boolValue = cancelRemainingInstances === true || cancelRemainingInstances === 'true';
    if (businessObject.cancelRemainingInstances !== boolValue) {
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { cancelRemainingInstances: boolValue }));
    }
  }

  if (implementation !== undefined) {
    const newImplementation = implementation === '' ? undefined : implementation;
    if (businessObject.implementation !== newImplementation) {
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { implementation: newImplementation }));
    }
  }

  if (completionCondition !== undefined) {
    const existing = businessObject.completionCondition;
    if (existing != null) {
      if (existing.body !== completionCondition) {
        commands.push(CmdHelper.updateBusinessObject(element, existing, { body: completionCondition }));
      }
    } else if (completionCondition) {
      const formalExpression = this.bpmnFactory.create(MODDLE_BPMN_FORMAL_EXPRESSION_TYPE, {
        body: completionCondition,
      });
      formalExpression.$parent = businessObject;
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { completionCondition: formalExpression }));
    }
  }

  if (activeElementsExpression !== undefined) {
    commands.push(...setEvilBodyExtension(element, this.bpmnFactory, 'evil:ActiveElements', activeElementsExpression));
  }

  if (commands.length > 0) {
    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }
};

export default UpdateAdHocSubprocessHandler;
