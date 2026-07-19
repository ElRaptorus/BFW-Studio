import { FlowNodeType } from '@elraptorus/daemonengine_sdk';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type {
  BpmnDefinitions,
  BpmnProcess,
  DataAssociation,
  DataObjectReference,
  DataStoreReference,
  EventDefinition,
  FlowNode,
  SequenceFlow,
} from '@elraptorus/daemonengine_sdk';

export type { BpmnDefinitions, BpmnProcess, FlowNode, SequenceFlow, DataObjectReference, DataStoreReference };

export function findProcessInDefinitions(
  definitions: BpmnDefinitions,
  processModelId: string,
): BpmnProcess | undefined {
  return definitions.processes.find((process) => process.id === processModelId);
}

export function collectFlowNodes(flowNodes: FlowNode[]): FlowNode[] {
  const collected: FlowNode[] = [];
  for (const flowNode of flowNodes) {
    collected.push(flowNode);
    if (flowNode.typeData.type === 'sub_process') {
      collected.push(...collectFlowNodes(flowNode.typeData.flowNodes));
    }
  }
  return collected;
}

export function getAllFlowNodes(process: BpmnProcess): FlowNode[] {
  return collectFlowNodes(process.flowNodes);
}

export function getFlowNodeById(process: BpmnProcess, flowNodeId: string): FlowNode | undefined {
  return getAllFlowNodes(process).find((flowNode) => flowNode.id === flowNodeId);
}

export function collectSequenceFlows(flowNodes: FlowNode[], sequenceFlows: SequenceFlow[]): SequenceFlow[] {
  const collected = [...sequenceFlows];
  for (const flowNode of flowNodes) {
    if (flowNode.typeData.type === 'sub_process') {
      collected.push(...collectSequenceFlows(flowNode.typeData.flowNodes, flowNode.typeData.sequenceFlows));
    }
  }
  return collected;
}

export function getAllSequenceFlows(process: BpmnProcess): SequenceFlow[] {
  return collectSequenceFlows(process.flowNodes, process.sequenceFlows);
}

export function getSequenceFlowById(process: BpmnProcess, sequenceFlowId: string): SequenceFlow | undefined {
  return getAllSequenceFlows(process).find((sequenceFlow) => sequenceFlow.id === sequenceFlowId);
}

export function getAllDataObjectReferences(process: BpmnProcess): DataObjectReference[] {
  const collected = [...process.dataObjectReferences];
  collectSubprocessDataObjectReferences(process.flowNodes, collected);
  return collected;
}

function collectSubprocessDataObjectReferences(flowNodes: FlowNode[], collected: DataObjectReference[]): void {
  for (const flowNode of flowNodes) {
    if (flowNode.typeData.type === 'sub_process') {
      const subRefs = (flowNode.typeData as unknown as Record<string, unknown>)['dataObjectReferences'];
      if (Array.isArray(subRefs)) {
        collected.push(...(subRefs as DataObjectReference[]));
      }
      collectSubprocessDataObjectReferences(flowNode.typeData.flowNodes, collected);
    }
  }
}

export function getAllEmbeddedSubProcesses(process: BpmnProcess): FlowNode[] {
  return getAllFlowNodes(process).filter((flowNode) => flowNode.type === FlowNodeType.SubProcess);
}

export function getEventDefinition(flowNode: FlowNode): EventDefinition | null {
  const typeData = flowNode.typeData;
  if ('eventDefinition' in typeData && typeData.eventDefinition) {
    return typeData.eventDefinition;
  }
  return null;
}

export function hasMultiInstance(flowNode: FlowNode): boolean {
  return flowNode.multiInstance != null;
}

export function isSequentialMultiInstance(flowNode: FlowNode): boolean {
  return flowNode.multiInstance?.isSequential === true;
}

export function isStandardLoop(flowNode: FlowNode): boolean {
  return flowNode.standardLoop != null;
}

export function hasLoopCharacteristics(flowNode: FlowNode): boolean {
  return flowNode.multiInstance != null || flowNode.standardLoop != null;
}

export function isDivergingGateway(flowNode: FlowNode): boolean {
  return flowNode.outgoing.length > 1;
}

export function isHttpServiceTask(flowNode: FlowNode): boolean {
  return (
    flowNode.type === FlowNodeType.ServiceTask &&
    flowNode.typeData.type === 'service_task' &&
    flowNode.typeData.implementation === 'http'
  );
}

export function getHttpMethod(flowNode: FlowNode): string {
  if (flowNode.typeData.type !== 'service_task') {
    return 'get';
  }
  const configuration = flowNode.typeData.serviceTaskTypeConfig;
  const method = configuration['httpMethod'];
  return typeof method === 'string' ? method.toLowerCase() : 'get';
}

export function resolveMessageName(definitions: BpmnDefinitions, messageRef: string | null): string | null {
  if (!messageRef) {
    return null;
  }
  return definitions.messages.find((message) => message.id === messageRef)?.name ?? null;
}

export function resolveSignalName(definitions: BpmnDefinitions, signalRef: string | null): string | null {
  if (!signalRef) {
    return null;
  }
  return definitions.signals.find((signal) => signal.id === signalRef)?.name ?? null;
}

