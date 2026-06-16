import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import { removeEvilExtension, setEvilBodyExtension } from './Utils/EvilExtensionHelper';

const EVIL_DECISION_REF = 'evil:DecisionRef';
const EVIL_DECISION_ELEMENT_ID = 'evil:DecisionElementId';
const EVIL_RESULT_VARIABLE = 'evil:ResultVariable';
const EVIL_TRACE_UNMATCHED_RULES = 'evil:TraceUnmatchedRules';

const DMN_COMPANION_TYPES = [
  EVIL_DECISION_REF,
  EVIL_DECISION_ELEMENT_ID,
  EVIL_RESULT_VARIABLE,
  EVIL_TRACE_UNMATCHED_RULES,
];

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
      for (const evilType of DMN_COMPANION_TYPES) {
        commands.push(...removeEvilExtension(element, evilType));
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
      commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_DECISION_REF, newDecisionRef));
    }
    if (newDecisionElementId !== undefined) {
      commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_DECISION_ELEMENT_ID, newDecisionElementId));
    }
    if (newResultVariable !== undefined) {
      commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_RESULT_VARIABLE, newResultVariable));
    }
    if (newTraceUnmatchedRules !== undefined) {
      const stringValue = newTraceUnmatchedRules != null ? String(newTraceUnmatchedRules) : null;
      commands.push(...setEvilBodyExtension(element, this.bpmnFactory, EVIL_TRACE_UNMATCHED_RULES, stringValue));
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
