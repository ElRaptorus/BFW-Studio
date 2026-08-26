import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

const internalCustomProperties = {};

// Activities
internalCustomProperties[BpmnElementType.UntypedTask] = [];
internalCustomProperties[BpmnElementType.CallActivity] = ['studio.exampleResult'];
internalCustomProperties[BpmnElementType.UserTask] = ['preferredControl', 'customForm'];
internalCustomProperties[BpmnElementType.ManualTask] = [];
internalCustomProperties[BpmnElementType.ServiceTask] = ['studio.exampleResult'];
internalCustomProperties[BpmnElementType.HttpServiceTask] = ['studio.exampleResult'];
internalCustomProperties[BpmnElementType.SendTask] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.ReceiveTask] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.ScriptTask] = [];
internalCustomProperties[BpmnElementType.BusinessRuleTask] = ['studio.exampleResult'];

// StartEvents
internalCustomProperties[BpmnElementType.StartEvent] = ['studio.defaultCustomStartToken'];
internalCustomProperties[BpmnElementType.MessageStartEvent] = ['studio.defaultCustomStartToken'];
internalCustomProperties[BpmnElementType.SignalStartEvent] = ['studio.defaultCustomStartToken'];
internalCustomProperties[BpmnElementType.TimerStartEvent] = ['enabled', 'studio.defaultCustomStartToken'];

// EndEvents
internalCustomProperties[BpmnElementType.EndEvent] = [];
internalCustomProperties[BpmnElementType.ErrorEndEvent] = [];
internalCustomProperties[BpmnElementType.MessageEndEvent] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.SignalEndEvent] = [];
internalCustomProperties[BpmnElementType.TerminateEndEvent] = [];

// IntermediateEvents
internalCustomProperties[BpmnElementType.MessageIntermediateCatchEvent] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.SignalIntermediateCatchEvent] = [];
internalCustomProperties[BpmnElementType.MessageIntermediateThrowEvent] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.SignalIntermediateThrowEvent] = [];

// BoundaryEvents
internalCustomProperties[BpmnElementType.MessageBoundaryEvent] = ['studio.examplePayload'];
internalCustomProperties[BpmnElementType.SignalBoundaryEvent] = [];

// Gateways
internalCustomProperties[BpmnElementType.ExclusiveGateway] = [];
internalCustomProperties[BpmnElementType.InclusiveGateway] = [];

// Other
internalCustomProperties[BpmnElementType.DataOutputAssociation] = [];
internalCustomProperties[BpmnElementType.DataObjectReference] = [];
internalCustomProperties[BpmnElementType.Subprocess] = [];
internalCustomProperties[BpmnElementType.Process] = [];

export function getInternalCustomPropertyNames(type: BpmnElementType | string): string[] {
  return internalCustomProperties[type] || [];
}
