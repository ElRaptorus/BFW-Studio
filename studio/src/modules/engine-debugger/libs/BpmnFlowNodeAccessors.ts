import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode, EventDefinition } from '@elraptorus/daemonengine_sdk';

import { getEventDefinition } from './BpmnProcessHelpers';

export function getConditionalExpression(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'conditional') {
    return eventDefinition.conditionExpression ?? '';
  }
  return '';
}

/**
 * Fields the engine's built-in HTTP Service Task handler understands. The
 * engine has no vocabulary beyond these five, so the union is exhaustive.
 */
export type HttpServiceTaskField = 'httpUrl' | 'httpMethod' | 'httpBody' | 'httpAuthHeader' | 'httpResponseHeaders';

export function getHttpServiceTaskValue(flowNode: BpmnFlowNode | undefined, field: HttpServiceTaskField): string {
  if (!flowNode || flowNode.typeData.type !== 'service_task') {
    return '';
  }
  return flowNode.typeData[field] ?? '';
}

export function getScriptBody(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'script_task') {
    return '';
  }
  return flowNode.typeData.script ?? '';
}

export function getScriptReference(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'script_task') {
    return '';
  }
  return flowNode.typeData.scriptRef ?? '';
}

export function getBusinessRuleReference(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'business_rule_task') {
    return '';
  }
  return flowNode.typeData.decisionRef ?? '';
}

export function getCallActivityCalledElement(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'call_activity') {
    return '';
  }
  return flowNode.typeData.calledElement ?? '';
}

export function getCallActivityStartEventId(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'call_activity') {
    return '';
  }
  return flowNode.typeData.startEventId ?? '';
}

export function getCallActivityCalledProcessVersion(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'call_activity') {
    return '';
  }
  return flowNode.typeData.calledProcessVersion ?? '';
}

export function getUserTaskAssigneesExpression(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode || flowNode.typeData.type !== 'user_task') {
    return '';
  }
  return flowNode.typeData.assigneesExpression ?? '';
}

export function getUserTaskFormSchema(flowNode: BpmnFlowNode | undefined): unknown {
  if (!flowNode || flowNode.typeData.type !== 'user_task') {
    return null;
  }
  return flowNode.typeData.formSchema;
}

export function getCorrelationRetrievalExpression(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'message') {
    return eventDefinition.correlationRetrievalExpression ?? '';
  }
  return '';
}

export function getMessageReference(flowNode: BpmnFlowNode | undefined): string {
  if (!flowNode) {
    return '';
  }
  if (flowNode.typeData.type === 'receive_task' || flowNode.typeData.type === 'send_task') {
    return flowNode.typeData.messageRef ?? '';
  }
  const eventDefinition = getEventDefinition(flowNode);
  if (eventDefinition?.type === 'message') {
    return eventDefinition.messageRef ?? '';
  }
  return '';
}

export function getLinkName(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'link') {
    return eventDefinition.linkName ?? '';
  }
  return '';
}

export function getErrorCode(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'error') {
    return eventDefinition.errorCode ?? '';
  }
  return '';
}

export function getErrorMessage(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'error') {
    return eventDefinition.errorMessage ?? '';
  }
  return '';
}

export function getEscalationCode(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (eventDefinition?.type === 'escalation') {
    return eventDefinition.escalationCode ?? '';
  }
  return '';
}

export function getTypePropertyString(typeProperties: Record<string, unknown> | null | undefined, key: string): string {
  const value = typeProperties?.[key];
  return typeof value === 'string' ? value : '';
}

export function getTypePropertyRecord(
  typeProperties: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return typeProperties ?? {};
}

export function resolveEventDefinitionName(
  eventDefinition: EventDefinition | null,
  resolveRef: (reference: string | null) => string | null,
): string {
  if (!eventDefinition) {
    return '';
  }
  switch (eventDefinition.type) {
    case 'message':
      return resolveRef(eventDefinition.messageRef) ?? '';
    case 'signal':
      return resolveRef(eventDefinition.signalRef) ?? '';
    case 'link':
      return eventDefinition.linkName ?? '';
    default:
      return '';
  }
}

export function getFlowNodeInstanceTypeProperty(flowNodeInstance: FlowNodeInstance, key: string): unknown {
  return flowNodeInstance.typeProperties?.[key];
}

export type DataMapping = { source: string; target: string };

/**
 * Types that carry `inMappings` on the Engine GraphQL / SDK model.
 * Start events do not — they only carry `resultContract`.
 */
const INPUT_MAPPING_TYPES = new Set([
  'end_event',
  'intermediate_throw_event',
  'user_task',
  'service_task',
  'script_task',
  'business_rule_task',
  'send_task',
  'call_activity',
  'sub_process',
]);

/**
 * Types that carry `outMappings` on the Engine GraphQL / SDK model.
 * Start events do not — Message Start uses `resultContract` only.
 */
const OUTPUT_MAPPING_TYPES = new Set([
  'intermediate_catch_event',
  'boundary_event',
  'user_task',
  'service_task',
  'script_task',
  'business_rule_task',
  'receive_task',
  'call_activity',
  'sub_process',
]);

export function hasInputMappings(flowNode: BpmnFlowNode | undefined): boolean {
  return flowNode != null && INPUT_MAPPING_TYPES.has(flowNode.typeData.type);
}

export function hasOutputMappings(flowNode: BpmnFlowNode | undefined): boolean {
  return flowNode != null && OUTPUT_MAPPING_TYPES.has(flowNode.typeData.type);
}

export function hasDataPipeline(flowNode: BpmnFlowNode | undefined): boolean {
  return hasInputMappings(flowNode) || hasOutputMappings(flowNode);
}

export function getInputMappings(flowNode: BpmnFlowNode | undefined): DataMapping[] {
  if (!flowNode) {
    return [];
  }
  const typeData = flowNode.typeData as { inMappings?: DataMapping[] };
  return typeData.inMappings ?? [];
}

export function getOutputMappings(flowNode: BpmnFlowNode | undefined): DataMapping[] {
  if (!flowNode) {
    return [];
  }
  const typeData = flowNode.typeData as { outMappings?: DataMapping[] };
  return typeData.outMappings ?? [];
}

export function getPayloadContract(flowNode: BpmnFlowNode | undefined): Record<string, unknown> | null {
  if (!flowNode) {
    return null;
  }
  const typeData = flowNode.typeData as { payloadContract?: Record<string, unknown> | null };
  return typeData.payloadContract ?? null;
}

export function getResultContract(flowNode: BpmnFlowNode | undefined): Record<string, unknown> | null {
  if (!flowNode) {
    return null;
  }
  const typeData = flowNode.typeData as { resultContract?: Record<string, unknown> | null };
  return typeData.resultContract ?? null;
}
