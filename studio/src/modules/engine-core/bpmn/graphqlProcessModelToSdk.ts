import { FlowNodeType } from '@elraptorus/daemonengine_sdk';
import type {
  BpmnDefinitions,
  BpmnProcess,
  DataAssociation,
  DataContract,
  DataObject,
  DataObjectReference,
  ErrorDefinition,
  EscalationDefinition,
  EventDefinition,
  Extension,
  FlowNode,
  FlowNodeTypeData,
  Lane,
  LinterRulesetScore,
  Mapping,
  MessageDefinition,
  MultiInstance,
  SequenceFlow,
  SignalDefinition,
  StandardLoop,
} from '@elraptorus/daemonengine_sdk';

type Association = BpmnProcess['associations'][number];

/**
 * Converts a camelized GraphQL `ProcessModel` (Phase 6.1 Model graph) into
 * the SDK `BpmnProcess` / `BpmnDefinitions` shapes the Studio panes already
 * consume. GraphQL `*Node` types flatten type-specific fields onto the node;
 * the SDK uses a `typeData` discriminant. This adapter is the boundary.
 *
 * After `camelizeKeys`, GraphQL `__typename` arrives as `_Typename`. Flow
 * nodes use the `type` enum; event definitions are discriminated by payload
 * fields, then `_Typename`.
 */

export type GraphqlProcessModelConversion = {
  process: BpmnProcess;
  definitions: BpmnDefinitions;
};

const FLOW_NODE_TYPE_VALUES = new Set<string>(Object.values(FlowNodeType));

export function convertGraphqlProcessModel(raw: unknown, bpmnXml = ''): GraphqlProcessModelConversion | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) {
    return null;
  }

  const process = convertProcess(raw);
  const definitions: BpmnDefinitions = {
    definitionsId: asString(raw.definitionsId),
    processes: [process],
    messages: convertMessages(raw.messages),
    signals: convertSignals(raw.signals),
    errors: convertErrors(raw.errors),
    escalations: convertEscalations(raw.escalations),
    rawXml: bpmnXml,
  };

  return { process, definitions };
}

function convertProcess(raw: Record<string, unknown>): BpmnProcess {
  return {
    id: String(raw.id),
    name: asString(raw.name),
    version: asString(raw.version),
    isExecutable: asBoolean(raw.isExecutable, false),
    isTransactionScope: asBoolean(raw.isTransactionScope, false),
    isAdHocScope: asBoolean(raw.isAdHocScope, false),
    correlationKey: asString(raw.correlationKey),
    flowNodes: asRecordArray(raw.flowNodes).map(convertFlowNode),
    sequenceFlows: asRecordArray(raw.sequenceFlows).map(convertSequenceFlow),
    lanes: asRecordArray(raw.lanes).map(convertLane),
    dataObjects: asRecordArray(raw.dataObjects).map(convertDataObject),
    dataObjectReferences: asRecordArray(raw.dataObjectReferences).map(convertDataObjectReference),
    dataStores: [],
    dataStoreReferences: [],
    associations: asRecordArray(raw.associations).map(convertAssociation),
    extensions: asRecordArray(raw.extensions).map(convertExtension),
    linterScores: asRecordArray(raw.linterScores).map(convertLinterScore),
  };
}

function convertFlowNode(raw: Record<string, unknown>): FlowNode {
  const flowNodeType = toFlowNodeType(raw.type);
  return {
    id: String(raw.id ?? ''),
    name: asString(raw.name),
    type: flowNodeType,
    typeData: convertTypeData(flowNodeType, raw),
    incoming: asStringArray(raw.incoming),
    outgoing: asStringArray(raw.outgoing),
    boundaryEventRefs: asStringArray(raw.boundaryEventRefs),
    dataContracts: asRecordArray(raw.dataContracts).map(convertDataContract),
    dataInputAssociations: asRecordArray(raw.dataInputAssociations).map(convertDataAssociation),
    dataOutputAssociations: asRecordArray(raw.dataOutputAssociations).map(convertDataAssociation),
    multiInstance: isRecord(raw.multiInstance) ? convertMultiInstance(raw.multiInstance) : null,
    standardLoop: isRecord(raw.standardLoop) ? convertStandardLoop(raw.standardLoop) : null,
    isForCompensation: asBoolean(raw.isForCompensation, false),
    documentation: asString(raw.documentation),
  };
}

