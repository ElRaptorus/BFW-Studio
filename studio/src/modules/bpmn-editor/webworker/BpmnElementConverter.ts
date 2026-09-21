import { BpmnModdle } from 'bpmn-moddle';

import bfwPlatformModdleDescriptor from '../../bpmn-core/bpmn-js/moddle/bfw-platform.json';

/* eslint-disable @typescript-eslint/no-unused-vars, no-var, no-useless-assignment */
const window: any = self;
const global: any = self;
var Buffer: any = Buffer || [];
var process: any = process || {
  env: { DEBUG: undefined },
  version: [],
};
/* eslint-enable @typescript-eslint/no-unused-vars, no-var, no-useless-assignment */

const moddle = new BpmnModdle({ bfw: bfwPlatformModdleDescriptor });

const BPMN_CATERGORY_REF_PROPERTY = 'categoryValueRef';
const BPMN_DEFINITION_TYPE = 'bpmn:Definitions';
const BPMN_ERROR_EVENT_DEFINITION_TYPE = 'bpmn:ErrorEventDefinition';
const BPMN_ERROR_REF_PROPERTY = 'errorRef';
const BPMN_ERROR_TYPE = 'bpmn:Error';
const BPMN_ESCALATION_REF_PROPERTY = 'escalationRef';
const BPMN_ESCALATION_TYPE = 'bpmn:Escalation';
const BPMN_EVENT_DEFINITION_ESCALATION_TYPE = 'bpmn:EscalationEventDefinition';
const BPMN_MESSAGE_EVENT_DEFINITION_TYPE = 'bpmn:MessageEventDefinition';
const BPMN_MESSAGE_REF_PROPERTY = 'messageRef';
const BPMN_PROCESS_REF_PROPERTY = 'processRef';
const BPMN_PROCESS_TYPE = 'bpmn:Process';
const BPMN_SUBPROCESS_TYPE = 'bpmn:SubProcess';

export type IndexedBpmnElement = {
  /**
   * Basic proeprties
   */
  documentation: string;
  id: string;
  metadata: any;
  name: string;
  text: string;
  type: string;

  /**
   * Optional additional properties
   */
  calledElement?: string;
  categoryValue?: string;
  condition?: string;
  defaultValue?: string;
  eventDefinitions?: any[];
  extensions?: any[];
  formFieldType?: string;
  label?: string;
  references?: any[];
  script?: string;
  timerDefinition?: string;
  timerType?: string;
  value?: string;
};

export async function getElementsFromXml(xml: string): Promise<IndexedBpmnElement[]> {
  const definitions = await getDefinitionsFromModeler(xml);

  const elements = getElementsFromDefinitions(definitions);

  return elements;
}

