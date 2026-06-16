import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';

import { CmdHelper } from './Helper/CommmandHelper';
import {
  createEvilExtension,
  findAllEvilExtensions,
  removeEvilExtension,
  setEvilBodyExtension,
} from './Utils/EvilExtensionHelper';

const EVIL_INPUT_MAPPING = 'evil:InputMapping';
const EVIL_OUTPUT_MAPPING = 'evil:OutputMapping';
const EVIL_PAYLOAD_CONTRACT = 'evil:PayloadContract';
const EVIL_RESULT_CONTRACT = 'evil:ResultContract';

export function UpdateDataPipelineHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateDataPipelineHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateDataPipelineHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const addMapping = (args: any): void => {
    const { element, mappingType, source, target } = args;
    const evilType = mappingType === 'input' ? EVIL_INPUT_MAPPING : EVIL_OUTPUT_MAPPING;

    const commands = createEvilExtension(element, this.bpmnFactory, evilType, {
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
    const evilType = mappingType === 'input' ? EVIL_INPUT_MAPPING : EVIL_OUTPUT_MAPPING;
    const allMappings = findAllEvilExtensions(businessObject, evilType);

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
    const evilType = mappingType === 'input' ? EVIL_INPUT_MAPPING : EVIL_OUTPUT_MAPPING;
    const allMappings = findAllEvilExtensions(businessObject, evilType);

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
    const evilType = mappingType === 'input' ? EVIL_INPUT_MAPPING : EVIL_OUTPUT_MAPPING;
    const extensionElements = businessObject.extensionElements;

    if (extensionElements == null) {
      return;
    }

    const allMappings = findAllEvilExtensions(businessObject, evilType);
    if (fromIndex < 0 || fromIndex >= allMappings.length || toIndex < 0 || toIndex >= allMappings.length) {
      return;
    }

    const otherValues = (extensionElements.values ?? []).filter((value: any) => value.$type !== evilType);
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
    const evilType = mappingType === 'input' ? EVIL_INPUT_MAPPING : EVIL_OUTPUT_MAPPING;
    const commands: any[] = [];

    commands.push(...removeEvilExtension(element, evilType));

    for (const mapping of mappings ?? []) {
      commands.push(
        ...createEvilExtension(element, this.bpmnFactory, evilType, {
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
    const evilType = contractType === 'payload' ? EVIL_PAYLOAD_CONTRACT : EVIL_RESULT_CONTRACT;
    const commands = setEvilBodyExtension(element, this.bpmnFactory, evilType, value);

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