function convertTypeData(flowNodeType: FlowNodeType, raw: Record<string, unknown>): FlowNodeTypeData {
  const mappings = {
    inMappings: asRecordArray(raw.inMappings).map(convertMapping),
    outMappings: asRecordArray(raw.outMappings).map(convertMapping),
  };
  const contracts = {
    payloadContract: asObjectOrNull(raw.payloadContract),
    resultContract: asObjectOrNull(raw.resultContract),
  };

  switch (flowNodeType) {
    case FlowNodeType.StartEvent:
      return {
        type: 'start_event',
        eventDefinition: convertEventDefinition(raw.eventDefinition),
        isInterrupting: asBoolean(raw.isInterrupting, true),
        resultContract: contracts.resultContract,
      };
    case FlowNodeType.EndEvent:
      return {
        type: 'end_event',
        eventDefinition: convertEventDefinition(raw.eventDefinition),
        inMappings: mappings.inMappings,
        payloadContract: contracts.payloadContract,
      };
    case FlowNodeType.IntermediateCatchEvent:
      return {
        type: 'intermediate_catch_event',
        eventDefinition: convertEventDefinition(raw.eventDefinition),
        outMappings: mappings.outMappings,
        resultContract: contracts.resultContract,
      };
    case FlowNodeType.IntermediateThrowEvent:
      return {
        type: 'intermediate_throw_event',
        eventDefinition: convertEventDefinition(raw.eventDefinition),
        inMappings: mappings.inMappings,
        payloadContract: contracts.payloadContract,
      };
    case FlowNodeType.BoundaryEvent:
      return {
        type: 'boundary_event',
        eventDefinition: convertEventDefinition(raw.eventDefinition),
        attachedToRef: asString(raw.attachedToRef),
        cancelActivity: asBoolean(raw.cancelActivity, true),
        compensationHandlerId: asString(raw.compensationHandlerId),
        outMappings: mappings.outMappings,
        resultContract: contracts.resultContract,
      };
    case FlowNodeType.UserTask:
      return {
        type: 'user_task',
        ...mappings,
        ...contracts,
        formSchema: asObjectOrNull(raw.formSchema),
        formActions: Array.isArray(raw.formActions) ? (raw.formActions as Record<string, unknown>[]) : null,
        assigneesExpression: asString(raw.assigneesExpression),
        dueDate: asString(raw.dueDate),
        priority: asNumber(raw.priority),
      };
    case FlowNodeType.ServiceTask:
      return {
        type: 'service_task',
        ...mappings,
        ...contracts,
        implementation: asString(raw.implementation),
        httpUrl: asString(raw.httpUrl),
        httpMethod: asString(raw.httpMethod),
        httpBody: asString(raw.httpBody),
        httpAuthHeader: asString(raw.httpAuthHeader),
        httpResponseHeaders: asString(raw.httpResponseHeaders),
      };
    case FlowNodeType.ManualTask:
      return {
        type: 'manual_task',
        requireConfirmation: asBoolean(raw.requireConfirmation, false),
      };
    case FlowNodeType.ScriptTask:
      return {
        type: 'script_task',
        ...mappings,
        ...contracts,
        scriptFormat: asString(raw.scriptFormat),
        script: asString(raw.script),
        scriptRef: asString(raw.scriptRef),
      };
    case FlowNodeType.BusinessRuleTask:
      return {
        type: 'business_rule_task',
        ...mappings,
        ...contracts,
        implementation: asString(raw.implementation),
        script: asString(raw.script),
        ruleRef: asString(raw.ruleRef),
        decisionRef: asString(raw.decisionRef),
        decisionElementId: asString(raw.decisionElementId),
        resultVariable: asString(raw.resultVariable),
        traceUnmatchedRules: asBoolean(raw.traceUnmatchedRules, false),
      };
    case FlowNodeType.SendTask:
      return {
        type: 'send_task',
        ...mappings,
        messageRef: asString(raw.messageRef),
        payloadContract: contracts.payloadContract,
      };
    case FlowNodeType.ReceiveTask:
      return {
        type: 'receive_task',
        ...mappings,
        messageRef: asString(raw.messageRef),
        resultContract: contracts.resultContract,
      };
    case FlowNodeType.CallActivity:
      return {
        type: 'call_activity',
        ...mappings,
        calledElement: asString(raw.calledElement),
        startEventId: asString(raw.startEventId),
      };
    case FlowNodeType.SubProcess:
      return {
        type: 'sub_process',
        ...mappings,
        ...contracts,
        triggeredByEvent: asBoolean(raw.triggeredByEvent, false),
        isTransaction: asBoolean(raw.isTransaction, false),
        transactionMethod: asString(raw.transactionMethod),
        isAdHoc: asBoolean(raw.isAdHoc, false),
        adhocOrdering: normalizeOrdering(raw.adhocOrdering),
        cancelRemainingInstances: asBoolean(raw.cancelRemainingInstances, true),
        adhocCompletionCondition: asString(raw.adhocCompletionCondition),
        implementation: asString(raw.implementation),
        activeElementsExpression: asString(raw.activeElementsExpression),
        flowNodes: asRecordArray(raw.flowNodes).map(convertFlowNode),
        sequenceFlows: asRecordArray(raw.sequenceFlows).map(convertSequenceFlow),
        dataObjects: asRecordArray(raw.dataObjects).map(convertDataObject),
        dataObjectReferences: asRecordArray(raw.dataObjectReferences).map(convertDataObjectReference),
      };
    case FlowNodeType.ExclusiveGateway:
      return { type: 'exclusive_gateway', defaultFlowRef: asString(raw.defaultFlowRef) };
    case FlowNodeType.InclusiveGateway:
      return { type: 'inclusive_gateway', defaultFlowRef: asString(raw.defaultFlowRef) };
    case FlowNodeType.ComplexGateway:
      return { type: 'complex_gateway', activationCondition: asString(raw.activationCondition) };
    case FlowNodeType.ParallelGateway:
      return { type: 'parallel_gateway' };
    case FlowNodeType.EventBasedGateway:
      return { type: 'event_based_gateway' };
    case FlowNodeType.Task:
    default:
      return { type: 'task' };
  }
}

