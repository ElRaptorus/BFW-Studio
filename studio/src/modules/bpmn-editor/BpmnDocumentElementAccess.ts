import type BpmnModelerComponentAdapter from '#modules/bpmn-core/BpmnModelerComponentAdapter';
import { CmdHelper } from '#modules/bpmn-core/bpmn-js/CommandHandler/Helper/CommmandHelper';
import { getFillColor, getStrokeColor } from 'bpmn-js/lib/draw/BpmnRenderUtil';

import type { BpmnElement } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';
import type {
  BpmnElementColor,
  BpmnElementCustomProperty,
  BpmnElement_Definition,
  BpmnElement_EscalationBoundaryEvent,
  BpmnElement_EscalationStartEvent,
  BpmnElement_Participant,
  BpmnElement_Process,
  FormAction,
  FormFieldDefinition,
} from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { BpmnElementType, BpmnTimerType, LoopCharacteristics } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import {
  findAllEvilExtensions,
  getEvilBodyValue,
  setEvilBodyExtension,
} from '../bpmn-core/bpmn-js/CommandHandler/Utils/EvilExtensionHelper';
import {
  getRoot,
  isEventSubprocess,
  isHttpServiceTask,
  isSequenceFlowConditional,
  isSequenceFlowDefault,
} from '../bpmn-core/bpmn-js/CommandHandler/Utils/Utils';
import {
  assertBpmnElementIsBusinessRuleTask,
  assertBpmnElementIsCallActivity,
  assertBpmnElementIsConditionalEvent,
  assertBpmnElementIsErrorEvent,
  assertBpmnElementIsEscalationBoundaryEvent,
  assertBpmnElementIsEscalationEvent,
  assertBpmnElementIsEscalationStartEvent,
  assertBpmnElementIsGroup,
  assertBpmnElementIsHttpServiceTask,
  assertBpmnElementIsParticipant,
  assertBpmnElementIsProcess,
  assertBpmnElementIsTimerEvent,
  assertBpmnElementIsUserTask,
} from './panes/BpmnElementTypeAssertionFunctions';

const MODDLE_BPMN_DOCUMENTATION_TYPE = 'bpmn:Documentation';
const MODDLE_EVIL_PROPERTIES_TYPE = 'evil:Properties';
const MODDLE_BPMN_MESSAGE_SELECTOR = 'messageRef';
const MODDLE_BPMN_CALLED_ELEMENT_SELECTOR = 'calledElement';
const MODDLE_BPMN_EXTENSION_ELEMENTS_SELECTOR = 'extensionElements';
const MODDLE_BPMN_SCRIPT_SELECTOR = 'script';
const MODDLE_BPMN_IS_EXECUTABLE_SELECTOR = 'isExecutable';
const MODDLE_BPMN_PROCESS_SELECTOR = 'processRef';
const MODDLE_BPMN_CONDITION_SELECTOR = 'condition';
const MODDLE_BPMN_ESCALATION_REF_SELECTOR = 'escalationRef';
const MODDLE_BPMN_TEXT_SELECTOR = 'text';
const MODDLE_BPMN_CATEGORY_REF_SELECTOR = 'categoryValueRef';
const MODDLE_BPMN_BOUNDARY_EVENT_TYPE = 'bpmn:BoundaryEvent';
const MODDLE_BPMN_INTERMEDIATE_CATCH_EVENT_TYPE = 'bpmn:IntermediateCatchEvent';
const MODDLE_BPMN_INTERMEDIATE_THROW_EVENT_TYPE = 'bpmn:IntermediateThrowEvent';
const MODDLE_BPMN_END_EVENT_TYPE = 'bpmn:EndEvent';
const MODDLE_BPMN_START_EVENT_TYPE = 'bpmn:StartEvent';
const MODDLE_BPMN_RECEIVE_TASK_TYPE = 'bpmn:ReceiveTask';
const MODDLE_BPMN_SEND_TASK_TYPE = 'bpmn:SendTask';
const MODDLE_BPMN_MANUAL_TASK_TYPE = 'bpmn:ManualTask';
const MODDLE_BPMN_USER_TASK_TYPE = 'bpmn:UserTask';
const MODDLE_BPMN_UNTYPED_TASK_TYPE = 'bpmn:Task';
const MODDLE_BPMN_SCRIPT_TASK_TYPE = 'bpmn:ScriptTask';
const MODDLE_BPMN_EXCLUSIVE_GATEWAY = 'bpmn:ExclusiveGateway';
const MODDLE_BPMN_PARALLEL_GATEWAY = 'bpmn:ParallelGateway';
const MODDLE_BPMN_COMPLEX_GATEWAY = 'bpmn:ComplexGateway';
const MODDLE_BPMN_INCLUSIVE_GATEWAY = 'bpmn:InclusiveGateway';
const MODDLE_BPMN_EVENT_BASED_GATEWAY = 'bpmn:EventBasedGateway';
const MODDLE_BPMN_SEQUENCE_FLOW_TYPE = 'bpmn:SequenceFlow';
const MODDLE_BPMN_MESSAGE_FLOW_TYPE = 'bpmn:MessageFlow';
const MODDLE_BPMN_CALL_ACTIVITY_TYPE = 'bpmn:CallActivity';
const MODDLE_BPMN_PROCESS_TYPE = 'bpmn:Process';
const MODDLE_DEFINITION_TYPE = 'bpmn:Definitions';
const MODDLE_BPMN_PARTICIPANT_TYPE = 'bpmn:Participant';
const MODDLE_BPMN_DATA_OBJECT_TYPE = 'bpmn:DataObjectReference';
const MODDLE_BPMN_DATA_STORE_TYPE = 'bpmn:DataStoreReference';
const MODDLE_BPMN_ASSOCIATION_TYPE = 'bpmn:Association';
const MODDLE_BPMN_DATA_INPUT_ASSOCIATION_TYPE = 'bpmn:DataInputAssociation';
const MODDLE_BPMN_DATA_OUTPUT_ASSOCIATION_TYPE = 'bpmn:DataOutputAssociation';
const MODDLE_BPMN_SERVICE_TASK_TYPE = 'bpmn:ServiceTask';
const MODDLE_BPMN_TEXT_ANNOTATION_TYPE = 'bpmn:TextAnnotation';
const MODDLE_BPMN_GROUP_TYPE = 'bpmn:Group';
const MODDLE_BPMN_TRANSACTION_TYPE = 'bpmn:Transaction';
const MODDLE_BPMN_ADHOC_SUBPROCESS_TYPE = 'bpmn:AdHocSubProcess';
const MODDLE_BPMN_BUSINESS_RULE_TASK_TYPE = 'bpmn:BusinessRuleTask';
const MODDLE_BPMN_SUBPROCESS = 'bpmn:SubProcess';
const MODDLE_BPMN_CONDITION_EXPRESSION_SELECTOR = 'conditionExpression';
const MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE = 'bpmn:MessageEventDefinition';
const MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE = 'bpmn:SignalEventDefinition';
const MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE = 'bpmn:ErrorEventDefinition';
const MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE = 'bpmn:TimerEventDefinition';
const MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE = 'bpmn:LinkEventDefinition';
const MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE = 'bpmn:ConditionalEventDefinition';
const MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE = 'bpmn:EscalationEventDefinition';
const MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE = 'bpmn:CompensateEventDefinition';
const MODDLE_BPMN_CANCEL_EVENT_DEFINITION_TYPE = 'bpmn:CancelEventDefinition';
const MODDLE_BPMN_TERMINATE_EVENT_DEFINITION_TYPE = 'bpmn:TerminateEventDefinition';

export const EVENT_BPMN_ELEMENT_PROPERTY_UPDATED = 'EVENT_BPMN_ELEMENT_PROPERTY_UPDATED';
export const EVENT_BPMN_ELEMENT_ID_UPDATED = 'EVENT_BPMN_ELEMENT_ID_UPDATED';

// Types with the 'Modeler' prefix are coming from the Bpmn.io modeler component.
// We should not assume anything about this third party component.
type ModelerElementPropertyValue = any;

export default class BpmnDocumentElementAccess extends AbstractEmitter {
  private bpmnModelerProxy: BpmnModelerComponentAdapter;

  constructor(bpmnModelerProxy: BpmnModelerComponentAdapter) {
    super();
    this.bpmnModelerProxy = bpmnModelerProxy;
  }

  isInsideSubprocessPlane(): boolean {
    const canvas = this.bpmnModelerProxy.getCanvas();
    const rootElement = canvas.getRootElement();
    const rootType = rootElement?.businessObject?.$type;
    return (
      rootType === MODDLE_BPMN_SUBPROCESS ||
      rootType === MODDLE_BPMN_TRANSACTION_TYPE ||
      rootType === MODDLE_BPMN_ADHOC_SUBPROCESS_TYPE
    );
  }

  getCurrentRootElement(): any {
    return this.bpmnModelerProxy.getCanvas().getRootElement();
  }

  getFormFieldDefinitions(elementId: string): FormFieldDefinition[] {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      return [];
    }

    const formFieldsJson = getEvilBodyValue(element.businessObject, 'evil:FormFields');
    if (formFieldsJson == null || formFieldsJson.trim() === '') {
      return [];
    }