function getElementsFromDefinitions(definitions: any): any[] {
  const list: any[] = [];
  const referencesList: any[] = [];
  const errorPropertiesByErrorId = new Map<string, { errorCode?: string; errorMessage?: string }>();

  const collectElementsFromThing = (thing: any, metadataMemo: object): void => {
    let metadata = { ...metadataMemo };
    const type = thing.$type;

    if (type === BPMN_DEFINITION_TYPE) {
      metadata = { ...metadata, definitionId: thing.id };
      const element = getProperties(thing, metadata);
      list.push(element);
    } else if (type === BPMN_PROCESS_TYPE) {
      metadata = { ...metadata, processId: thing.id };
    } else if (type.match(/(Event|Flow|Gateway|Task)$/) != null) {
      metadata = { ...metadata, flowNodeId: thing.id };
    }

    if (thing.rootElements) {
      thing.rootElements.forEach((rootElement: any) => {
        if (rootElement.$type === BPMN_ERROR_TYPE) {
          const errorProperties = getErrorProperties(rootElement);
          metadata = { ...metadata, ...errorProperties };
        }
        if (rootElement.$type === BPMN_ESCALATION_TYPE) {
          const escalationProperties = getEscalationProperties(rootElement);
          metadata = { ...metadata, ...escalationProperties };
        }

        const element = getProperties(rootElement, metadata);

        list.push(element);

        collectElementsFromThing(rootElement, metadata);
      });
    }

    if (thing.flowElements) {
      thing.flowElements.forEach((flowElement: any) => {
        const element = getProperties(flowElement, metadata);

        list.push(element);

        const references = getElementReferences(flowElement);
        if (references != null) {
          referencesList.push(...references);
        }

        const flowNodesMetaData =
          flowElement.$type === BPMN_SUBPROCESS_TYPE
            ? { ...metadata, embeddedProcessModelId: flowElement.id }
            : metadata;

        collectElementsFromThing(flowElement, flowNodesMetaData);
      });
    }

    if (thing.laneSets) {
      thing.laneSets.forEach((laneSet: any) => {
        const element = getProperties(laneSet, metadata);
        list.push(element);

        collectElementsFromThing(laneSet, metadata);
      });
    }

    if (thing.lanes) {
      thing.lanes.forEach((lane: any) => {
        const element = getProperties(lane, metadata);
        list.push(element);

        collectElementsFromThing(lane, metadata);
      });
    }

    if (thing.participants) {
      thing.participants.forEach((participant: any) => {
        const element = getProperties(participant, metadata);
        if (participant.processRef != null) {
          element.metadata = {
            ...metadata,
            processId: participant.processRef?.id,
            processName: participant.processRef?.name,
          };

          collectElementsFromThing(participant, metadata);
        }
        list.push(element);

        const references = getElementReferences(participant);
        if (references != null) {
          referencesList.push(...references);
        }
      });
    }

    if (thing.artifacts) {
      thing.artifacts.forEach((artifact: any) => {
        const element = getProperties(artifact, metadata);
        list.push(element);

        const references = getElementReferences(artifact);
        if (references != null) {
          referencesList.push(...references);
        }

        collectElementsFromThing(artifact, metadata);
      });
    }

    if (thing.eventDefinitions) {
      thing.eventDefinitions.forEach((eventDefinition: any) => {
        if (eventDefinition.$type === BPMN_EVENT_DEFINITION_ESCALATION_TYPE) {
          const escalationProperties = getEscalationProperties(eventDefinition);
          metadata = { ...metadata, ...escalationProperties };
        }

        if (eventDefinition.$type === BPMN_ERROR_EVENT_DEFINITION_TYPE) {
          const errorCode = getBfwBodyValue(eventDefinition, 'bfw:ErrorCode');
          const errorMessage = getBfwBodyValue(eventDefinition, 'bfw:ErrorMessage');
          if (errorCode != null || errorMessage != null) {
            const errorRefId = eventDefinition.errorRef?.id;
            if (errorRefId != null) {
              errorPropertiesByErrorId.set(errorRefId, { errorCode, errorMessage });
            }
            metadata = { ...metadata, errorCode, errorMessage };
          }
        }

        const element = getProperties(eventDefinition, metadata);

        list.push(element);

        const references = getElementReferences(eventDefinition);
        if (references != null) {
          referencesList.push(...references);
        }

        collectElementsFromThing(eventDefinition, metadata);
      });
    }

    if (thing.dataOutputAssociations) {
      thing.dataOutputAssociations.forEach((dataOutputAssociation: any) => {
        const element = getProperties(dataOutputAssociation, metadata);
        list.push(element);

        collectElementsFromThing(dataOutputAssociation, metadata);
      });
    }
  };

  collectElementsFromThing(definitions, {});

  for (const element of list) {
    if (element.type === BPMN_ERROR_TYPE && errorPropertiesByErrorId.has(element.id)) {
      const errorProps = errorPropertiesByErrorId.get(element.id);
      element.metadata = { ...element.metadata, ...errorProps };
    }
  }

  const updatedList = list.map((element) => {
    const isSelectable = isElementSelectable(element, definitions);

    const elementCopy = { ...element };
    elementCopy.metadata = { ...elementCopy.metadata, isSelectable: isSelectable };

    const foundReferences = referencesList.filter((value) => {
      return value.elementThatReferences === element.id;
    });

    if (foundReferences.length !== 0) {
      elementCopy.references = foundReferences;
    }

    return elementCopy;
  });

  return updatedList;
}

function isElementSelectable(element, definitions): boolean {
  if (element.type === BPMN_DEFINITION_TYPE) {
    return true;
  }

  const isSelectable = (definitions.diagrams ?? []).some((diagram) => {
    const isShape = diagram.plane?.planeElement?.some((planeElement) => {
      return planeElement.bpmnElement?.id === element.id;
    });

    return isShape;
  });

  return isSelectable;
}