function convertEventDefinition(raw: unknown): EventDefinition {
  if (!isRecord(raw)) {
    return { type: 'none' };
  }

  const typename = graphqlTypename(raw).toLowerCase();

  if (raw.isNone === true || typename.includes('none')) {
    return { type: 'none' };
  }
  if (raw.isTerminate === true || typename.includes('terminate')) {
    return { type: 'terminate' };
  }
  if (raw.isCancel === true || typename.includes('cancel')) {
    return { type: 'cancel' };
  }
  if (typename.includes('message') || raw.messageRef != null || raw.correlationRetrievalExpression != null) {
    return {
      type: 'message',
      messageRef: asString(raw.messageRef),
      correlationRetrievalExpression: asString(raw.correlationRetrievalExpression),
    };
  }
  if (typename.includes('signal') || raw.signalRef != null) {
    return { type: 'signal', signalRef: asString(raw.signalRef) };
  }
  if (typename.includes('timer') || raw.timeDate != null || raw.timeDuration != null || raw.timeCycle != null) {
    return {
      type: 'timer',
      timeDate: asString(raw.timeDate),
      timeDuration: asString(raw.timeDuration),
      timeCycle: asString(raw.timeCycle),
    };
  }
  if (typename.includes('error') || raw.errorRef != null || raw.errorCode != null) {
    return {
      type: 'error',
      errorRef: asString(raw.errorRef),
      errorCode: asString(raw.errorCode),
      errorMessage: asString(raw.errorMessage),
    };
  }
  if (typename.includes('escalation') || raw.escalationRef != null || raw.escalationCode != null) {
    return {
      type: 'escalation',
      escalationRef: asString(raw.escalationRef),
      escalationCode: asString(raw.escalationCode),
    };
  }
  if (typename.includes('conditional') || raw.conditionExpression != null) {
    return { type: 'conditional', conditionExpression: asString(raw.conditionExpression) };
  }
  if (typename.includes('compensation') || raw.activityRef != null || raw.waitForCompletion != null) {
    return {
      type: 'compensation',
      activityRef: asString(raw.activityRef),
      waitForCompletion: asBoolean(raw.waitForCompletion, true),
    };
  }
  if (typename.includes('link') || raw.linkName != null) {
    return { type: 'link', linkName: asString(raw.linkName) };
  }

  return { type: 'none' };
}

function convertSequenceFlow(raw: Record<string, unknown>): SequenceFlow {
  return {
    id: String(raw.id ?? ''),
    name: asString(raw.name),
    sourceRef: String(raw.sourceRef ?? ''),
    targetRef: String(raw.targetRef ?? ''),
    conditionExpression: asString(raw.conditionExpression),
    isDefault: asBoolean(raw.isDefault, false),
  };
}

function convertLane(raw: Record<string, unknown>): Lane {
  return {
    id: String(raw.id ?? ''),
    name: asString(raw.name),
    flowNodeRefs: asStringArray(raw.flowNodeRefs),
  };
}

function convertDataObject(raw: Record<string, unknown>): DataObject {
  return {
    id: String(raw.id ?? ''),
    name: asString(raw.name),
    itemSubjectRef: asString(raw.itemSubjectRef),
    valueContract: asObjectOrNull(raw.valueContract),
  };
}

function convertDataObjectReference(raw: Record<string, unknown>): DataObjectReference {
  return {
    id: String(raw.id ?? ''),
    name: asString(raw.name),
    dataObjectRef: asString(raw.dataObjectRef),
    dataState: asString(raw.dataState),
  };
}

