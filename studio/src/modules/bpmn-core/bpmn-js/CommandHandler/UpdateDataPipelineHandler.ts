import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import {
  createBfwExtension,
  findAllBfwExtensions,
  removeBfwExtension,
  setBfwBodyExtension,
} from './Utils/BfwExtensionHelper';

const BFW_INPUT_MAPPING = 'bfw:InputMapping';
const BFW_OUTPUT_MAPPING = 'bfw:OutputMapping';
const BFW_PAYLOAD_CONTRACT = 'bfw:PayloadContract';
const BFW_RESULT_CONTRACT = 'bfw:ResultContract';

export function UpdateDataPipelineHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateDataPipelineHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateDataPipelineHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const addMapping = (args: any): void => {
    const { element, mappingType, source, target } = args;
    const extensionType = mappingType === 'input' ? BFW_INPUT_MAPPING : BFW_OUTPUT_MAPPING;

    const commands = createBfwExtension(element, this.bpmnFactory, extensionType, {
      source: source || '',
      target: target || '',
    });

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const deleteMapping = (args: any): void => {
    const { element, mappingType, index } = args;
    const businessObject = getBusinessObject(element);
    const extensionType = mappingType === 'input' ? BFW_INPUT_MAPPING : BFW_OUTPUT_MAPPING;
    const allMappings = findAllBfwExtensions(businessObject, extensionType);

    if (index < 0 || index >= allMappings.length) {
      return;
    }

    const extensionElements = businessObject.extensionElements;
    if (extensionElements == null) {
      return;
    }

    const mappingToRemove = allMappings[index];
    const remaining = (extensionElements.values ?? []).filter((value: any) => value !== mappingToRemove);

    let commandToExecute;
    if (remaining.length === 0) {
      commandToExecute = CmdHelper.updateBusinessObject(element, businessObject, { extensionElements: undefined });
    } else {
      commandToExecute = CmdHelper.updateBusinessObject(element, extensionElements, { values: remaining });
    }

    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateMapping = (args: any): void => {
    const { element, mappingType, index, source, target } = args;
    const businessObject = getBusinessObject(element);
    const extensionType = mappingType === 'input' ? BFW_INPUT_MAPPING : BFW_OUTPUT_MAPPING;
    const allMappings = findAllBfwExtensions(businessObject, extensionType);

    if (index < 0 || index >= allMappings.length) {
      return;
    }

    const mappingElement = allMappings[index];
    const props: Record<string, unknown> = {};

    if (source !== undefined) {
      props.source = source;
    }
    if (target !== undefined) {
      props.target = target;
    }

    const commandToExecute = CmdHelper.updateBusinessObject(element, mappingElement, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const reorderMapping = (args: any): void => {
    const { element, mappingType, fromIndex, toIndex } = args;
    const businessObject = getBusinessObject(element);
    const extensionType = mappingType === 'input' ? BFW_INPUT_MAPPING : BFW_OUTPUT_MAPPING;
    const extensionElements = businessObject.extensionElements;

    if (extensionElements == null) {
      return;
    }

    const allMappings = findAllBfwExtensions(businessObject, extensionType);
    if (fromIndex < 0 || fromIndex >= allMappings.length || toIndex < 0 || toIndex >= allMappings.length) {
      return;
    }

    const otherValues = (extensionElements.values ?? []).filter((value: any) => value.$type !== extensionType);
    const reorderedMappings = [...allMappings];
    const [moved] = reorderedMappings.splice(fromIndex, 1);
    reorderedMappings.splice(toIndex, 0, moved);

    const commandToExecute = CmdHelper.updateBusinessObject(element, extensionElements, {
      values: [...otherValues, ...reorderedMappings],
    });
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const setMappings = (args: any): void => {
    const { element, mappingType, mappings } = args;
    const extensionType = mappingType === 'input' ? BFW_INPUT_MAPPING : BFW_OUTPUT_MAPPING;
    const commands: any[] = [];

    commands.push(...removeBfwExtension(element, extensionType));

    for (const mapping of mappings ?? []) {
      commands.push(
        ...createBfwExtension(element, this.bpmnFactory, extensionType, {
          source: mapping.source || '',
          target: mapping.target || '',
        }),
      );
    }

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const updateContract = (args: any): void => {
    const { element, contractType, value } = args;
    const extensionType = contractType === 'payload' ? BFW_PAYLOAD_CONTRACT : BFW_RESULT_CONTRACT;
    const commands = setBfwBodyExtension(element, this.bpmnFactory, extensionType, value);

    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const commandHandler = {
    addMapping,
    deleteMapping,
    updateMapping,
    reorderMapping,
    setMappings,
    updateContract,
  };

  commandHandler[command](restArgs);
};

export default UpdateDataPipelineHandler;