    try {
      const parsed = JSON.parse(formFieldsJson);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as FormFieldDefinition[];
    } catch {
      return [];
    }
  }

  setFormFieldDefinitions(elementId: string, fields: FormFieldDefinition[]): void {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      return;
    }

    const commandStack = this.bpmnModelerProxy.getCommandStack();
    const bpmnFactory = this.bpmnModelerProxy.getBpmnFactory();
    const serialized = fields.length > 0 ? JSON.stringify(fields) : null;
    const commands = setEvilBodyExtension(element, bpmnFactory, 'evil:FormFields', serialized);
    for (const command of commands) {
      commandStack.execute(command.cmd, command.context);
    }
  }

  getFormActions(elementId: string): FormAction[] {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      return [];
    }

    const formActionsJson = getEvilBodyValue(element.businessObject, 'evil:FormActions');
    if (formActionsJson == null || formActionsJson.trim() === '') {
      return [];
    }

    try {
      return JSON.parse(formActionsJson) as FormAction[];
    } catch {
      return [];
    }
  }

  setFormActions(elementId: string, actions: FormAction[]): void {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      return;
    }

    const commandStack = this.bpmnModelerProxy.getCommandStack();
    const bpmnFactory = this.bpmnModelerProxy.getBpmnFactory();
    const serialized = actions.length > 0 ? JSON.stringify(actions) : null;
    const commands = setEvilBodyExtension(element, bpmnFactory, 'evil:FormActions', serialized);
    for (const command of commands) {
      commandStack.execute(command.cmd, command.context);
    }
  }

  getAllIds(): string[] {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const allIds = Object.keys(elementRegistry['_elements']);
    const definition = this.getDefinition();

    const expandedParticipants = this.getByType<BpmnElement_Participant>(BpmnElementType.Participant).filter(
      (participant) => !participant.collapsed,
    );

    const processIds = expandedParticipants.map((participant) => {
      return participant.process.id;
    });

    return [...allIds, definition.id, ...processIds];
  }

  getColor(elementId: string): BpmnElementColor | null {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const element = elementRegistry.get(elementId);

    const fillColor = getFillColor(element);
    const strokeColor = getStrokeColor(element);

    const color: BpmnElementColor = {
      backgroundColor: fillColor == null || fillColor === 'white' ? undefined : fillColor.toLowerCase(),
      borderColor: strokeColor == null || strokeColor === 'hsl(225, 10%, 15%)' ? undefined : strokeColor.toLowerCase(),
    };

    if (!color.borderColor && !color.backgroundColor) {
      return null;
    }

    return color;
  }

  setBackgroundColor(elementId: string, color: string): void {
    const modeling = this.bpmnModelerProxy.getModeling() as any;
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const elementToColor = elementRegistry.get(elementId);

    if (elementToColor == null) {
      return;
    }

    const previousColorOfElement = this.getColor(elementId);
    modeling.setColor(elementToColor, {
      fill: color,
      stroke: previousColorOfElement?.borderColor,
    });
  }

  setBorderColor(elementId: string, color: string): void {
    const modeling = this.bpmnModelerProxy.getModeling() as any;
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const elementToColor = elementRegistry.get(elementId);

    if (elementToColor == null) {
      return;
    }

    const previousColorOfElement = this.getColor(elementId);

    modeling.setColor(elementToColor, {
      fill: previousColorOfElement?.backgroundColor,
      stroke: color,
    });
  }

  setColor(elementId: string, color: BpmnElementColor | null): void {
    const modeling = this.bpmnModelerProxy.getModeling() as any;
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const elementToColor = elementRegistry.get(elementId);

    if (elementToColor == null) {
      return;
    }

    modeling.setColor(elementToColor, {
      fill: color?.backgroundColor,
      stroke: color?.borderColor,
    });
  }

  getByType<T = BpmnElement>(elementType: BpmnElementType): T[] {
    if (elementType === BpmnElementType.Definition) {
      const elementsArray: any[] = [];
      elementsArray.push(this.castDefinitionToBpmnElement(this.getDefinition()));
      return elementsArray;
    }

    const modelerType = this.getModelerElementType(elementType);

    const allElementsOfType = this.bpmnModelerProxy
      .getElementRegistry()
      .filter((element) => element.type === modelerType);

    return allElementsOfType.map((element) => {
      return this.castElement(element);
    }) as T[];
  }

  getById(elementId: string): BpmnElement | null {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const elementFromRegistry = elementRegistry.get(elementId);
    if (elementRegistry == null || elementFromRegistry == null) {
      return null;
    }
    return this.castElement(elementFromRegistry);
  }

  getCustomProperties(elementId: string): BpmnElementCustomProperty[] | null {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);

    const extensionElements = selectedElement?.businessObject?.get(MODDLE_BPMN_EXTENSION_ELEMENTS_SELECTOR);

    if (extensionElements == null) {
      return null;
    }

    const customProperties = extensionElements.values?.find(
      (value: any) => value.$type === MODDLE_EVIL_PROPERTIES_TYPE,
    );

    if (customProperties == null || customProperties.values == null || customProperties.values.length === 0) {
      return null;
    }

    const castedCustomPropertyElements: BpmnElementCustomProperty[] = customProperties.values.map((property: any) =>
      this.castCustomProperty(property),
    );

    return castedCustomPropertyElements;
  }

  deleteCustomFormProperty(elementId: string, customFormPropertyName: string): void {
    const castedElement = this.getById(elementId);
    assertBpmnElementIsUserTask(castedElement);

    const indexOfCustomFormProperty = castedElement.customProperties?.findIndex(
      (property) => property.name === customFormPropertyName,
    );

    if (indexOfCustomFormProperty == null) {
      return;
    }

    this.deleteCustomProperty(elementId, indexOfCustomFormProperty);
  }

  setCustomProperty(elementId: string, propertyName: string, value: any): void {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);
    if (selectedElement == null) {
      return;
    }
    const commandStack = this.bpmnModelerProxy.getCommandStack();
    const customProperties = this.getCustomProperties(elementId) || [];

    const index = customProperties.findIndex((property) => property.name === propertyName);

    if (index === -1) {
      if (value != null && value !== '') {
        return this.addCustomProperty(elementId, propertyName, value.toString());
      } else {
        return;
      }
    }

    const updatedProperty: BpmnElementCustomProperty = {
      name: propertyName,
      value: value?.toString(),
    };

    const commandToExecute = CmdHelper.updateCustomProperty(selectedElement, index, updatedProperty);
    commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }

  setCustomPropertyName(elementId: string, index: number, name: string): void {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);
    if (selectedElement == null) {
      return;
    }
    const commandStack = this.bpmnModelerProxy.getCommandStack();

    const customProperties = this.getCustomProperties(elementId) || [];
    const customProperty = customProperties[index];

    if (customProperty == null) {
      if (name.trim() === '') {
        return;
      }

      this.addCustomProperty(elementId, name.trim());
      return;
    }

    const newCustomProperty: BpmnElementCustomProperty = {
      name: name.trim(),
      value: customProperty?.value,
    };

    if (newCustomProperty.name === '' && newCustomProperty.value === '') {
      this.deleteCustomProperty(elementId, index);
      return;
    }

    const commandToExecute = CmdHelper.updateCustomProperty(selectedElement, index, newCustomProperty, false);

    commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }

  setCustomPropertyValue(elementId: string, index: number, value: string): void {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);
    if (selectedElement == null) {
      return;
    }
    const commandStack = this.bpmnModelerProxy.getCommandStack();

    const customProperties = this.getCustomProperties(elementId) || [];
    const customProperty = customProperties[index];

    if (customProperty == null) {
      if (value.trim() === '') {
        return;
      }

      this.addCustomProperty(elementId, undefined, value.trim());
      return;
    }

    const newCustomProperty: BpmnElementCustomProperty = {
      name: customProperty?.name,
      value: value.trim(),
    };

    if (newCustomProperty.name === '' && newCustomProperty.value === '') {
      this.deleteCustomProperty(elementId, index);
      return;
    }

    const commandToExecute = CmdHelper.updateCustomProperty(selectedElement, index, newCustomProperty, false);

    commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }

  addCustomProperty(elementId: string, name?: string, value?: string): void {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);
    if (selectedElement == null) {
      return;
    }
    const commandStack = this.bpmnModelerProxy.getCommandStack();

    const commandToExecute = CmdHelper.createCustomProperty(selectedElement, {
      name: name ?? '',
      value: value ?? '',
    });

    commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }

  deleteCustomProperty(elementId: string, index: number): void {
    const selectedElement = this.bpmnModelerProxy.getElementRegistry().get(elementId);
    if (selectedElement == null) {
      return;
    }
    const commandStack = this.bpmnModelerProxy.getCommandStack();
    const commandToExecute = CmdHelper.deleteCustomProperty(selectedElement, index);

    commandStack.execute(commandToExecute.cmd, commandToExecute.context);
  }

  getAllElements(): BpmnElement[] {
    const canvas = this.bpmnModelerProxy.getCanvas();
    const rootElement = canvas.getRootElement();

    const elementRegistry = this.bpmnModelerProxy.getElementRegistry() ?? [];
    const elements = elementRegistry.filter((element: any) => {
      return element !== rootElement;
    });

    return elements.map((element: any) => this.castElement(element));
  }

  /**
   * Returns only the elements that belong to the currently active canvas plane.
   * Unlike `getAllElements()`, which returns elements from *every* plane in the
   * flat element registry, this method walks each element's `.parent` chain and
   * only includes elements whose root ancestor is the current canvas root.
   */
  getVisibleElements(): BpmnElement[] {
    const canvas = this.bpmnModelerProxy.getCanvas();
    const rootElement = canvas.getRootElement();

    const elementRegistry = this.bpmnModelerProxy.getElementRegistry() ?? [];
    const elements = elementRegistry.filter((element: any) => {
      if (element === rootElement) {
        return false;
      }
      let current = element;
      while (current.parent != null) {
        if (current.parent === rootElement) {
          return true;
        }
        current = current.parent;
      }
      return false;
    });

    return elements.map((element: any) => this.castElement(element));
  }

  setElementProperty(elementId: string, propertyName: string, newPropertyValue: ModelerElementPropertyValue): void {
    const modeling = this.bpmnModelerProxy.getModeling() as any;
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    let selectedElement = elementRegistry.get(elementId);

    if (selectedElement == null && propertyName === 'definition') {
      selectedElement = this.getDefinition();
    } else if (selectedElement == null) {
      console.error(`ERROR: setElementProperty could not find element ${elementId}`);
      return;
    }

    const oldPropertyValue = this.getElementPropertyValue(elementId, propertyName);

    if (oldPropertyValue === newPropertyValue) {
      return;
    }

    const setHandlers: any = {
      '*': (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const props: any = {};
        props[propertyName] = propertyValue;
        modeling.updateProperties(element, props);
      },
      name: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        modeling.updateLabel(element, propertyValue);
      },
      documentation: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const moddle = this.bpmnModelerProxy.getModdle();
        const documentation: any = moddle.create(MODDLE_BPMN_DOCUMENTATION_TYPE, { text: propertyValue });
        const elementInPanelDocumentation = { documentation: [documentation] };
        modeling.updateProperties(element, elementInPanelDocumentation);
      },
      message: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateMessage(element, propertyValue.value);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      signal: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateSignal(element, propertyValue.value);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      error: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsErrorEvent(castedElement);

        const errorName = castedElement.errorName;
        const errorCode = propertyValue.errorCode == null ? castedElement.errorCode : propertyValue.errorCode;
        const errorMessage =
          propertyValue.errorMessage == null ? castedElement.errorMessage : propertyValue.errorMessage;

        const noChangesToApply = errorCode === castedElement.errorCode && errorMessage === castedElement.errorMessage;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateError(element, errorName, errorCode, errorMessage);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      timer: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsTimerEvent(castedElement);

        const timerType = propertyValue.timerType == null ? castedElement.timerType : propertyValue.timerType;
        const timerDefinition =
          propertyValue.timerDefinition == null ? castedElement.timerDefinition : propertyValue.timerDefinition;

        const noChangesToApply =
          timerType === castedElement.timerType && timerDefinition === castedElement.timerDefinition;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateTimer(element, timerType, timerDefinition);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      condition: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateCondition(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      link: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateLink(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      script: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const newScript = typeof propertyValue === 'string' ? propertyValue : propertyValue?.script;
        const newScriptRef = typeof propertyValue === 'string' ? undefined : propertyValue?.scriptRef;

        const commandToExecute = CmdHelper.updateOrCreateScript(element, newScript, newScriptRef);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      callActivity: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsCallActivity(castedElement);

        const processModelId = propertyValue.processModelId ?? castedElement.processModelId;
        const startEventId = propertyValue.startEventId ?? castedElement.startEventId;

        const noChangesToApply =
          processModelId === castedElement.processModelId && startEventId === castedElement.startEventId;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateOrCreateCallActivity(element, processModelId, startEventId);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      process: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        let process: BpmnElement_Process;

        if (castedElement?.type === BpmnElementType.Participant) {
          assertBpmnElementIsParticipant(castedElement);
          assertNotNull(castedElement.process, 'castedElement.process');
          process = castedElement.process;
        } else {
          assertBpmnElementIsProcess(castedElement);
          process = castedElement;
        }

        const processId = propertyValue.id ?? process.id;
        const processName = propertyValue.name ?? process.name;
        const version = propertyValue.version ?? process.version;
        const correlationKey = propertyValue.correlationKey ?? process.correlationKey;
        const isExecutable = propertyValue.isExecutable ?? process.isExecutable;

        const noChangesToApply =
          processId === process.id &&
          processName === process.name &&
          version === process.version &&
          correlationKey === process.correlationKey &&
          isExecutable === process.isExecutable;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateProcess(
          element,
          processId,
          processName,
          version,
          correlationKey,
          isExecutable,
        );
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      conditionalEvent: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        if (!castedElement?.type.endsWith('/Conditional')) {
          return;
        }
        assertBpmnElementIsConditionalEvent(castedElement);

        const condition = propertyValue.condition ?? castedElement.condition;

        const noChangesToApply = condition === castedElement.condition;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateConditionalEvent(element, condition);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      escalation: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const castedElement = this.getById(elementId);
        if (!castedElement?.type.endsWith('/Escalation')) {
          return;
        }
        assertBpmnElementIsEscalationEvent(castedElement);

        const name = propertyValue.name ?? castedElement.name;
        const escalationCode = propertyValue.escalationCode ?? castedElement.escalationCode;
        let noChangesToApply = name === castedElement.name && escalationCode === castedElement.escalationCode;

        const setNoChangesToApply = (
          castedElement: BpmnElement_EscalationBoundaryEvent | BpmnElement_EscalationStartEvent,
        ): void => {
          noChangesToApply = name === castedElement.name && escalationCode === castedElement.escalationCode;
        };

        if (castedElement.type === BpmnElementType.EscalationBoundaryEvent) {
          assertBpmnElementIsEscalationBoundaryEvent(castedElement);
          setNoChangesToApply(castedElement);
        } else if (castedElement.type === BpmnElementType.EscalationStartEvent) {
          assertBpmnElementIsEscalationStartEvent(castedElement);
          setNoChangesToApply(castedElement);
        }

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateEscalationEvent(element, name, escalationCode);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      compensationActivityRef: (element: any, _propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const businessObject = element.businessObject;
        const compensateDefinition = businessObject?.eventDefinitions?.find(
          (definition: any) => definition.$type === MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE,
        );
        if (compensateDefinition == null) {
          return;
        }

        const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
        const targetActivityId: string | null = propertyValue ?? null;
        const targetElement = targetActivityId ? elementRegistry.get(targetActivityId) : null;
        const activityRef = targetElement?.businessObject ?? undefined;

        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateBusinessObject(element, compensateDefinition, { activityRef });
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      textAnnotation: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const props = {
          text: propertyValue,
        };
        modeling.updateProperties(element, props);
      },
      serviceTaskImplementation: (element: any, propertyName: string, propertyValue: { newImplementation: string }) => {
        const { newImplementation } = propertyValue;

        const currentImpl = element.businessObject?.get('implementation');
        if (currentImpl === newImplementation) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commands: any = [];

        commands.push(CmdHelper.updateServiceTaskType(element, newImplementation));

        const commandToExecute = CmdHelper.executeMultipleCommands(commands);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      loopConfig: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateLoopCharacteristics(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      adHocSubprocess: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateAdHocSubprocess(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      userTaskResources: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateUserTaskResources(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      httpTask: (element: any, propertyName: string, propertyValue: any) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsHttpServiceTask(castedElement);

        const method = propertyValue.method ?? castedElement.method;
        const url = propertyValue.url ?? castedElement.url;
        const body = propertyValue.body ?? castedElement.body;
        const authHeader = propertyValue.authHeader ?? castedElement.authHeader;
        const responseHeaders = propertyValue.responseHeaders ?? castedElement.responseHeaders;

        const noChangesToApply =
          method === castedElement.method &&
          url === castedElement.url &&
          body === castedElement.body &&
          authHeader === castedElement.authHeader &&
          responseHeaders === castedElement.responseHeaders;

        if (noChangesToApply) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateHttpServiceTask(
          element,
          method,
          url,
          body,
          authHeader,
          responseHeaders,
        );
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      categoryValue: (element: any, propertyName: string, propertyValue: any) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsGroup(castedElement);

        const categoryValue = propertyValue ?? castedElement.categoryValue;
        const noChangesToApply = categoryValue === castedElement.categoryValue;

        if (noChangesToApply) {
          return;
        }

        modeling.updateLabel(element, categoryValue);
      },
      definition: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateDefinitionId(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      businessRule: (element: any, propertyName: string, propertyValue: any) => {
        const castedElement = this.getById(elementId);
        assertBpmnElementIsBusinessRuleTask(castedElement);

        const { command: subCommand, ...args } = propertyValue;
        if (subCommand == null) {
          return;
        }

        const commandStack = this.bpmnModelerProxy.getCommandStack();

        const commandToExecute = CmdHelper.updateBusinessRuleTask(element, subCommand, args);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      transformation: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const moddle = this.bpmnModelerProxy.getModdle();
        if (propertyValue == null || propertyValue === '') {
          modeling.updateProperties(element, { transformation: undefined });
        } else {
          const formalExpression = moddle.create('bpmn:FormalExpression', { body: propertyValue });
          modeling.updateProperties(element, { transformation: formalExpression });
        }
      },
      activationCondition: (element: any, propertyName: string, propertyValue: ModelerElementPropertyValue) => {
        const moddle = this.bpmnModelerProxy.getModdle();
        if (propertyValue == null || propertyValue === '') {
          modeling.updateProperties(element, { activationCondition: undefined });
        } else {
          const formalExpression = moddle.create('bpmn:FormalExpression', { body: propertyValue });
          modeling.updateProperties(element, { activationCondition: formalExpression });
        }
      },
      dataPipeline: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateDataPipeline(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      correlationRetrievalExpression: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commandToExecute = CmdHelper.updateCorrelationRetrievalExpression(element, propertyValue);
        commandStack.execute(commandToExecute.cmd, commandToExecute.context);
      },
      userTaskExtensions: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const bpmnFactory = this.bpmnModelerProxy.getBpmnFactory();
        const entries: { type: string; value: string | null }[] = [];
        if (propertyValue.assignees !== undefined) {
          entries.push({ type: 'evil:Assignees', value: propertyValue.assignees || null });
        }
        if (propertyValue.dueDate !== undefined) {
          entries.push({ type: 'evil:DueDate', value: propertyValue.dueDate || null });
        }
        if (propertyValue.priority !== undefined) {
          const val = propertyValue.priority != null ? String(propertyValue.priority) : null;
          entries.push({ type: 'evil:Priority', value: val });
        }
        for (const entry of entries) {
          const commands = setEvilBodyExtension(element, bpmnFactory, entry.type, entry.value);
          for (const cmd of commands) {
            commandStack.execute(cmd.cmd, cmd.context);
          }
        }
      },
      manualTask: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const requireConfirmation = propertyValue.requireConfirmation;
        const commands = setEvilBodyExtension(
          element,
          this.bpmnModelerProxy.getBpmnFactory(),
          'evil:RequireConfirmation',
          requireConfirmation ? 'true' : null,
        );
        for (const cmd of commands) {
          commandStack.execute(cmd.cmd, cmd.context);
        }
      },
      dataObject: (element: any, propertyName: string, propertyValue: any) => {
        const commandStack = this.bpmnModelerProxy.getCommandStack();
        const commands = setEvilBodyExtension(
          element,
          this.bpmnModelerProxy.getBpmnFactory(),
          'evil:ValueContract',
          propertyValue.valueContract || null,
        );
        for (const cmd of commands) {
          commandStack.execute(cmd.cmd, cmd.context);
        }
      },
    };

    const nameKey = propertyName.substring(0, 1).toLowerCase() + propertyName.substring(1);
    const setHandler: any = setHandlers[nameKey] || setHandlers['*'];

    setHandler(selectedElement, propertyName, newPropertyValue);

    this.emit(EVENT_BPMN_ELEMENT_PROPERTY_UPDATED, [propertyName, newPropertyValue, oldPropertyValue]);

    if (propertyName === 'id') {
      const newElementId = newPropertyValue;

      this.emit(EVENT_BPMN_ELEMENT_ID_UPDATED, [oldPropertyValue, newElementId]);
    }
  }

  getElementPropertyValue(elementId: string, propertyName: string): ModelerElementPropertyValue {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const selectedElement = elementRegistry.get(elementId);

    if (selectedElement == null) {
      console.error('ERROR: getElementPropertyValue could not find element ', elementId);
      return;
    }

    const getHandlers: any = {
      '*': (element: any, propertyName: string) =>
        element.type === 'label' && propertyName === 'id'
          ? element[propertyName]
          : element.businessObject[propertyName],
      documentation: (element: any, propertyName: string) => {
        const documentation = element.businessObject && element.businessObject.documentation;
        return Array.isArray(documentation) && documentation.length > 0 ? documentation[0].text : '';
      },
      loopCharacteristics: (element: any) => {
        const loopCharacteristics =
          element.businessObject && element.businessObject.loopCharacteristics
            ? element.businessObject.loopCharacteristics
            : undefined;

        if (!loopCharacteristics) {
          return undefined;
        }

        if (loopCharacteristics.isSequential === false) {
          return LoopCharacteristics.Parallel;
        }

        if (loopCharacteristics.isSequential === true) {
          return LoopCharacteristics.Sequential;
        }

        return LoopCharacteristics.Loop;
      },
      loopConfig: (element: any) => {
        const loopChars = element.businessObject?.loopCharacteristics;
        if (!loopChars) {
          return undefined;
        }

        if (loopChars.$type === 'bpmn:StandardLoopCharacteristics') {
          return {
            kind: 'standard' as const,
            testBefore: loopChars.testBefore === true,
            loopCondition: loopChars.loopCondition?.body ?? undefined,
            loopMaximum: loopChars.loopMaximum != null ? String(loopChars.loopMaximum) : undefined,
            loopInterval: getEvilBodyValue(loopChars, 'evil:LoopInterval'),
          };
        }

        if (loopChars.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
          return {
            kind: 'multiInstance' as const,
            isSequential: loopChars.isSequential === true,
            completionCondition: loopChars.completionCondition?.body ?? undefined,
            inputDataItem: loopChars.inputDataItem?.name ?? undefined,
            outputDataItem: loopChars.outputDataItem?.name ?? undefined,
            elementVariable: getEvilBodyValue(loopChars, 'evil:ElementVariable'),
            outputElementVariable: getEvilBodyValue(loopChars, 'evil:OutputElementVariable'),
            inputCollection: getEvilBodyValue(loopChars, 'evil:InputCollection'),
            outputCollection: getEvilBodyValue(loopChars, 'evil:OutputCollection'),
            loopBreakCondition: getEvilBodyValue(loopChars, 'evil:LoopBreakCondition'),
            loopInterval: getEvilBodyValue(loopChars, 'evil:LoopInterval'),
            maxIterations: getEvilBodyValue(loopChars, 'evil:MaxIterations'),
          };
        }

        return undefined;
      },
      userTaskResources: (element: any) => {
        const resources = element.businessObject?.resources ?? [];
        const humanPerformer = resources.find((res: any) => res.$type === 'bpmn:HumanPerformer');
        const potentialOwner = resources.find((res: any) => res.$type === 'bpmn:PotentialOwner');
        return {
          assignee: humanPerformer?.resourceAssignmentExpression?.expression?.body ?? undefined,
          candidateUsers: potentialOwner?.resourceAssignmentExpression?.expression?.body ?? undefined,
        };
      },
      incomingFlows: (element: any) => {
        return element.incoming.map((flowObject) => {
          const sourceRef = flowObject.businessObject?.sourceRef;

          // NOTE: Associations do not have a "sourceRef" object. In fact, they have no refs at all.
          const type = flowObject.type || flowObject.$type;
          if (
            type === 'bpmn:Association' ||
            type === 'bpmn:DataInputAssociation' ||
            type === 'bpmn:DataOutputAssociation'
          ) {
            return {
              id: flowObject.id,
              type: this.getBpmnElementTypeWithFallback(flowObject),
            };
          }

          return {
            id: flowObject.id,
            type: this.getBpmnElementTypeWithFallback(flowObject),
            source: { id: sourceRef?.id, type: this.getBpmnElementTypeWithFallback(sourceRef) },
          };
        });
      },
      outgoingFlows: (element: any) => {
        return element.outgoing.map((flowObject) => {
          const targetRef = flowObject.businessObject?.targetRef;

          return {
            id: flowObject.id,
            type: this.getBpmnElementTypeWithFallback(flowObject),
            target: { id: targetRef?.id, type: this.getBpmnElementTypeWithFallback(targetRef) },
          };
        });
      },
      attachedElements: (element: any) => {
        const attached = element.attachers ?? [];

        return attached.map((flowObject) => {
          return { id: flowObject.id, type: this.getBpmnElementTypeWithFallback(flowObject) };
        });
      },
      message: (element: any, propertyName: string) => {
        const elementIsMessageEventDefinition =
          element.businessObject.eventDefinitions &&
          element.businessObject.eventDefinitions.length !== 0 &&
          element.businessObject.eventDefinitions.some(
            (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
          );

        let selectedMessage;

        if (elementIsMessageEventDefinition) {
          selectedMessage = element.businessObject.eventDefinitions.find(
            (definition) => definition.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
          )?.messageRef;
        } else {
          selectedMessage = element.businessObject.get(MODDLE_BPMN_MESSAGE_SELECTOR);
        }

        return selectedMessage?.name;
      },
      signal: (element: any, propertyName: string) => {
        const elementIsSignalEventDefinition =
          element.businessObject.eventDefinitions &&
          element.businessObject.eventDefinitions.length !== 0 &&
          element.businessObject.eventDefinitions.some(
            (definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE,
          );

        if (elementIsSignalEventDefinition == null) {
          return undefined;
        }

        const signal = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE,
        );

        return signal?.signalRef?.name;
      },
      error: (element: any, propertyName: string) => {
        const elementIsErrorEventDefinition =
          element.businessObject.eventDefinitions &&
          element.businessObject.eventDefinitions.length !== 0 &&
          element.businessObject.eventDefinitions.some(
            (definition) => definition.$type === MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE,
          );

        if (elementIsErrorEventDefinition == null) {
          return undefined;
        }

        const errorEventDefinition = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE,
        );

        return {
          errorName: errorEventDefinition?.errorRef?.name,
          errorCode: getEvilBodyValue(errorEventDefinition, 'evil:ErrorCode'),
          errorMessage: getEvilBodyValue(errorEventDefinition, 'evil:ErrorMessage'),
        };
      },
      timer: (element: any, propertyName: string) => {
        const elementIsTimerEventDefinition =
          element.businessObject.eventDefinitions &&
          element.businessObject.eventDefinitions.length !== 0 &&
          element.businessObject.eventDefinitions.some(
            (definition) => definition.$type === MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE,
          );

        if (elementIsTimerEventDefinition == null) {
          return undefined;
        }

        const timer = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE,
        );

        const timeCycle = timer.get(BpmnTimerType.Cycle);
        const timeDate = timer.get(BpmnTimerType.Date);
        const timeDuration = timer.get(BpmnTimerType.Duration);

        if (timeCycle != null) {
          return {
            timerType: BpmnTimerType.Cycle,
            timerDefinition: timeCycle.body,
          };
        } else if (timeDate != null) {
          return {
            timerType: BpmnTimerType.Date,
            timerDefinition: timeDate.body,
          };
        } else if (timeDuration != null) {
          return {
            timerType: BpmnTimerType.Duration,
            timerDefinition: timeDuration.body,
          };
        }
      },
      condition: (element: any, propertyName: string) => {
        const elementIsConditionalFlow = isSequenceFlowConditional(element);

        if (!elementIsConditionalFlow) {
          return undefined;
        }

        const conditionExpression = element.businessObject.get(MODDLE_BPMN_CONDITION_EXPRESSION_SELECTOR);

        return conditionExpression?.body;
      },
      link: (element: any, propertyName: string) => {
        const elementIsLinkEventDefinition =
          element.businessObject.eventDefinitions &&
          element.businessObject.eventDefinitions.length !== 0 &&
          element.businessObject.eventDefinitions.some(
            (definition) => definition.$type === MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE,
          );

        if (!elementIsLinkEventDefinition) {
          return undefined;
        }

        const link = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE,
        );

        return link?.name;
      },
      script: (element: any, propertyName: string) => {
        return {
          script: element.businessObject.get(MODDLE_BPMN_SCRIPT_SELECTOR),
          scriptRef: getEvilBodyValue(element.businessObject, 'evil:ScriptRef'),
        };
      },
      callActivity: (element: any, propertyName: string) => {
        const calledElement = element.businessObject.get(MODDLE_BPMN_CALLED_ELEMENT_SELECTOR);
        const startEventId = getEvilBodyValue(element.businessObject, 'evil:StartEventId');

        return {
          processModelId: calledElement,
          startEventId: startEventId,
        };
      },
      subProcess: (element: any, propertyName: string) => {
        return {
          childrenIds: element.children?.map((e) => e.id) ?? [],
        };
      },
      adHocSubprocess: (element: any, propertyName: string) => {
        const businessObject = element.businessObject;

        return {
          childrenIds: element.children?.map((e) => e.id) ?? [],
          ordering: businessObject.ordering ?? undefined,
          cancelRemainingInstances:
            businessObject.cancelRemainingInstances != null
              ? businessObject.cancelRemainingInstances === true
              : undefined,
          completionCondition: businessObject.completionCondition?.body ?? undefined,
          implementation: businessObject.implementation ?? undefined,
          activeElementsExpression: getEvilBodyValue(businessObject, 'evil:ActiveElements'),
        };
      },
      /**
       * This function is only executed if Process is the root element in the BPMN.
       * That means as long as there is no collaboration / participant / pool in the diagram.
       * If these elements do exist, the castProcessToBpmnElement method is used for casting.
       */
      process: (element: any, propertyName: string) => {
        const isExecutable = element.businessObject.get(MODDLE_BPMN_IS_EXECUTABLE_SELECTOR) === true;
        const version = getEvilBodyValue(element.businessObject, 'evil:Version');
        const correlationKey = getEvilBodyValue(element.businessObject, 'evil:CorrelationKey');

        return {
          isExecutable: isExecutable,
          version: version,
          correlationKey: correlationKey,
          childrenIds: element.children?.map((e) => e.id) ?? [],
        };
      },
      participant: (element: any, propertyName: string) => {
        const process = element.businessObject.get(MODDLE_BPMN_PROCESS_SELECTOR);
        if (process == null) {
          return null;
        }

        return this.castProcessToBpmnElement(process);
      },
      conditionalEvent: (element: any, propertyName: string) => {
        const elementIsConditionalEventDefinition = element.businessObject.eventDefinitions?.some(
          (definition) => definition.$type === MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE,
        );

        if (!elementIsConditionalEventDefinition) {
          return undefined;
        }

        const conditionEventDefinition = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE,
        );

        return {
          condition: conditionEventDefinition.get(MODDLE_BPMN_CONDITION_SELECTOR)?.body,
        };
      },
      escalationEvent: (element: any, propertyName: string) => {
        const elementIsEscalationEventDefinition = element.businessObject.eventDefinitions?.some(
          (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
        );

        if (!elementIsEscalationEventDefinition) {
          return undefined;
        }

        const escalationEventDefinition = element.businessObject.eventDefinitions.find(
          (definition) => definition.$type === MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE,
        );

        const escalationRef = escalationEventDefinition.get(MODDLE_BPMN_ESCALATION_REF_SELECTOR);

        return {
          name: escalationRef?.name,
          escalationCode: escalationRef?.escalationCode,
        };
      },
      compensationActivityRef: (element: any) => {
        const compensateDefinition = element.businessObject?.eventDefinitions?.find(
          (definition) => definition.$type === MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE,
        );
        return compensateDefinition?.activityRef?.id ?? null;
      },
      textAnnotation: (element: any, propertyName: string) => {
        return element.businessObject.get(MODDLE_BPMN_TEXT_SELECTOR);
      },
      httpServiceTask: (element: any, propertyName: string) => {
        const businessObject = element.businessObject;
        return {
          implementation: businessObject.get('implementation'),
          method: getEvilBodyValue(businessObject, 'evil:HttpMethod'),
          url: getEvilBodyValue(businessObject, 'evil:HttpUrl'),
          body: getEvilBodyValue(businessObject, 'evil:HttpBody'),
          authHeader: getEvilBodyValue(businessObject, 'evil:HttpAuthHeader'),
          responseHeaders: getEvilBodyValue(businessObject, 'evil:HttpResponseHeaders'),
        };
      },
      categoryValue: (element: any, propertyName: string) => {
        const categoryValue = element.businessObject?.get(MODDLE_BPMN_CATEGORY_REF_SELECTOR)?.value;

        return categoryValue;
      },
      formFieldDefinitions: (element: any, propertyName: string) => {
        const formFieldsJson = getEvilBodyValue(element.businessObject, 'evil:FormFields');
        if (formFieldsJson == null || formFieldsJson.trim() === '') {
          return [];
        }
        try {
          const parsed = JSON.parse(formFieldsJson);
          if (!Array.isArray(parsed)) {
            return [];
          }
          return parsed as FormFieldDefinition[];
        } catch {
          return [];
        }
      },
      formActions: (element: any, propertyName: string) => {
        const formActionsJson = getEvilBodyValue(element.businessObject, 'evil:FormActions');
        if (formActionsJson == null || formActionsJson.trim() === '') {
          return [];
        }
        try {
          return JSON.parse(formActionsJson) as FormAction[];
        } catch {
          return [];
        }
      },
      businessRuleTask: (element: any, propertyName: string) => {
        const businessObject = element.businessObject;
        return {
          implementation: businessObject.get('implementation'),
          script: businessObject.get(MODDLE_BPMN_SCRIPT_SELECTOR),
          decisionRef: getEvilBodyValue(businessObject, 'evil:DecisionRef'),
          decisionElementId: getEvilBodyValue(businessObject, 'evil:DecisionElementId'),
          resultVariable: getEvilBodyValue(businessObject, 'evil:ResultVariable'),
          traceUnmatchedRules: getEvilBodyValue(businessObject, 'evil:TraceUnmatchedRules') === 'true',
        };
      },
      dataPipeline: (element: any) => {
        const businessObject = element.businessObject;
        const inputMappings = findAllEvilExtensions(businessObject, 'evil:InputMapping').map((mapping: any) => ({
          source: mapping.source ?? '',
          target: mapping.target ?? '',
        }));
        const outputMappings = findAllEvilExtensions(businessObject, 'evil:OutputMapping').map((mapping: any) => ({
          source: mapping.source ?? '',
          target: mapping.target ?? '',
        }));
        return {
          inputMappings,
          outputMappings,
          payloadContract: getEvilBodyValue(businessObject, 'evil:PayloadContract'),
          resultContract: getEvilBodyValue(businessObject, 'evil:ResultContract'),
        };
      },
      correlationRetrievalExpression: (element: any) => {
        const businessObject = element.businessObject;
        const eventDef = businessObject.eventDefinitions?.find(
          (def: any) => def.$type === MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE,
        );
        if (eventDef) {
          return getEvilBodyValue(eventDef, 'evil:CorrelationRetrievalExpression');
        }
        return getEvilBodyValue(businessObject, 'evil:CorrelationRetrievalExpression');
      },
      manualTask: (element: any) => {
        const rawValue = getEvilBodyValue(element.businessObject, 'evil:RequireConfirmation');
        return {
          requireConfirmation: rawValue === 'true',
        };
      },
      transformation: (element: any) => {
        return element.businessObject.transformation?.body;
      },
      activationCondition: (element: any) => {
        return element.businessObject.activationCondition?.body;
      },
      dataObjectExtensions: (element: any) => {
        return {
          valueContract: getEvilBodyValue(element.businessObject, 'evil:ValueContract'),
        };
      },
      userTaskExtensions: (element: any) => {
        return {
          assignees: getEvilBodyValue(element.businessObject, 'evil:Assignees'),
          dueDate: getEvilBodyValue(element.businessObject, 'evil:DueDate'),
          priority: (() => {
            const raw = getEvilBodyValue(element.businessObject, 'evil:Priority');
            return raw != null ? parseInt(raw, 10) : undefined;
          })(),
        };
      },
    };

    const nameKey = propertyName.substring(0, 1).toLowerCase() + propertyName.substring(1);
    const getHandler: any = getHandlers[nameKey] || getHandlers['*'];

    return getHandler(selectedElement, propertyName);
  }

  /**
   * Casts a given `element` from BpmnJS's modeler into Bifrost's typed format.
   */
  castElement(element: any): BpmnElement {
    assertNotNull(element, 'element');
    const elementId = element.id;

    const genericProperties = {
      __internalModdleId: elementId,
      id: elementId,
      name: this.getElementPropertyValue(elementId, 'name'),
      documentation: this.getElementPropertyValue(elementId, 'documentation'),
      customProperties: this.getCustomProperties(elementId),
      loopCharacteristics: this.getElementPropertyValue(elementId, 'loopCharacteristics'),
      loopConfig: this.getElementPropertyValue(elementId, 'loopConfig'),
      incomingFlows: this.getElementPropertyValue(elementId, 'incomingFlows'),
      outgoingFlows: this.getElementPropertyValue(elementId, 'outgoingFlows'),
      attachedElements: this.getElementPropertyValue(elementId, 'attachedElements'),
    };

    const bpmnElementType = this.getBpmnElementType(element);

    switch (bpmnElementType) {
      case BpmnElementType.BoundaryEvent:
        return {
          type: BpmnElementType.BoundaryEvent,
          ...genericProperties,
        };

      case BpmnElementType.MessageBoundaryEvent: {
        const messageBoundaryPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.MessageBoundaryEvent,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          outputMappings: messageBoundaryPipeline?.outputMappings ?? [],
          resultContract: messageBoundaryPipeline?.resultContract,
          correlationRetrievalExpression: this.getElementPropertyValue(elementId, 'correlationRetrievalExpression'),
        };
      }

      case BpmnElementType.SignalBoundaryEvent: {
        const signalBoundaryPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SignalBoundaryEvent,
          ...genericProperties,
          signal: this.getElementPropertyValue(elementId, 'signal'),
          outputMappings: signalBoundaryPipeline?.outputMappings ?? [],
        };
      }

      case BpmnElementType.ErrorBoundaryEvent:
        return {
          type: BpmnElementType.ErrorBoundaryEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'error'),
        };

      case BpmnElementType.ErrorStartEvent:
        return {
          type: BpmnElementType.ErrorStartEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'error'),
        };

      case BpmnElementType.TimerBoundaryEvent:
        return {
          type: BpmnElementType.TimerBoundaryEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'timer'),
        };

      case BpmnElementType.ConditionalBoundaryEvent:
        return {
          type: BpmnElementType.ConditionalBoundaryEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'conditionalEvent'),
        };

      case BpmnElementType.EscalationBoundaryEvent:
        return {
          type: BpmnElementType.EscalationBoundaryEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'escalationEvent'),
        };

      case BpmnElementType.EscalationStartEvent:
        return {
          type: BpmnElementType.EscalationStartEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'escalationEvent'),
        };

      case BpmnElementType.EndEvent:
        return {
          type: BpmnElementType.EndEvent,
          ...genericProperties,
        };

      case BpmnElementType.ExclusiveGateway:
        return {
          type: BpmnElementType.ExclusiveGateway,
          ...genericProperties,
        };

      case BpmnElementType.ParallelGateway:
        return {
          type: BpmnElementType.ParallelGateway,
          ...genericProperties,
        };

      case BpmnElementType.ComplexGateway:
        return {
          type: BpmnElementType.ComplexGateway,
          ...genericProperties,
        };

      case BpmnElementType.InclusiveGateway:
        return {
          type: BpmnElementType.InclusiveGateway,
          ...genericProperties,
        };

      case BpmnElementType.EventBasedGateway:
        return {
          type: BpmnElementType.EventBasedGateway,
          ...genericProperties,
        };

      case BpmnElementType.MessageEndEvent: {
        const messageEndPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.MessageEndEvent,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          inputMappings: messageEndPipeline?.inputMappings ?? [],
          payloadContract: messageEndPipeline?.payloadContract,
        };
      }

      case BpmnElementType.SignalEndEvent: {
        const signalEndPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SignalEndEvent,
          ...genericProperties,
          signal: this.getElementPropertyValue(elementId, 'signal'),
          inputMappings: signalEndPipeline?.inputMappings ?? [],
        };
      }

      case BpmnElementType.ErrorEndEvent:
        return {
          type: BpmnElementType.ErrorEndEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'error'),
        };

      case BpmnElementType.EscalationEndEvent:
        return {
          type: BpmnElementType.EscalationEndEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'escalationEvent'),
        };

      case BpmnElementType.TimerStartEvent: {
        const enabledProperty = genericProperties.customProperties?.find((property) => property.name === 'enabled');
        return {
          type: BpmnElementType.TimerStartEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'timer'),
          enabled: enabledProperty?.value === 'true',
        };
      }

      case BpmnElementType.IntermediateEvent:
        return {
          type: BpmnElementType.IntermediateEvent,
          ...genericProperties,
        };

      case BpmnElementType.MessageIntermediateThrowEvent: {
        const messageThrowPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.MessageIntermediateThrowEvent,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          inputMappings: messageThrowPipeline?.inputMappings ?? [],
          payloadContract: messageThrowPipeline?.payloadContract,
        };
      }

      case BpmnElementType.SignalIntermediateThrowEvent: {
        const signalThrowPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SignalIntermediateThrowEvent,
          ...genericProperties,
          signal: this.getElementPropertyValue(elementId, 'signal'),
          inputMappings: signalThrowPipeline?.inputMappings ?? [],
        };
      }

      case BpmnElementType.LinkIntermediateThrowEvent:
        return {
          type: BpmnElementType.LinkIntermediateThrowEvent,
          ...genericProperties,
          link: this.getElementPropertyValue(elementId, 'link'),
        };

      case BpmnElementType.EscalationIntermediateThrowEvent:
        return {
          type: BpmnElementType.EscalationIntermediateThrowEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'escalationEvent'),
        };

      case BpmnElementType.MessageIntermediateCatchEvent: {
        const messageCatchPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.MessageIntermediateCatchEvent,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          outputMappings: messageCatchPipeline?.outputMappings ?? [],
          resultContract: messageCatchPipeline?.resultContract,
          correlationRetrievalExpression: this.getElementPropertyValue(elementId, 'correlationRetrievalExpression'),
        };
      }

      case BpmnElementType.SignalIntermediateCatchEvent: {
        const signalCatchPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SignalIntermediateCatchEvent,
          ...genericProperties,
          signal: this.getElementPropertyValue(elementId, 'signal'),
          outputMappings: signalCatchPipeline?.outputMappings ?? [],
        };
      }

      case BpmnElementType.LinkIntermediateCatchEvent:
        return {
          type: BpmnElementType.LinkIntermediateCatchEvent,
          ...genericProperties,
          link: this.getElementPropertyValue(elementId, 'link'),
        };

      case BpmnElementType.ConditionalIntermediateCatchEvent:
        return {
          type: BpmnElementType.ConditionalIntermediateCatchEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'conditionalEvent'),
        };

      case BpmnElementType.TimerIntermediateEvent:
        return {
          type: BpmnElementType.TimerIntermediateEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'timer'),
        };

      case BpmnElementType.ReceiveTask: {
        const receiveTaskPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.ReceiveTask,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          outputMappings: receiveTaskPipeline?.outputMappings ?? [],
          resultContract: receiveTaskPipeline?.resultContract,
          correlationRetrievalExpression: this.getElementPropertyValue(elementId, 'correlationRetrievalExpression'),
        };
      }

      case BpmnElementType.SendTask: {
        const sendTaskPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SendTask,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          inputMappings: sendTaskPipeline?.inputMappings ?? [],
          payloadContract: sendTaskPipeline?.payloadContract,
        };
      }

      case BpmnElementType.UntypedTask:
        return {
          type: BpmnElementType.UntypedTask,
          ...genericProperties,
        };

      case BpmnElementType.UserTask: {
        const userTaskPipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.UserTask,
          ...genericProperties,
          formFieldDefinitions: this.getElementPropertyValue(elementId, 'formFieldDefinitions'),
          formActions: this.getElementPropertyValue(elementId, 'formActions'),
          ...this.getElementPropertyValue(elementId, 'userTaskResources'),
          ...this.getElementPropertyValue(elementId, 'userTaskExtensions'),
          inputMappings: userTaskPipelineData?.inputMappings ?? [],
          outputMappings: userTaskPipelineData?.outputMappings ?? [],
          payloadContract: userTaskPipelineData?.payloadContract,
          resultContract: userTaskPipelineData?.resultContract,
        };
      }

      case BpmnElementType.ManualTask:
        return {
          type: BpmnElementType.ManualTask,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'manualTask'),
        };

      case BpmnElementType.MessageStartEvent: {
        const messageStartPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.MessageStartEvent,
          ...genericProperties,
          message: this.getElementPropertyValue(elementId, 'message'),
          outputMappings: messageStartPipeline?.outputMappings ?? [],
          resultContract: messageStartPipeline?.resultContract,
        };
      }

      case BpmnElementType.SignalStartEvent: {
        const signalStartPipeline = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.SignalStartEvent,
          ...genericProperties,
          signal: this.getElementPropertyValue(elementId, 'signal'),
          outputMappings: signalStartPipeline?.outputMappings ?? [],
        };
      }

      case BpmnElementType.ConditionalStartEvent:
        return {
          type: BpmnElementType.ConditionalStartEvent,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'conditionalEvent'),
        };

      case BpmnElementType.StartEvent:
        return {
          type: BpmnElementType.StartEvent,
          ...genericProperties,
        };

      case BpmnElementType.ConditionalFlow:
        return {
          type: BpmnElementType.ConditionalFlow,
          ...genericProperties,
          condition: this.getElementPropertyValue(elementId, 'condition'),
        };

      case BpmnElementType.DefaultFlow:
        return {
          type: BpmnElementType.DefaultFlow,
          ...genericProperties,
        };

      case BpmnElementType.SequenceFlow:
        return {
          type: BpmnElementType.SequenceFlow,
          ...genericProperties,
        };

      case BpmnElementType.ScriptTask: {
        const scriptData = this.getElementPropertyValue(elementId, MODDLE_BPMN_SCRIPT_SELECTOR);
        const scriptPipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.ScriptTask,
          ...genericProperties,
          script: scriptData?.script,
          scriptRef: scriptData?.scriptRef,
          scriptFormat: this.getElementPropertyValue(elementId, 'scriptFormat'),
          inputMappings: scriptPipelineData?.inputMappings ?? [],
          outputMappings: scriptPipelineData?.outputMappings ?? [],
          payloadContract: scriptPipelineData?.payloadContract,
          resultContract: scriptPipelineData?.resultContract,
        } as BpmnElement;
      }

      case BpmnElementType.CallActivity: {
        const callActivityData = this.getElementPropertyValue(elementId, 'callActivity');
        const pipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.CallActivity,
          ...genericProperties,
          ...callActivityData,
          inputMappings: pipelineData?.inputMappings ?? [],
          outputMappings: pipelineData?.outputMappings ?? [],
          payloadContract: pipelineData?.payloadContract,
          resultContract: pipelineData?.resultContract,
        };
      }

      case BpmnElementType.Process:
        return {
          type: BpmnElementType.Process,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'process'),
        };

      case BpmnElementType.Participant:
        return {
          type: BpmnElementType.Participant,
          ...genericProperties,
          process: this.getElementPropertyValue(elementId, 'participant'),
          collapsed: element.businessObject.processRef == null,
        };

      case BpmnElementType.TextAnnotation:
        return {
          type: BpmnElementType.TextAnnotation,
          ...genericProperties,
          text: this.getElementPropertyValue(elementId, 'textAnnotation'),
        };

      case BpmnElementType.DataObject:
        return {
          type: BpmnElementType.DataObject,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'dataObjectExtensions'),
        };

      case BpmnElementType.Association:
        return {
          type: BpmnElementType.Association,
          ...genericProperties,
        };

      case BpmnElementType.DataInputAssociation:
        return {
          type: BpmnElementType.DataInputAssociation,
          ...genericProperties,
        };

      case BpmnElementType.DataOutputAssociation:
        return {
          type: BpmnElementType.DataOutputAssociation,
          ...genericProperties,
          transformation: this.getElementPropertyValue(elementId, 'transformation'),
        };

      case BpmnElementType.ServiceTask: {
        const servicePipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.ServiceTask,
          ...genericProperties,
          implementation: element.businessObject.get('implementation') ?? undefined,
          inputMappings: servicePipelineData?.inputMappings ?? [],
          outputMappings: servicePipelineData?.outputMappings ?? [],
          payloadContract: servicePipelineData?.payloadContract,
          resultContract: servicePipelineData?.resultContract,
        };
      }

      case BpmnElementType.HttpServiceTask: {
        const httpPipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.HttpServiceTask,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'httpServiceTask'),
          inputMappings: httpPipelineData?.inputMappings ?? [],
          outputMappings: httpPipelineData?.outputMappings ?? [],
          payloadContract: httpPipelineData?.payloadContract,
          resultContract: httpPipelineData?.resultContract,
        };
      }

      case BpmnElementType.Transaction:
        return {
          type: BpmnElementType.Transaction,
          ...genericProperties,
        };

      case BpmnElementType.AdHocSubprocess: {
        const adHocPipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.AdHocSubprocess,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'adHocSubprocess'),
          inputMappings: adHocPipelineData?.inputMappings ?? [],
          outputMappings: adHocPipelineData?.outputMappings ?? [],
          payloadContract: adHocPipelineData?.payloadContract,
          resultContract: adHocPipelineData?.resultContract,
        };
      }

      case BpmnElementType.BusinessRuleTask: {
        const brtPipelineData = this.getElementPropertyValue(elementId, 'dataPipeline');
        return {
          type: BpmnElementType.BusinessRuleTask,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'businessRuleTask'),
          inputMappings: brtPipelineData?.inputMappings ?? [],
          outputMappings: brtPipelineData?.outputMappings ?? [],
          payloadContract: brtPipelineData?.payloadContract,
          resultContract: brtPipelineData?.resultContract,
        };
      }

      case BpmnElementType.Subprocess:
        return {
          type: BpmnElementType.Subprocess,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'subProcess'),
        };

      case BpmnElementType.EventSubprocess:
        return {
          type: BpmnElementType.EventSubprocess,
          ...genericProperties,
          ...this.getElementPropertyValue(elementId, 'subProcess'),
        };

      case BpmnElementType.DataStore:
        return {
          type: BpmnElementType.DataStore,
          ...genericProperties,
        };

      case BpmnElementType.Group:
        return {
          type: BpmnElementType.Group,
          ...genericProperties,
          categoryValue: this.getElementPropertyValue(elementId, 'categoryValue'),
        };

      case BpmnElementType.Definition:
        return {
          type: BpmnElementType.Definition,
          ...genericProperties,
        };

      case BpmnElementType.MessageFlow:
        return {
          type: BpmnElementType.MessageFlow,
          ...genericProperties,
        };

      case BpmnElementType.CompensationEndEvent:
        return {
          type: BpmnElementType.CompensationEndEvent,
          ...genericProperties,
          compensationActivityRef: this.getCompensationActivityRef(element),
        };

      case BpmnElementType.CancelEndEvent:
        return {
          type: BpmnElementType.CancelEndEvent,
          ...genericProperties,
        };

      case BpmnElementType.CancelBoundaryEvent:
        return {
          type: BpmnElementType.CancelBoundaryEvent,
          ...genericProperties,
        };

      case BpmnElementType.TerminateEndEvent:
        return {
          type: BpmnElementType.TerminateEndEvent,
          ...genericProperties,
        };

      case BpmnElementType.CompensationBoundaryEvent:
        return {
          type: BpmnElementType.CompensationBoundaryEvent,
          ...genericProperties,
        };

      case BpmnElementType.CompensationStartEvent:
        return {
          type: BpmnElementType.CompensationStartEvent,
          ...genericProperties,
        };

      case BpmnElementType.CompensationIntermediateThrowEvent:
        return {
          type: BpmnElementType.CompensationIntermediateThrowEvent,
          ...genericProperties,
          compensationActivityRef: this.getCompensationActivityRef(element),
        };

      default:
        return {
          type: this.getBpmnElementTypeFallback(element),
          ...genericProperties,
        };
    }
  }

  private castDefinitionToBpmnElement(businessObject: any): BpmnElement_Definition {
    const genericProperties = {
      __internalModdleId: businessObject.id,
      id: businessObject.id,
      name: businessObject.name,
      exporter: businessObject.exporter,
      exporterVersion: businessObject.exporterVersion,
      documentation: '',
      customProperties: null,
      incomingFlows: [],
      outgoingFlows: [],
      attachedElements: [],
    };

    return {
      type: BpmnElementType.Definition,
      ...genericProperties,
    };
  }

  private castProcessToBpmnElement(businessObject: any): BpmnElement_Process {
    const genericProperties = {
      __internalModdleId: businessObject.id,
      id: businessObject.id,
      name: businessObject.name,
      documentation: '',
      customProperties: null,
      incomingFlows: [],
      outgoingFlows: [],
      attachedElements: [],
      childrenIds: businessObject.flowElements?.map((element) => element.id) ?? [],
    };

    const isExecutable = businessObject.get(MODDLE_BPMN_IS_EXECUTABLE_SELECTOR) === true;
    const version = getEvilBodyValue(businessObject, 'evil:Version');
    const correlationKey = getEvilBodyValue(businessObject, 'evil:CorrelationKey');

    return {
      type: BpmnElementType.Process,
      ...genericProperties,
      isExecutable: isExecutable,
      version: version,
      correlationKey: correlationKey,
    };
  }

  private getBpmnElementTypeWithFallback(element: any): BpmnElementType | string {
    return this.getBpmnElementType(element) || this.getBpmnElementTypeFallback(element);
  }

  private getBpmnElementTypeFallback(element: any): string {
    return `uncasted<${element.type || element.$type}>`;
  }

  private getBpmnElementType(element: any): BpmnElementType | null {
    let eventDefinitionType: string;
    const elementId = element.id;
    const type = element.type || element.$type;
    assertNotNull(type, 'type');

    switch (type) {
      case MODDLE_BPMN_BOUNDARY_EVENT_TYPE:
        eventDefinitionType = this.getEventDefinitionType(elementId);

        switch (eventDefinitionType) {
          case MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.MessageBoundaryEvent;

          case MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.SignalBoundaryEvent;

          case MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ErrorBoundaryEvent;

          case MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE:
            return BpmnElementType.TimerBoundaryEvent;

          case MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ConditionalBoundaryEvent;

          case MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.EscalationBoundaryEvent;

          case MODDLE_BPMN_CANCEL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CancelBoundaryEvent;

          case MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CompensationBoundaryEvent;

          default:
            return BpmnElementType.BoundaryEvent;
        }

      case MODDLE_BPMN_END_EVENT_TYPE:
        eventDefinitionType = this.getEventDefinitionType(elementId);

        switch (eventDefinitionType) {
          case MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.MessageEndEvent;

          case MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.SignalEndEvent;

          case MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ErrorEndEvent;

          case MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.EscalationEndEvent;

          case MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CompensationEndEvent;

          case MODDLE_BPMN_CANCEL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CancelEndEvent;

          case MODDLE_BPMN_TERMINATE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.TerminateEndEvent;

          default:
            return BpmnElementType.EndEvent;
        }

      case MODDLE_BPMN_INTERMEDIATE_CATCH_EVENT_TYPE:
        eventDefinitionType = this.getEventDefinitionType(elementId);

        switch (eventDefinitionType) {
          case MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.MessageIntermediateCatchEvent;

          case MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.SignalIntermediateCatchEvent;

          case MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE:
            return BpmnElementType.TimerIntermediateEvent;

          case MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE:
            return BpmnElementType.LinkIntermediateCatchEvent;

          case MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ConditionalIntermediateCatchEvent;

          default:
            // NOTE: this seems weird on the surface, but `bpmn-js` models the default
            //        non-configurable IntermediateEvent as IntermediateThrowEvent,
            //        therefore there is no "blank" intermediate catch event
            return null;
        }

      case MODDLE_BPMN_INTERMEDIATE_THROW_EVENT_TYPE:
        eventDefinitionType = this.getEventDefinitionType(elementId);

        switch (eventDefinitionType) {
          case MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.MessageIntermediateThrowEvent;

          case MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.SignalIntermediateThrowEvent;

          case MODDLE_BPMN_LINK_EVENT_DEFINITION_TYPE:
            return BpmnElementType.LinkIntermediateThrowEvent;

          case MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.EscalationIntermediateThrowEvent;

          case MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CompensationIntermediateThrowEvent;

          default:
            // NOTE: this seems wrong on the surface, but `bpmn-js` models the default
            //        non-configurable IntermediateEvent as IntermediateThrowEvent
            return BpmnElementType.IntermediateEvent;
        }

      case MODDLE_BPMN_EXCLUSIVE_GATEWAY:
        return BpmnElementType.ExclusiveGateway;

      case MODDLE_BPMN_PARALLEL_GATEWAY:
        return BpmnElementType.ParallelGateway;

      case MODDLE_BPMN_COMPLEX_GATEWAY:
        return BpmnElementType.ComplexGateway;

      case MODDLE_BPMN_INCLUSIVE_GATEWAY:
        return BpmnElementType.InclusiveGateway;

      case MODDLE_BPMN_EVENT_BASED_GATEWAY:
        return BpmnElementType.EventBasedGateway;

      case MODDLE_BPMN_MANUAL_TASK_TYPE:
        return BpmnElementType.ManualTask;

      case MODDLE_BPMN_USER_TASK_TYPE:
        return BpmnElementType.UserTask;

      case MODDLE_BPMN_RECEIVE_TASK_TYPE:
        return BpmnElementType.ReceiveTask;

      case MODDLE_BPMN_SEND_TASK_TYPE:
        return BpmnElementType.SendTask;

      case MODDLE_BPMN_UNTYPED_TASK_TYPE:
        return BpmnElementType.UntypedTask;

      case MODDLE_BPMN_SCRIPT_TASK_TYPE:
        return BpmnElementType.ScriptTask;

      case MODDLE_BPMN_START_EVENT_TYPE:
        eventDefinitionType = this.getEventDefinitionType(elementId);

        switch (eventDefinitionType) {
          case MODDLE_BPMN_MESSAGE_EVENT_DEFINITION_TYPE:
            return BpmnElementType.MessageStartEvent;

          case MODDLE_BPMN_SIGNAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.SignalStartEvent;

          case MODDLE_BPMN_TIMER_EVENT_DEFINITION_TYPE:
            return BpmnElementType.TimerStartEvent;

          case MODDLE_BPMN_CONDITIONAL_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ConditionalStartEvent;

          case MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.CompensationStartEvent;

          case MODDLE_BPMN_ESCALATION_EVENT_DEFINITION_TYPE:
            return BpmnElementType.EscalationStartEvent;

          case MODDLE_BPMN_ERROR_EVENT_DEFINITION_TYPE:
            return BpmnElementType.ErrorStartEvent;

          default:
            return BpmnElementType.StartEvent;
        }

      case MODDLE_BPMN_SEQUENCE_FLOW_TYPE: {
        const isDefaultFlow = isSequenceFlowDefault(element);
        if (isDefaultFlow) {
          return BpmnElementType.DefaultFlow;
        }

        const isConditional = isSequenceFlowConditional(element);
        if (isConditional) {
          return BpmnElementType.ConditionalFlow;
        }

        return BpmnElementType.SequenceFlow;
      }

      case MODDLE_BPMN_MESSAGE_FLOW_TYPE:
        return BpmnElementType.MessageFlow;

      case MODDLE_BPMN_CALL_ACTIVITY_TYPE:
        return BpmnElementType.CallActivity;

      case MODDLE_BPMN_PROCESS_TYPE:
        return BpmnElementType.Process;

      case MODDLE_BPMN_PARTICIPANT_TYPE:
        return BpmnElementType.Participant;

      case MODDLE_BPMN_TEXT_ANNOTATION_TYPE:
        return BpmnElementType.TextAnnotation;

      case MODDLE_BPMN_DATA_OBJECT_TYPE:
        return BpmnElementType.DataObject;

      case MODDLE_BPMN_ASSOCIATION_TYPE:
        return BpmnElementType.Association;

      case MODDLE_BPMN_DATA_INPUT_ASSOCIATION_TYPE:
        return BpmnElementType.DataInputAssociation;

      case MODDLE_BPMN_DATA_OUTPUT_ASSOCIATION_TYPE:
        return BpmnElementType.DataOutputAssociation;

      case MODDLE_BPMN_SERVICE_TASK_TYPE: {
        const isHttpTask = isHttpServiceTask(element);

        if (isHttpTask) {
          return BpmnElementType.HttpServiceTask;
        }

        return BpmnElementType.ServiceTask;
      }

      case MODDLE_BPMN_TRANSACTION_TYPE:
        return BpmnElementType.Transaction;

      case MODDLE_BPMN_ADHOC_SUBPROCESS_TYPE:
        return BpmnElementType.AdHocSubprocess;

      case MODDLE_BPMN_BUSINESS_RULE_TASK_TYPE:
        return BpmnElementType.BusinessRuleTask;

      case MODDLE_BPMN_SUBPROCESS: {
        const subprocessIsEventSubprocess = isEventSubprocess(element);
        if (subprocessIsEventSubprocess) {
          return BpmnElementType.EventSubprocess;
        }

        return BpmnElementType.Subprocess;
      }

      case MODDLE_BPMN_DATA_STORE_TYPE:
        return BpmnElementType.DataStore;

      case MODDLE_BPMN_GROUP_TYPE:
        return BpmnElementType.Group;

      case MODDLE_DEFINITION_TYPE:
        return BpmnElementType.Definition;

      default:
        return null;
    }
  }

  private getModelerElementType(type: BpmnElementType): string | null {
    switch (type) {
      case BpmnElementType.Process:
        return MODDLE_BPMN_PROCESS_TYPE;

      case BpmnElementType.Participant:
        return MODDLE_BPMN_PARTICIPANT_TYPE;

      default:
        return null;
    }
  }

  private getCompensationActivityRef(element: any): string | undefined {
    const eventDefinition = element.businessObject?.eventDefinitions?.find(
      (definition: any) => definition.$type === MODDLE_BPMN_COMPENSATION_EVENT_DEFINITION_TYPE,
    );
    return eventDefinition?.activityRef?.id;
  }

  private getEventDefinitionType(elementId: string): any {
    const elementRegistry = this.bpmnModelerProxy.getElementRegistry();
    const selectedElement = elementRegistry.get(elementId);

    if (selectedElement == null) {
      console.error('ERROR: getEventDefinitionType could not find element or type ', elementId);
      return null;
    }

    if (selectedElement.businessObject.eventDefinitions == null) {
      return null;
    }

    return selectedElement.businessObject.eventDefinitions[0]?.$type;
  }

  private castCustomProperty(property: any): BpmnElementCustomProperty {
    return {
      name: property.name,
      value: property.value,
    };
  }

  private getDefinition(): any {
    const firstElement = this.bpmnModelerProxy.getElementRegistry().getAll()[0];
    const definition = getRoot(firstElement.businessObject);

    return definition;
  }
}
