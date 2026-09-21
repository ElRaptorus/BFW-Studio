import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { removeBfwExtension, setBfwBodyExtension } from './Utils/BfwExtensionHelper';

const BFW_DECISION_REF = 'bfw:DecisionRef';
const BFW_DECISION_ELEMENT_ID = 'bfw:DecisionElementId';
const BFW_RESULT_VARIABLE = 'bfw:ResultVariable';
const BFW_TRACE_UNMATCHED_RULES = 'bfw:TraceUnmatchedRules';

const DMN_COMPANION_TYPES = [BFW_DECISION_REF, BFW_DECISION_ELEMENT_ID, BFW_RESULT_VARIABLE, BFW_TRACE_UNMATCHED_RULES];

export function UpdateBusinessRuleTaskHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateBusinessRuleTaskHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateBusinessRuleTaskHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const updateImplementation = (args: any): void => {
    const { element, newImplementation } = args;
    const businessObject = getBusinessObject(element);
    const commands: any[] = [];

    commands.push(
      CmdHelper.updateBusinessObject(element, businessObject, {
        implementation: newImplementation || undefined,
      }),
    );

    if (newImplementation === 'feel') {
      for (const extensionType of DMN_COMPANION_TYPES) {
        commands.push(...removeBfwExtension(element, extensionType));
      }
    } else if (newImplementation === 'dmn') {
      commands.push(CmdHelper.updateBusinessObject(element, businessObject, { script: undefined }));
    }

    const commandToExecute = CmdHelper.executeMultipleCommands(commands);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateFeelScript = (args: any): void => {
    const { element, newScript } = args;
    const businessObject = getBusinessObject(element);

    const commandToExecute = CmdHelper.updateBusinessObject(element, businessObject, {
      script: newScript || undefined,
    });
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateDmnConfig = (args: any): void => {
    const { element, newDecisionRef, newDecisionElementId, newResultVariable, newTraceUnmatchedRules } = args;
    const commands: any[] = [];

    if (newDecisionRef !== undefined) {
      commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_DECISION_REF, newDecisionRef));
    }
    if (newDecisionElementId !== undefined) {
      commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_DECISION_ELEMENT_ID, newDecisionElementId));
    }
    if (newResultVariable !== undefined) {
      commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_RESULT_VARIABLE, newResultVariable));
    }
    if (newTraceUnmatchedRules !== undefined) {
      const stringValue = newTraceUnmatchedRules != null ? String(newTraceUnmatchedRules) : null;
      commands.push(...setBfwBodyExtension(element, this.bpmnFactory, BFW_TRACE_UNMATCHED_RULES, stringValue));
    }

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const commandHandler = {
    updateImplementation,
    updateFeelScript,
    updateDmnConfig,
  };

  commandHandler[command](restArgs);
};

export default UpdateBusinessRuleTaskHandler;
