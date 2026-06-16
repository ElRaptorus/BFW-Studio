import { EventDefinitionType, FlowNodeType } from '@elraptorus/daemonengine_sdk';

/**
 * Maps an SDK FlowNodeType + optional EventDefinitionType to the bpmn-js
 * thumbnail icon name used in the Studio's icon system.
 */
export function resolveFlowNodeIconName(flowNodeType: FlowNodeType, eventType?: EventDefinitionType | null): string {
  if (isEventType(flowNodeType)) {
    return resolveEventIconName(flowNodeType, eventType ?? undefined);
  }

  if (isGatewayType(flowNodeType)) {
    return resolveGatewayIconName(flowNodeType);
  }

  return resolveActivityIconName(flowNodeType);
}

function isEventType(type: FlowNodeType): boolean {
  return (
    type === FlowNodeType.StartEvent ||
    type === FlowNodeType.EndEvent ||
    type === FlowNodeType.IntermediateCatchEvent ||
    type === FlowNodeType.IntermediateThrowEvent ||
    type === FlowNodeType.BoundaryEvent
  );
}

function isGatewayType(type: FlowNodeType): boolean {
  return (
    type === FlowNodeType.ExclusiveGateway ||
    type === FlowNodeType.ParallelGateway ||
    type === FlowNodeType.InclusiveGateway ||
    type === FlowNodeType.EventBasedGateway ||
    type === FlowNodeType.ComplexGateway
  );
}

function resolveEventIconName(flowNodeType: FlowNodeType, eventType?: EventDefinitionType): string {
  const prefix = EVENT_PREFIX_MAP[flowNodeType] ?? 'bpmn-icon-start-event-none';

  if (!eventType) {
    return `${prefix}-none`;
  }

  const suffix = EVENT_SUFFIX_MAP[eventType];
  return suffix ? `${prefix}-${suffix}` : `${prefix}-none`;
}

function resolveGatewayIconName(flowNodeType: FlowNodeType): string {
  return GATEWAY_ICON_MAP[flowNodeType] ?? 'bpmn-icon-gateway-none';
}

function resolveActivityIconName(flowNodeType: FlowNodeType): string {
  return ACTIVITY_ICON_MAP[flowNodeType] ?? 'bpmn-icon-task';
}

const EVENT_PREFIX_MAP: Partial<Record<FlowNodeType, string>> = {
  [FlowNodeType.StartEvent]: 'bpmn-icon-start-event',
  [FlowNodeType.EndEvent]: 'bpmn-icon-end-event',
  [FlowNodeType.IntermediateCatchEvent]: 'bpmn-icon-intermediate-event-catch',
  [FlowNodeType.IntermediateThrowEvent]: 'bpmn-icon-intermediate-event-throw',
  [FlowNodeType.BoundaryEvent]: 'bpmn-icon-intermediate-event-catch',
};

const EVENT_SUFFIX_MAP: Partial<Record<EventDefinitionType, string>> = {
  [EventDefinitionType.Message]: 'message',
  [EventDefinitionType.Signal]: 'signal',
  [EventDefinitionType.Timer]: 'timer',
  [EventDefinitionType.Error]: 'error',
  [EventDefinitionType.Escalation]: 'escalation',
  [EventDefinitionType.Conditional]: 'condition',
  [EventDefinitionType.Compensation]: 'compensation',
  [EventDefinitionType.Terminate]: 'terminate',
  [EventDefinitionType.Cancel]: 'cancel',
  [EventDefinitionType.Link]: 'link',
};

const GATEWAY_ICON_MAP: Partial<Record<FlowNodeType, string>> = {
  [FlowNodeType.ExclusiveGateway]: 'bpmn-icon-gateway-xor',
  [FlowNodeType.ParallelGateway]: 'bpmn-icon-gateway-parallel',
  [FlowNodeType.InclusiveGateway]: 'bpmn-icon-gateway-or',
  [FlowNodeType.EventBasedGateway]: 'bpmn-icon-gateway-eventbased',
  [FlowNodeType.ComplexGateway]: 'bpmn-icon-gateway-complex',
};

const ACTIVITY_ICON_MAP: Partial<Record<FlowNodeType, string>> = {
  [FlowNodeType.Task]: 'bpmn-icon-task',
  [FlowNodeType.UserTask]: 'bpmn-icon-user-task',
  [FlowNodeType.ServiceTask]: 'bpmn-icon-service-task',
  [FlowNodeType.ManualTask]: 'bpmn-icon-manual-task',
  [FlowNodeType.ScriptTask]: 'bpmn-icon-script-task',
  [FlowNodeType.BusinessRuleTask]: 'bpmn-icon-business-rule-task',
  [FlowNodeType.SendTask]: 'bpmn-icon-send-task',
  [FlowNodeType.ReceiveTask]: 'bpmn-icon-receive-task',
  [FlowNodeType.CallActivity]: 'bpmn-icon-call-activity',
  [FlowNodeType.SubProcess]: 'bpmn-icon-subprocess-expanded',
};