export function resolveEscalationName(definitions: BpmnDefinitions, escalationRef: string | null): string | null {
  if (!escalationRef) {
    return null;
  }
  return definitions.escalations.find((escalation) => escalation.id === escalationRef)?.name ?? null;
}

export function getChildProcessInstanceId(flowNodeInstance: FlowNodeInstance): string | null {
  const typeProperties = flowNodeInstance.typeProperties;
  if (!typeProperties) {
    return null;
  }
  const value = typeProperties['childProcessInstanceId'] ?? typeProperties['child_process_instance_id'];
  return typeof value === 'string' ? value : null;
}

export function getTriggererFlowNodeInstance(
  flowNodeInstance: FlowNodeInstance,
  lookup: Map<string, FlowNodeInstance>,
): FlowNodeInstance | null {
  const triggererId = flowNodeInstance.triggererFlowNodeInstanceId;
  if (!triggererId) {
    return null;
  }
  return lookup.get(triggererId) ?? null;
}

export function getPreviousFlowNodeInstances(
  flowNodeInstance: FlowNodeInstance,
  lookup: Map<string, FlowNodeInstance>,
): FlowNodeInstance[] {
  return flowNodeInstance.previousFlowNodeInstanceIds
    .map((previousId) => lookup.get(previousId))
    .filter((instance): instance is FlowNodeInstance => instance != null);
}

export function getPreviousFlowNodes(process: BpmnProcess, flowNode: FlowNode): FlowNode[] {
  const allSequenceFlows = getAllSequenceFlows(process);
  const incomingFlowIds = flowNode.incoming;
  const sourceIds = incomingFlowIds
    .map((flowId) => allSequenceFlows.find((sequenceFlow) => sequenceFlow.id === flowId)?.sourceRef)
    .filter((sourceId): sourceId is string => sourceId != null);
  return sourceIds
    .map((sourceId) => getFlowNodeById(process, sourceId))
    .filter((node): node is FlowNode => node != null);
}

export function isFlowNodeInParallelRunningBranch(process: BpmnProcess, flowNodeToCheck: FlowNode): boolean {
  const parallelGateways = getPreviousParallelGateways(process, flowNodeToCheck);

  const splitGateways = parallelGateways.filter((gateway) => gateway.outgoing.length > 1);

  for (const splitGateway of splitGateways) {
    const joinGateway = findJoinGatewayAfterSplit(process, splitGateway);
    if (!joinGateway) {
      return true;
    }

    const joinGatewayIsBeforeSearchedFlowNode = parallelGateways.some((gateway) => gateway.id === joinGateway.id);
    if (!joinGatewayIsBeforeSearchedFlowNode) {
      return true;
    }
  }

  return false;
}

function findJoinGatewayAfterSplit(process: BpmnProcess, splitGateway: FlowNode): FlowNode | null {
  const visited = new Set<string>();
  const queue: FlowNode[] = getNextFlowNodes(process, splitGateway);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);

    if (current.type === FlowNodeType.ParallelGateway && current.incoming.length > 1) {
      return current;
    }

    queue.push(...getNextFlowNodes(process, current));
  }

  return null;
}

function getNextFlowNodes(process: BpmnProcess, flowNode: FlowNode): FlowNode[] {
  const allSequenceFlows = getAllSequenceFlows(process);
  return flowNode.outgoing
    .map((flowId) => allSequenceFlows.find((sequenceFlow) => sequenceFlow.id === flowId)?.targetRef)
    .filter((targetId): targetId is string => targetId != null)
    .map((targetId) => getFlowNodeById(process, targetId))
    .filter((node): node is FlowNode => node != null);
}

function getPreviousParallelGateways(
  process: BpmnProcess,
  flowNode: FlowNode,
  searchedFlowNodes: FlowNode[] = [],
): FlowNode[] {
  const parallelGateways: FlowNode[] = [];

  if (searchedFlowNodes.includes(flowNode)) {
    return [];
  }

  searchedFlowNodes.push(flowNode);

  if (flowNode.type === FlowNodeType.ParallelGateway) {
    parallelGateways.push(flowNode);
  }

  for (const previousFlowNode of getPreviousFlowNodes(process, flowNode)) {
    parallelGateways.push(...getPreviousParallelGateways(process, previousFlowNode, searchedFlowNodes));
  }

  return parallelGateways.filter(
    (parallelGateway, index, array) => array.findIndex((entry) => entry.id === parallelGateway.id) === index,
  );
}

export function findDataInputAssociationTarget(
  process: BpmnProcess,
  associationId: string,
): { association: DataAssociation; target: FlowNode } | undefined {
  for (const flowNode of getAllFlowNodes(process)) {
    const association = flowNode.dataInputAssociations.find((entry) => entry.id === associationId);
    if (association) {
      return { association, target: flowNode };
    }
  }
  return undefined;
}

export function findDataOutputAssociationSource(
  process: BpmnProcess,
  associationId: string,
): { association: DataAssociation; source: FlowNode } | undefined {
  for (const flowNode of getAllFlowNodes(process)) {
    const association = flowNode.dataOutputAssociations.find((entry) => entry.id === associationId);
    if (association) {
      return { association, source: flowNode };
    }
  }
  return undefined;
}
