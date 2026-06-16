import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';

import { CmdHelper } from './Helper/CommmandHelper';
import { setEvilBodyExtension } from './Utils/EvilExtensionHelper';

const MODDLE_BPMN_PARTICIPANT_TYPE = 'bpmn:Participant';
const MODDLE_BPMN_PROCESS_SELECTOR = 'processRef';

export function UpdateProcessHandler(
  this: any,
  commandStack: CommandStack,
  modeling: Modeling,
  bpmnFactory: any,
): void {
  this.commandStack = commandStack;
  this.modeling = modeling;
  this.bpmnFactory = bpmnFactory;
}

UpdateProcessHandler.$inject = ['commandStack', 'modeling', 'bpmnFactory'];

UpdateProcessHandler.prototype.preExecute = function (context: any) {
  const { element, newProcessId, newProcessName, newVersion, newCorrelationKey, newIsExecutable } = context;

  const commands: any[] = [];

  const props: Record<string, unknown> = {
    name: newProcessName || undefined,
    isExecutable: newIsExecutable || undefined,
  };

  let businessObject = getBusinessObject(element);

  if (element.type === MODDLE_BPMN_PARTICIPANT_TYPE && element.businessObject.processRef !== undefined) {
    businessObject = businessObject.get(MODDLE_BPMN_PROCESS_SELECTOR);
    props['id'] = newProcessId;
  } else {
    const idProps = { id: newProcessId };
    this.modeling.updateProperties(element, idProps);
  }

  commands.push(CmdHelper.updateBusinessObject(element, businessObject, props));

  const processElement = element.type === MODDLE_BPMN_PARTICIPANT_TYPE ? { businessObject: businessObject } : element;

  if (newVersion !== undefined) {
    commands.push(...setEvilBodyExtension(processElement, this.bpmnFactory, 'evil:Version', newVersion));
  }

  if (newCorrelationKey !== undefined) {
    commands.push(...setEvilBodyExtension(processElement, this.bpmnFactory, 'evil:CorrelationKey', newCorrelationKey));
  }

  const commandToExecute = CmdHelper.executeMultipleCommands(commands);
  this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
};

export default UpdateProcessHandler;
