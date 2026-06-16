import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import { CmdHelper } from './Helper/CommmandHelper';

const EXTENSION_ELEMENT_SELECTOR = 'extensionElements';
const MODDLE_BPMN_EXTENSION_ELEMENT_TYPE = 'bpmn:ExtensionElements';
const MODDLE_PROPERTIES_TYPE = 'evil:Properties';
const MODDLE_PROPERTY_TYPE = 'evil:Property';

export function CustomPropertyHandler(this: any, commandStack: CommandStack, bpmnFactory: any): void {
  this.commandStack = commandStack;
  this.bpmnFactory = bpmnFactory;
}

function createProperties(bpmnFactory: any, extensionElements: any): any {
  const properties = bpmnFactory.create(MODDLE_PROPERTIES_TYPE, {
    values: [],
  });
  properties.$parent = extensionElements;

  return properties;
}

function createExtensionElementWithEmptyProperties(bpmnFactory: any, element: ElementLike): any {
  const extensionElements = bpmnFactory.create(MODDLE_BPMN_EXTENSION_ELEMENT_TYPE, {
    values: [],
  });
  extensionElements.$parent = element.businessObject;
  const properties = createProperties(bpmnFactory, extensionElements);

  extensionElements.values = [properties];

  return extensionElements;
}

CustomPropertyHandler.$inject = ['commandStack', 'bpmnFactory'];

function findPropertiesContainer(extensionElements: any): any | null {
  return extensionElements?.values?.find((value: any) => value.$type === MODDLE_PROPERTIES_TYPE);
}

function isPropertiesContainer(value: any): boolean {
  return value.$type === MODDLE_PROPERTIES_TYPE;
}

CustomPropertyHandler.prototype.preExecute = function (context: any) {
  const { command, ...restArgs } = context;

  const createCustomProperty = (args: any): void => {
    const { element, customProperty } = args;

    const businessObject = getBusinessObject(element);

    const newProperty = this.bpmnFactory.create(MODDLE_PROPERTY_TYPE, {
      name: customProperty.name,
      value: customProperty.value,
    });

    let extensionElements = businessObject.get(EXTENSION_ELEMENT_SELECTOR);
    const existingProperties = findPropertiesContainer(extensionElements);

    if (extensionElements == null) {
      extensionElements = createExtensionElementWithEmptyProperties(this.bpmnFactory, element);

      const properties = findPropertiesContainer(extensionElements);
      newProperty.$parent = properties;
      properties.values = [newProperty];

      const props = {
        extensionElements: extensionElements,
      };

      const commandToExecute = CmdHelper.updateBusinessObject(element, element.businessObject, props);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    } else if (existingProperties == null) {
      const properties = createProperties(this.bpmnFactory, extensionElements);
      newProperty.$parent = properties;
      properties.values = [newProperty];

      const props = {
        values: [...extensionElements.values, properties],
      };

      const commandToExecute = CmdHelper.updateBusinessObject(element, extensionElements, props);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    } else {
      newProperty.$parent = existingProperties;

      const values = existingProperties?.values || [];
      const newProperties = [...values, newProperty];

      const props = {
        values: newProperties,
      };

      const commandToExecute = CmdHelper.updateBusinessObject(element, existingProperties, props);
      this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
    }
  };

  const deleteCustomProperty = (args: any): void => {
    const { element, index } = args;

    const businessObject = getBusinessObject(element);
    const extensionElements = businessObject.get(EXTENSION_ELEMENT_SELECTOR);
    const properties = findPropertiesContainer(extensionElements);
    const propertiesValues = properties?.values || [];
    const newPropertiesValues: any[] = [...propertiesValues];
    newPropertiesValues.splice(index, 1);

    let commandToExecute;
    const isEmpty = newPropertiesValues.length === 0;
    if (isEmpty) {
      const onlyOneValueInExtensionElement = extensionElements.values.length === 1;
      const valueIsProperties = properties != null;
      if (onlyOneValueInExtensionElement && valueIsProperties) {
        commandToExecute = CmdHelper.updateBusinessObject(element, element.businessObject, {
          extensionElements: undefined,
        });
      } else {
        const newValues: any[] = [];
        extensionElements?.values?.forEach((value) => {
          if (!isPropertiesContainer(value)) {
            newValues.push(value);
          }
        });
        commandToExecute = CmdHelper.updateBusinessObject(element, element.businessObject.extensionElements, {
          values: newValues,
        });
      }
    } else {
      commandToExecute = CmdHelper.updateBusinessObject(element, properties, {
        values: newPropertiesValues,
      });
    }

    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const updateCustomProperty = (args: any): void => {
    const { element, index, customProperty, removeOnEmptyValue } = args;

    if (removeOnEmptyValue && (customProperty.value == null || customProperty.value === '')) {
      return deleteCustomProperty(args);
    }
    const businessObject = getBusinessObject(element);
    const extensionElements = businessObject.get(EXTENSION_ELEMENT_SELECTOR);

    const properties = findPropertiesContainer(extensionElements);
    const property = properties?.values[index];

    const props = {
      name: customProperty.name,
      value: customProperty.value,
    };

    const commandToExecute = CmdHelper.updateBusinessObject(element, property, props);
    this.commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  };

  const commandHandler = {
    create: createCustomProperty,
    update: updateCustomProperty,
    delete: deleteCustomProperty,
  };

  commandHandler[command](restArgs);
};

export default CustomPropertyHandler;