function getElementReferences(element: any): any {
  let references;

  const hasReferences = Object.getOwnPropertyNames(element).some((key) => key.endsWith('Ref'));

  if (hasReferences) {
    references = [];

    Object.getOwnPropertyNames(element)
      .filter((propertyName) => propertyName.endsWith('Ref'))
      .forEach((propertyName) => {
        const referenceObject = element[propertyName];
        let elementThatReferences = element.$parent.id;

        let additionalProperties = {};

        switch (propertyName) {
          case BPMN_ERROR_REF_PROPERTY:
            additionalProperties = {
              errorCode: getBfwBodyValue(element, 'bfw:ErrorCode'),
              errorMessage: getBfwBodyValue(element, 'bfw:ErrorMessage'),
            };
            break;

          case BPMN_ESCALATION_REF_PROPERTY:
            additionalProperties = {
              ...getEscalationProperties(referenceObject),
            };
            break;

          case BPMN_PROCESS_REF_PROPERTY:
            elementThatReferences = element.id;
            additionalProperties = {
              version: getBfwBodyValue(referenceObject, 'bfw:Version'),
            };
            break;

          case BPMN_CATERGORY_REF_PROPERTY:
            elementThatReferences = element.id;
            additionalProperties = {
              categoryValue: referenceObject.value,
            };
            break;

          case BPMN_MESSAGE_REF_PROPERTY:
            if (element.$type === BPMN_MESSAGE_EVENT_DEFINITION_TYPE) {
              break;
            }
            elementThatReferences = element.id;
            break;

          default:
            break;
        }

        references.push({
          id: referenceObject.id,
          type: referenceObject.$type,
          name: referenceObject.name,
          elementThatReferences: elementThatReferences,
          propertyName: propertyName,
          ...additionalProperties,
        });
      });
  }

  return references;
}

function getProperties(element: any, metadata: object): any {
  const basicProperties: any = {
    type: element.$type,
    id: element.id,
    name: element.name,
  };

  if (element.documentation && Array.isArray(element.documentation)) {
    basicProperties.documentation = element.documentation.map((element: any) => element.text).join('\n');
  }

  if (element.extensionElements && Array.isArray(element.extensionElements.values)) {
    const extensions: any[] = [];
    element.extensionElements.values.forEach((extension: any) => {
      if (extension.$children) {
        extension.$children.forEach((childElement: any) => {
          const child = getProperties(childElement, metadata);
          extensions.push(child);
        });
      } else if (extension.body != null || extension.$body != null) {
        extensions.push({
          type: extension.$type,
          id: extension.id,
          name: extension.name,
          value: extension.body ?? extension.$body,
          metadata,
        });
      }
    });

    basicProperties.extensions = extensions;
  }

  if (element.eventDefinitions && Array.isArray(element.eventDefinitions)) {
    const eventDefinitions: any[] = [];
    element.eventDefinitions.forEach((eventDefinition: any) => {
      const definition = getProperties(eventDefinition, metadata);
      eventDefinitions.push(definition);
    });

    basicProperties.eventDefinitions = eventDefinitions;
  }

  return {
    ...basicProperties,
    ...getAdditionalProperties(element),
    metadata,
  };
}

function getAdditionalProperties(element): any {
  const additionalProperties: any = {};

  if (element.text != null) {
    additionalProperties.text = element.text;
  }

  if (element.value != null) {
    additionalProperties.value = element.value;
  }

  if (element.type != null) {
    additionalProperties.formFieldType = element.type;
  }

  if (element.defaultValue != null) {
    additionalProperties.defaultValue = element.defaultValue;
  }

  if (element.label != null) {
    additionalProperties.label = element.label;
  }

  if (element.condition != null) {
    additionalProperties.condition = element.condition.body;
  }

  if (element.timeCycle != null) {
    additionalProperties.timerType = 'cycle';
    additionalProperties.timerDefinition = element.timeCycle.body;
  }

  if (element.timeDate != null) {
    additionalProperties.timerType = 'date';
    additionalProperties.timerDefinition = element.timeDate.body;
  }

  if (element.timeDuration != null) {
    additionalProperties.timerType = 'duration';
    additionalProperties.timerDefinition = element.timeDuration.body;
  }

  if (element.calledElement != null) {
    additionalProperties.calledElement = element.calledElement;
  }

  if (element.conditionExpression != null) {
    additionalProperties.condition = element.conditionExpression.body;
  }

  if (element.script != null) {
    additionalProperties.script = element.script;
  }

  if (element.categoryValue != null && Array.isArray(element.categoryValue)) {
    additionalProperties.categoryValue = element.categoryValue[0].value;
  }

  return additionalProperties;
}

function getErrorProperties(element): any {
  const { errorCode } = element;
  return { errorCode };
}

function getBfwBodyValue(element: any, extensionType: string): string | undefined {
  const values = element.extensionElements?.values;
  if (!Array.isArray(values)) {
    return undefined;
  }
  const ext = values.find((value: any) => value.$type === extensionType);
  if (ext == null) {
    return undefined;
  }
  return ext.body ?? ext.$body ?? undefined;
}

function getEscalationProperties(element): any {
  const { escalationCode } = element;
  return { escalationCode: escalationCode };
}

async function getDefinitionsFromModeler(data: string): Promise<any> {
  try {
    const bpmn = await moddle.fromXML(data);

    return Promise.resolve(bpmn.rootElement);
  } catch (error) {
    return Promise.reject(error);
  }
}