function convertAssociation(raw: Record<string, unknown>): Association {
  return {
    id: String(raw.id ?? ''),
    sourceRef: asString(raw.sourceRef),
    targetRef: asString(raw.targetRef),
    associationDirection: asString(raw.associationDirection),
  };
}

function convertExtension(raw: Record<string, unknown>): Extension {
  const attributes = isRecord(raw.attributes)
    ? Object.fromEntries(Object.entries(raw.attributes).map(([key, value]) => [key, String(value)]))
    : {};
  return {
    key: String(raw.key ?? ''),
    value: asString(raw.value),
    attributes,
    children: asRecordArray(raw.children).map(convertExtension),
  };
}

function convertLinterScore(raw: Record<string, unknown>): LinterRulesetScore {
  const scorePercent = asNumber(raw.scorePercent);
  return {
    rulesetId: String(raw.rulesetId ?? ''),
    score: scorePercent ?? asNumber(raw.score) ?? 0,
    checks: {
      complianceStatus: raw.complianceStatus ?? null,
      computedAtIso: raw.computedAtIso ?? null,
      schemaVersion: raw.schemaVersion ?? null,
      maxPoints: raw.maxPoints ?? null,
      penaltyPoints: raw.penaltyPoints ?? null,
      rawErrorFindings: raw.rawErrorFindings ?? null,
      rawWarningFindings: raw.rawWarningFindings ?? null,
    },
  };
}

function convertDataContract(raw: Record<string, unknown>): DataContract {
  const direction = normalizeEnum(raw.direction) === 'output' ? 'output' : 'input';
  return {
    direction,
    jsonSchema: asObjectOrNull(raw.jsonSchema) ?? {},
    compiledSchema: null,
  };
}

function convertDataAssociation(raw: Record<string, unknown>): DataAssociation {
  return {
    id: String(raw.id ?? ''),
    sourceRef: asString(raw.sourceRef),
    targetRef: asString(raw.targetRef),
    valueExpression: asString(raw.valueExpression),
  };
}

function convertMapping(raw: Record<string, unknown>): Mapping {
  return {
    source: String(raw.source ?? ''),
    target: String(raw.target ?? ''),
  };
}

function convertMultiInstance(raw: Record<string, unknown>): MultiInstance {
  return {
    isSequential: asBoolean(raw.isSequential, false),
    collectionExpression: asString(raw.collectionExpression),
    elementVariable: asString(raw.elementVariable),
    completionCondition: asString(raw.completionCondition),
    outputCollection: asString(raw.outputCollection),
    outputElementVariable: asString(raw.outputElementVariable),
    loopBreakCondition: asString(raw.loopBreakCondition),
    loopInterval: asString(raw.loopInterval),
    maxIterations: asNumber(raw.maxIterations),
  };
}

function convertStandardLoop(raw: Record<string, unknown>): StandardLoop {
  return {
    testBefore: asBoolean(raw.testBefore, false),
    loopCondition: asString(raw.loopCondition),
    loopMaximum: asNumber(raw.loopMaximum),
    loopInterval: asString(raw.loopInterval),
  };
}

function convertMessages(raw: unknown): MessageDefinition[] {
  return asRecordArray(raw).map((entry) => ({ id: String(entry.id ?? ''), name: asString(entry.name) }));
}

function convertSignals(raw: unknown): SignalDefinition[] {
  return asRecordArray(raw).map((entry) => ({ id: String(entry.id ?? ''), name: asString(entry.name) }));
}

function convertErrors(raw: unknown): ErrorDefinition[] {
  return asRecordArray(raw).map((entry) => ({
    id: String(entry.id ?? ''),
    name: asString(entry.name),
    errorCode: asString(entry.errorCode),
  }));
}

function convertEscalations(raw: unknown): EscalationDefinition[] {
  return asRecordArray(raw).map((entry) => ({
    id: String(entry.id ?? ''),
    name: asString(entry.name),
    escalationCode: asString(entry.escalationCode),
  }));
}

function toFlowNodeType(value: unknown): FlowNodeType {
  const normalized = normalizeEnum(value);
  if (FLOW_NODE_TYPE_VALUES.has(normalized)) {
    return normalized as FlowNodeType;
  }
  return FlowNodeType.Task;
}

function normalizeOrdering(value: unknown): 'parallel' | 'sequential' {
  return normalizeEnum(value) === 'sequential' ? 'sequential' : 'parallel';
}

function normalizeEnum(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

/**
 * The client camelizes `__typename` to `_Typename` (`_t` matches the
 * snake_case converter). That is the wire field the Studio receives.
 */
function graphqlTypename(raw: Record<string, unknown>): string {
  return typeof raw._Typename === 'string' ? raw._Typename : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function asObjectOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
