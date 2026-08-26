import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { BpmnProcess, DataObject, EventDefinition, FlowNode, SequenceFlow } from '@elraptorus/daemonengine_sdk';

import type { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';
import type { ModelViewerSelection } from '../types';

export function isModelViewerDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-model://') === true;
}

export function getSelection(model: EditorDocumentModel | null): ModelViewerSelection | null {
  return (model as ModelViewerDocumentModel | null)?.getSelectedElement() ?? null;
}

export function getSelectedBpmnFlowNode(model: EditorDocumentModel | null): FlowNode | undefined {
  const viewerModel = model as ModelViewerDocumentModel | null;
  const selection = viewerModel?.getSelectedElement();
  const process = viewerModel?.getBpmnProcess();
  if (!selection || !process) {
    return undefined;
  }
  return findFlowNodeById(process, selection.elementId);
}

export function getSelectedSequenceFlow(model: EditorDocumentModel | null): SequenceFlow | undefined {
  const viewerModel = model as ModelViewerDocumentModel | null;
  const selection = viewerModel?.getSelectedElement();
  const process = viewerModel?.getBpmnProcess();
  if (!selection || !process) {
    return undefined;
  }
  return findSequenceFlowById(process, selection.elementId);
}

export function findFlowNodeById(process: BpmnProcess, flowNodeId: string): FlowNode | undefined {
  const walk = (nodes: FlowNode[]): FlowNode | undefined => {
    for (const node of nodes) {
      if (node.id === flowNodeId) {
        return node;
      }
      if (node.typeData.type === 'sub_process') {
        const nested = walk(node.typeData.flowNodes);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  };
  return walk(process.flowNodes);
}

export function findSequenceFlowById(process: BpmnProcess, sequenceFlowId: string): SequenceFlow | undefined {
  const walk = (nodes: FlowNode[], sequenceFlows: SequenceFlow[]): SequenceFlow | undefined => {
    const match = sequenceFlows.find((sequenceFlow) => sequenceFlow.id === sequenceFlowId);
    if (match) {
      return match;
    }
    for (const node of nodes) {
      if (node.typeData.type === 'sub_process') {
        const nested = walk(node.typeData.flowNodes, node.typeData.sequenceFlows);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  };
  return walk(process.flowNodes, process.sequenceFlows);
}

export function readFlowNodeString(
  model: EditorDocumentModel | null,
  reader: (flowNode: FlowNode) => string | null | undefined,
): string | null {
  const flowNode = getSelectedBpmnFlowNode(model);
  if (!flowNode) {
    return null;
  }
  return reader(flowNode) ?? null;
}

export function matchesType(selection: ModelViewerSelection | null, types: string[]): boolean {
  if (!selection) {
    return false;
  }
  return types.some((type) => selection.elementType === type || selection.elementType.endsWith(type));
}

export const SUBPROCESS_SHELL_TYPES = [':SubProcess', ':Transaction', ':AdHocSubProcess'];

export function hasEventDefinition(selection: ModelViewerSelection, eventDefinitionType: string): boolean {
  const eventDefinitions = selection.businessObject.eventDefinitions as Record<string, unknown>[] | undefined;
  return eventDefinitions?.some((definition) => String(definition.$type).includes(eventDefinitionType)) ?? false;
}

export type MappingEntry = { source: string; target: string };

export function getSelectedEventDefinition(model: EditorDocumentModel | null): EventDefinition | undefined {
  const flowNode = getSelectedBpmnFlowNode(model);
  if (!flowNode) {
    return undefined;
  }
  const typeData = flowNode.typeData as { eventDefinition?: EventDefinition };
  return typeData.eventDefinition;
}

export function assertEventDefinitionType<T extends EventDefinition['type']>(
  definition: EventDefinition | null | undefined,
  expectedType: T,
): asserts definition is Extract<EventDefinition, { type: T }> {
  if (definition == null || definition.type !== expectedType) {
    throw new Error(`Unexpected value: event definition should be '${expectedType}' here.`);
  }
}

export function readDataObjectValueContract(model: EditorDocumentModel | null): string | null {
  const viewerModel = model as ModelViewerDocumentModel | null;
  const selection = viewerModel?.getSelectedElement();
  const process = viewerModel?.getBpmnProcess();
  if (!selection || !process) {
    return null;
  }
  const dataObject =
    findDataObjectById(process, selection.elementId) ?? findDataObjectReferencedBy(process, selection.elementId);
  if (!dataObject) {
    return null;
  }
  return dataObject.valueContract != null ? JSON.stringify(dataObject.valueContract, null, 2) : null;
}

function findDataObjectReferencedBy(process: BpmnProcess, referenceId: string): DataObject | undefined {
  const walk = (
    nodes: FlowNode[],
    dataObjectReferences: BpmnProcess['dataObjectReferences'],
  ): DataObject | undefined => {
    const reference = dataObjectReferences.find((entry) => entry.id === referenceId);
    if (reference?.dataObjectRef) {
      return findDataObjectById(process, reference.dataObjectRef);
    }
    for (const node of nodes) {
      if (node.typeData.type === 'sub_process') {
        const nested = walk(node.typeData.flowNodes, node.typeData.dataObjectReferences);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  };
  return walk(process.flowNodes, process.dataObjectReferences);
}

function findDataObjectById(process: BpmnProcess, dataObjectId: string): DataObject | undefined {
  if (!dataObjectId) {
    return undefined;
  }
  const walk = (nodes: FlowNode[], dataObjects: DataObject[]): DataObject | undefined => {
    const match = dataObjects.find((dataObject) => dataObject.id === dataObjectId);
    if (match) {
      return match;
    }
    for (const node of nodes) {
      if (node.typeData.type === 'sub_process') {
        const nested = walk(node.typeData.flowNodes, node.typeData.dataObjects);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  };
  return walk(process.flowNodes, process.dataObjects);
}

export function readFlowNodeMappings(model: EditorDocumentModel | null, direction: 'in' | 'out'): MappingEntry[] {
  const flowNode = getSelectedBpmnFlowNode(model);
  if (!flowNode) {
    return [];
  }
  const typeData = flowNode.typeData as { inMappings?: MappingEntry[]; outMappings?: MappingEntry[] };
  return (direction === 'in' ? typeData.inMappings : typeData.outMappings) ?? [];
}

export function findDataObjectReferenceId(process: BpmnProcess, elementId: string): string | null {
  const walk = (nodes: FlowNode[], dataObjectReferences: BpmnProcess['dataObjectReferences']): string | null => {
    const reference = dataObjectReferences.find((entry) => entry.id === elementId);
    if (reference) {
      return reference.dataObjectRef;
    }
    for (const node of nodes) {
      if (node.typeData.type === 'sub_process') {
        const nested = walk(node.typeData.flowNodes, node.typeData.dataObjectReferences);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  };
  return walk(process.flowNodes, process.dataObjectReferences);
}
