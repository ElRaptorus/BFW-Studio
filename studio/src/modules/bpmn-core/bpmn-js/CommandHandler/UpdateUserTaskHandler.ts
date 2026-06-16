import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import { CmdHelper } from './Helper/CommmandHelper';
import { findEvilExtension, setEvilBodyExtension } from './Utils/EvilExtensionHelper';
import { generateRandomId } from './Utils/Utils';

const EVIL_FORM_FIELDS_TYPE = 'evil:FormFields';

/**
 * Internal form field shape stored as JSON inside evil:FormFields.
 */
type FormFieldEntry = {
  id: string;
  label?: string;
  type?: string;
  defaultValue?: string;
  customForm?: string;
  values?: { id: string; name?: string }[];
};

function readFormFields(element: ElementLike): FormFieldEntry[] {
  const businessObject = getBusinessObject(element);
  const extension = findEvilExtension(businessObject, EVIL_FORM_FIELDS_TYPE);
  if (extension?.body == null || extension.body.trim() === '') {
    return [];
  }
  try {
    return JSON.parse(extension.body) as FormFieldEntry[];
  } catch {
    return [];
  }
}

function writeFormFieldsCommands(element: ElementLike, bpmnFactory: any, formFields: FormFieldEntry[]): any[] {
  const serialized = formFields.length > 0 ? JSON.stringify(formFields) : null;
  return setEvilBodyExtension(element, bpmnFactory, EVIL_FORM_FIELDS_TYPE, serialized);
}

export function UpdateUserTaskHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

UpdateUserTaskHandler.$inject = ['commandStack', 'bpmnFactory'];

UpdateUserTaskHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const addFormField = (args: any): void => {
    const { element, index: indexToPlaceFormField } = args;

    const formFields = readFormFields(element);

    const newField: FormFieldEntry = {
      id: `FormField_${generateRandomId()}`,
      type: 'string',
    };

    context.newFormFieldId = newField.id;

    if (indexToPlaceFormField != null && indexToPlaceFormField <= formFields.length - 1) {
      formFields.splice(indexToPlaceFormField + 1, 0, newField);
    } else {
      formFields.push(newField);
    }

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const deleteFormField = (args: any): void => {
    const { element, formFieldId } = args;

    const formFields = readFormFields(element);
    const updatedFields = formFields.filter((field) => field.id !== formFieldId);

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, updatedFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const updateFormField = (args: any): void => {
    const { element, formFieldId, newId, newLabel, newType, newDefaultValue, newCustomFormConfig } = args;

    const formFields = readFormFields(element);
    const fieldIndex = formFields.findIndex((field) => field.id === formFieldId);
    if (fieldIndex === -1) {
      return;
    }

    const field = { ...formFields[fieldIndex] };
    field.id = newId ?? field.id;
    field.label = newLabel || undefined;
    field.type = newType || undefined;
    field.defaultValue = newDefaultValue || undefined;
    field.customForm = newCustomFormConfig || undefined;

    if (newType !== 'enum') {
      delete field.values;
    }

    formFields[fieldIndex] = field;

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const moveFormField = (args: any): void => {
    const { element, formFieldId, direction } = args;

    const formFields = readFormFields(element);
    const fieldIndex = formFields.findIndex((field) => field.id === formFieldId);
    if (fieldIndex === -1) {
      return;
    }

    if (direction === 'up' && fieldIndex > 0) {
      const temp = formFields[fieldIndex - 1];
      formFields[fieldIndex - 1] = formFields[fieldIndex];
      formFields[fieldIndex] = temp;
    } else if (direction === 'down' && fieldIndex < formFields.length - 1) {
      const temp = formFields[fieldIndex + 1];
      formFields[fieldIndex + 1] = formFields[fieldIndex];
      formFields[fieldIndex] = temp;
    }

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const addEnumValue = (args: any): void => {
    const { element, formFieldId, initialProperty } = args;

    const formFields = readFormFields(element);
    const field = formFields.find((field) => field.id === formFieldId);
    if (field == null) {
      return;
    }

    if (field.values == null) {
      field.values = [];
    }

    field.values.push({
      id: initialProperty?.key || `Value_${generateRandomId()}`,
      name: initialProperty?.value || undefined,
    });

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const deleteEnumValue = (args: any): void => {
    const { element, formFieldId, index } = args;

    const formFields = readFormFields(element);
    const field = formFields.find((field) => field.id === formFieldId);
    if (field?.values == null) {
      return;
    }

    field.values.splice(index, 1);
    if (field.values.length === 0) {
      delete field.values;
    }

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const updateEnumValue = (args: any): void => {
    const { element, formFieldId, index, enumValue } = args;

    const formFields = readFormFields(element);
    const field = formFields.find((field) => field.id === formFieldId);
    if (field?.values == null || field.values[index] == null) {
      return;
    }

    field.values[index] = {
      id: enumValue.key || undefined,
      name: enumValue.value || undefined,
    };

    const commands = writeFormFieldsCommands(element, this.bpmnFactory, formFields);
    if (commands.length > 0) {
      const commandToExecute = CmdHelper.executeMultipleCommands(commands);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const commandHandler = {
    addFormField,
    deleteFormField,
    updateFormField,
    moveFormField,
    addEnumValue,
    deleteEnumValue,
    updateEnumValue,
  };

  commandHandler[command](restArgs);
};

export default UpdateUserTaskHandler;
