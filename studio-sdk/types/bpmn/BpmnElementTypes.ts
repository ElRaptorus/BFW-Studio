export type BpmnElement =
  | BpmnElement_BoundaryEvent
  | BpmnElement_CallActivity
  | BpmnElement_ConditionalBoundaryEvent
  | BpmnElement_ConditionalFlow
  | BpmnElement_ConditionalIntermediateCatchEvent
  | BpmnElement_ConditionalStartEvent
  | BpmnElement_DataObject
  | BpmnElement_Association
  | BpmnElement_DataInputAssociation
  | BpmnElement_DataOutputAssociation
  | BpmnElement_Definition
  | BpmnElement_EndEvent
  | BpmnElement_ErrorBoundaryEvent
  | BpmnElement_ErrorEndEvent
  | BpmnElement_ErrorStartEvent
  | BpmnElement_EscalationBoundaryEvent
  | BpmnElement_EscalationEndEvent
  | BpmnElement_EscalationIntermediateThrowEvent
  | BpmnElement_EscalationStartEvent
  | BpmnElement_BusinessRuleTask
  | BpmnElement_ExclusiveGateway
  | BpmnElement_GenericServiceTask
  | BpmnElement_Group
  | BpmnElement_IntermediateEvent
  | BpmnElement_LinkIntermediateCatchEvent
  | BpmnElement_LinkIntermediateThrowEvent
  | BpmnElement_ManualTask
  | BpmnElement_MessageBoundaryEvent
  | BpmnElement_MessageEndEvent
  | BpmnElement_MessageIntermediateCatchEvent
  | BpmnElement_MessageIntermediateThrowEvent
  | BpmnElement_MessageStartEvent
  | BpmnElement_ParallelGateway
  | BpmnElement_Participant
  | BpmnElement_Process
  | BpmnElement_ReceiveTask
  | BpmnElement_ScriptTask
  | BpmnElement_SendTask
  | BpmnElement_SequenceFlow
  | BpmnElement_SignalBoundaryEvent
  | BpmnElement_SignalEndEvent
  | BpmnElement_SignalIntermediateCatchEvent
  | BpmnElement_SignalIntermediateThrowEvent
  | BpmnElement_SignalStartEvent
  | BpmnElement_StartEvent
  | BpmnElement_SubProcess
  | BpmnElement_TextAnnotation
  | BpmnElement_TimerBoundaryEvent
  | BpmnElement_TimerIntermediateEvent
  | BpmnElement_TimerStartEvent
  | BpmnElement_UntypedTask
  | BpmnElement_UserTask
  | BpmnElement_Generic;

export enum BpmnElementType {
  BoundaryEvent = 'BoundaryEvent',
  BusinessRuleTask = 'BusinessRuleTask',
  CallActivity = 'CallActivity',
  CancelBoundaryEvent = 'BoundaryEvent/Cancel',
  CancelEndEvent = 'EndEvent/Cancel',
  CompensationBoundaryEvent = 'BoundaryEvent/Compensation',
  CompensationEndEvent = 'EndEvent/Compensation',
  CompensationStartEvent = 'StartEvent/Compensation',
  CompensationIntermediateThrowEvent = 'IntermediateThrowEvent/Compensation',
  ComplexGateway = 'ComplexGateway',
  ConditionalBoundaryEvent = 'BoundaryEvent/Conditional',
  ConditionalFlow = 'SequenceFlow/Conditional',
  ConditionalIntermediateCatchEvent = 'IntermediateCatchEvent/Conditional',
  ConditionalStartEvent = 'StartEvent/Conditional',
  Association = 'Association',
  DataInputAssociation = 'DataInputAssociation',
  DataObject = 'DataObject',
  DataObjectReference = 'DataObjectReference',
  DataOutputAssociation = 'DataOutputAssociation',
  DataStore = 'DataStore',
  DefaultFlow = 'DefaultFlow',
  Definition = 'Definition',
  EndEvent = 'EndEvent',
  ErrorBoundaryEvent = 'BoundaryEvent/Error',
  ErrorEndEvent = 'EndEvent/Error',
  ErrorStartEvent = 'StartEvent/Error',
  EscalationBoundaryEvent = 'BoundaryEvent/Escalation',
  EscalationEndEvent = 'EndEvent/Escalation',
  EscalationStartEvent = 'StartEvent/Escalation',
  EscalationIntermediateThrowEvent = 'IntermediateThrowEvent/Escalation',
  EventSubprocess = 'EventSubprocess',
  EventBasedGateway = 'EventBasedGateway',
  ExclusiveGateway = 'ExclusiveGateway',
  Group = 'Group',
  IntermediateEvent = 'IntermediateEvent',
  LinkIntermediateCatchEvent = 'IntermediateCatchEvent/Link',
  LinkIntermediateThrowEvent = 'IntermediateThrowEvent/Link',
  ManualTask = 'ManualTask',
  MessageBoundaryEvent = 'BoundaryEvent/Message',
  MessageEndEvent = 'EndEvent/Message',
  MessageFlow = 'MessageFlow',
  MessageIntermediateCatchEvent = 'IntermediateCatchEvent/Message',
  MessageIntermediateThrowEvent = 'IntermediateThrowEvent/Message',
  MessageStartEvent = 'StartEvent/Message',
  ParallelGateway = 'ParallelGateway',
  Participant = 'Participant',
  Process = 'Process',
  ReceiveTask = 'ReceiveTask',
  ScriptTask = 'ScriptTask',
  SendTask = 'SendTask',
  SequenceFlow = 'SequenceFlow',
  ServiceTask = 'ServiceTask',

  HttpServiceTask = 'ServiceTask/Http',
  InclusiveGateway = 'InclusiveGateway',
  SignalBoundaryEvent = 'BoundaryEvent/Signal',
  SignalEndEvent = 'EndEvent/Signal',
  SignalIntermediateCatchEvent = 'IntermediateCatchEvent/Signal',
  SignalIntermediateThrowEvent = 'IntermediateThrowEvent/Signal',
  SignalStartEvent = 'StartEvent/Signal',
  StartEvent = 'StartEvent',
  Subprocess = 'Subprocess',
  TerminateEndEvent = 'EndEvent/Terminate',
  TextAnnotation = 'TextAnnotation',
  TimerBoundaryEvent = 'BoundaryEvent/Timer',
  TimerIntermediateEvent = 'IntermediateEvent/Timer',
  TimerStartEvent = 'StartEvent/Timer',
  Transaction = 'Transaction',
  UntypedTask = 'UntypedTask',
  UserTask = 'UserTask',
}

export type BpmnElement_Generic = BpmnElementCommonProperties & {
  readonly type: string;
};

export type BpmnElementColor = {
  label?: string;
  backgroundColor?: string;
  borderColor?: string;
};

//
// Group
//
export type BpmnElement_Group = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Group;
  readonly categoryValue: string;
};

//
// Association
//
export type BpmnElement_Association = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Association;
};

//
// Data Input Association
//
export type BpmnElement_DataInputAssociation = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.DataInputAssociation;
};

//
// Data Output Association
//
export type BpmnElement_DataOutputAssociation = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.DataOutputAssociation;
  readonly transformation?: string;
};

//
// Data Object
//
export type BpmnElement_DataObject = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.DataObject;
  readonly valueContract?: string;
};

//
// Text Annotation
//
export type BpmnElement_TextAnnotation = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.TextAnnotation;
  readonly text: string;
};

//
// Service Task Implementation Values (BPMN 2.0 spec `implementation` attribute)
//
export const BpmnServiceTaskImplementation = {
  Http: 'http',
  Unspecified: '##unspecified',
} as const;

export type BpmnServiceTaskImplementationValue =
  (typeof BpmnServiceTaskImplementation)[keyof typeof BpmnServiceTaskImplementation];

//
// Custom Service Task Type Registration
//
export type CustomServiceTaskType = {
  implementation: string;
  label: string;
};

//
// Service Task
//
export type BpmnElement_ServiceTask = BpmnElement_GenericServiceTask | BpmnElement_HttpServiceTask;

//
// Generic Service Task (not yet configured or custom implementation)
//
export type BpmnElement_GenericServiceTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ServiceTask;
  readonly implementation?: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Business Rule Task
//
export type BpmnElement_BusinessRuleTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.BusinessRuleTask;
  readonly implementation?: 'feel' | 'dmn';
  readonly script?: string;
  readonly decisionRef?: string;
  readonly decisionElementId?: string;
  readonly resultVariable?: string;
  readonly traceUnmatchedRules?: boolean;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Http Service Task
//
export type BpmnElement_HttpServiceTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.HttpServiceTask;
  readonly implementation: string;
  readonly method?: string;
  readonly url?: string;
  readonly body?: string;
  readonly authHeader?: string;
  readonly responseHeaders?: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Start Event
//
export type BpmnElement_StartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.StartEvent;
};

//
// Call Activity
//
export type BpmnDataMapping = {
  readonly source: string;
  readonly target: string;
};

export type BpmnDataPipeline = {
  readonly inputMappings?: BpmnDataMapping[];
  readonly outputMappings?: BpmnDataMapping[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

export type BpmnElement_CallActivity = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.CallActivity;
  readonly processModelId: string;
  readonly startEventId?: string;
  readonly inputMappings: BpmnDataMapping[];
  readonly outputMappings: BpmnDataMapping[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Sub Process
//
export type BpmnElement_SubProcess = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Subprocess;
  readonly childrenIds: string[];
};

//
// Conditional Start Event
//
export type BpmnElement_ConditionalStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ConditionalStartEvent;

  readonly condition: string;
  readonly variableName: string;
  readonly variableEvent: string;
};

//
// Conditional Boundary Event
//
export type BpmnElement_ConditionalBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ConditionalBoundaryEvent;

  readonly condition: string;
  readonly variableName: string;
  readonly variableEvent: string;
};

//
// Conditional Intermediate Catch Event
//
export type BpmnElement_ConditionalIntermediateCatchEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ConditionalIntermediateCatchEvent;

  readonly condition: string;
  readonly variableName: string;
  readonly variableEvent: string;
};

//
// Escalation Start Event
//
export type BpmnElement_EscalationStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.EscalationStartEvent;
  readonly escalationCode: string;
  readonly name?: string;
};

//
// Escalation Boundary Event
//
export type BpmnElement_EscalationBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.EscalationBoundaryEvent;
  readonly escalationCode: string;
  readonly name?: string;
};

//
// Escalation End Event
//
export type BpmnElement_EscalationEndEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.EscalationEndEvent;
  readonly escalationCode: string;
  readonly name?: string;
};

//
// Escalation IntermediateThrow Event
//
export type BpmnElement_EscalationIntermediateThrowEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.EscalationIntermediateThrowEvent;
  readonly escalationCode: string;
  readonly name?: string;
};

//
// Sequence Flow
//
export type BpmnElement_SequenceFlow = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SequenceFlow;
};

//
// End Event
//
export type BpmnElement_EndEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.EndEvent;
};

//
//  Boundary Event
//
export type BpmnElement_BoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.BoundaryEvent;
};

//
// Intermediate Event
//
export type BpmnElement_IntermediateEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.IntermediateEvent;
};

//
// Exclusive Gateway
//
export type BpmnElement_ExclusiveGateway = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ExclusiveGateway;
};

//
// Parallel Gateway
//
export type BpmnElement_ParallelGateway = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ParallelGateway;
};

//
// Manual Task
//
export type BpmnElement_ManualTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ManualTask;
  readonly requireConfirmation?: boolean;
};

//
// Message Boundary Event
//
export type BpmnElement_MessageBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.MessageBoundaryEvent;

  readonly message: string;
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly resultContract?: string;
  readonly correlationRetrievalExpression?: string;
};

//
// Message Start Event
//
export type BpmnElement_MessageStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.MessageStartEvent;

  readonly message: string;
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly resultContract?: string;
};

//
// Message End Event
//
export type BpmnElement_MessageEndEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.MessageEndEvent;

  readonly message: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
};

//
// Message Intermediate Throw Event
//  'IntermediateThrowEvent/Message';

export type BpmnElement_MessageIntermediateThrowEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.MessageIntermediateThrowEvent;

  readonly message: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
};

//
// Message Intermediate Catch Event
//  'IntermediateCatchEvent/Message';

export type BpmnElement_MessageIntermediateCatchEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.MessageIntermediateCatchEvent;

  readonly message: string;
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly resultContract?: string;
  readonly correlationRetrievalExpression?: string;
};

//
// Signal Boundary Event
//
export type BpmnElement_SignalBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SignalBoundaryEvent;

  readonly signal: string;
  readonly outputMappings?: readonly BpmnDataMapping[];
};

//
// Signal Start Event
//
export type BpmnElement_SignalStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SignalStartEvent;

  readonly signal: string;
  readonly outputMappings?: readonly BpmnDataMapping[];
};

//
// TimerTypes
//

export enum BpmnTimerType {
  Cycle = 'timeCycle',
  Date = 'timeDate',
  Duration = 'timeDuration',
}

//
// Timer Start Event
//
export type BpmnElement_TimerStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.TimerStartEvent;

  readonly timerDefinition: string;
  readonly timerType: BpmnTimerType.Cycle | BpmnTimerType.Date | BpmnTimerType.Duration;
  readonly enabled?: boolean;
};

//
// Timer Boundary Event
//
export type BpmnElement_TimerBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.TimerBoundaryEvent;

  readonly timerDefinition: string;
  readonly timerType: BpmnTimerType.Date | BpmnTimerType.Duration;
};

//
// Timer Intermediate Event
//  'IntermediateEvent/Timer';

export type BpmnElement_TimerIntermediateEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.TimerIntermediateEvent;

  readonly timerDefinition: string;
  readonly timerType: BpmnTimerType.Date | BpmnTimerType.Duration;
};

//
// Signal End Event
//
export type BpmnElement_SignalEndEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SignalEndEvent;

  readonly signal: string;
  readonly inputMappings?: readonly BpmnDataMapping[];
};

//
// Error End Event
//
export type BpmnElement_ErrorEndEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ErrorEndEvent;

  readonly errorName: string;
  readonly errorCode: string;
  readonly errorMessage: string;
};

//
// Error Boundary Event
//
export type BpmnElement_ErrorBoundaryEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ErrorBoundaryEvent;

  readonly errorName: string;
  readonly errorCode: string;
  readonly errorMessage: string;
};

//
// Error Start Event
//
export type BpmnElement_ErrorStartEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ErrorStartEvent;

  readonly errorName: string;
  readonly errorCode: string;
  readonly errorMessage: string;
};

//
// Signal Intermediate Catch Event
//  'IntermediateCatchEvent/Signal';

export type BpmnElement_SignalIntermediateCatchEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SignalIntermediateCatchEvent;

  readonly signal: string;
  readonly outputMappings?: readonly BpmnDataMapping[];
};

//
// Signal Intermediate Throw Event
//  'IntermediateThrowEvent/Signal';

export type BpmnElement_SignalIntermediateThrowEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SignalIntermediateThrowEvent;

  readonly signal: string;
  readonly inputMappings?: readonly BpmnDataMapping[];
};

//
// Link Intermediate Catch Event
//  'IntermediateCatchEvent/Link';

export type BpmnElement_LinkIntermediateCatchEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.LinkIntermediateCatchEvent;

  readonly link: string;
};

//
// Link Intermediate Throw Event
//  'IntermediateThrowEvent/Link';

export type BpmnElement_LinkIntermediateThrowEvent = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.LinkIntermediateThrowEvent;

  readonly link: string;
};

//
// Receive Task
//
export type BpmnElement_ReceiveTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ReceiveTask;

  readonly message: string;
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly resultContract?: string;
  readonly correlationRetrievalExpression?: string;
};

//
// Send Task
//
export type BpmnElement_SendTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.SendTask;

  readonly message: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
};

//
// Untyped Task
//
export type BpmnElement_UntypedTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.UntypedTask;
};

//
// User Task
//
export type BpmnElement_UserTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.UserTask;
  readonly formFieldDefinitions: FormFieldDefinition[];
  readonly formActions: FormAction[];
  readonly assignees?: string;
  readonly dueDate?: string;
  readonly priority?: number;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Form Builder Types
//

export type FormFieldDefinition = {
  readonly id: string;
  readonly type: FormFieldType;
  readonly label: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly pattern?: string;
  readonly options?: FormFieldOption[];
  readonly hint?: string;
};

export type FormFieldOption = {
  readonly value: string;
  readonly label: string;
};

export enum FormFieldType {
  Text = 'text',
  Number = 'number',
  Date = 'date',
  Checkbox = 'checkbox',
  Select = 'select',
  Radio = 'radio',
  Textarea = 'textarea',
  File = 'file',
  Boolean = 'boolean',
  Header = 'header',
}

export type FormAction = {
  readonly id: string;
  readonly label: string;
  readonly preset: FormActionPreset;
  readonly submitsForm: boolean;
  readonly isDefault?: boolean;
  readonly isDanger?: boolean;
};

export enum FormActionPreset {
  Confirm = 'confirm',
  Ok = 'ok',
  Yes = 'yes',
  No = 'no',
  Cancel = 'cancel',
  Custom = 'custom',
}

//
// Conditional Flow
//
export type BpmnElement_ConditionalFlow = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ConditionalFlow;

  readonly condition: string;
};

//
// Default Flow
//
export type BpmnElement_DefaultFlow = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.DefaultFlow;
};

//
// Script Task
//
export type BpmnElement_ScriptTask = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.ScriptTask;
  readonly script?: string;
  readonly scriptRef?: string;
  readonly scriptFormat?: string;
  readonly inputMappings?: readonly { source: string; target: string }[];
  readonly outputMappings?: readonly { source: string; target: string }[];
  readonly payloadContract?: string;
  readonly resultContract?: string;
};

//
// Definition
//
export type BpmnElement_Definition = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Definition;
  // Camunda, Signavio, Bifrost FW, ...
  readonly exporter?: string;
  readonly exporterVersion?: string;
};

//
// Process
//
export type BpmnElement_Process = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Process;
  readonly version?: string;
  readonly correlationKey?: string;
  readonly isExecutable: boolean;
  readonly childrenIds: string[];
};

//
// Participant
//
type BpmnElement_Participant_Base = BpmnElementCommonProperties & {
  readonly type: BpmnElementType.Participant;
  readonly process?: BpmnElement_Process;
  readonly collapsed: boolean;
};

export type BpmnElement_Participant = BpmnElement_Participant_Collapsed | BpmnElement_Participant_Expanded;

export type BpmnElement_Participant_Collapsed = BpmnElement_Participant_Base & {
  readonly collapsed: true;
  readonly process: undefined;
};

export type BpmnElement_Participant_Expanded = BpmnElement_Participant_Base & {
  readonly collapsed: false;
  readonly process: BpmnElement_Process;
};

export type BpmnElement_Participant_WithCollapseCheck =
  BpmnElement_Participant_Collapsed | BpmnElement_Participant_Expanded;

export type BpmnElementCustomProperty = {
  readonly name: string;
  readonly value: string;
};

export enum LoopCharacteristics {
  Loop = 'Loop',
  Parallel = 'Parallel',
  Sequential = 'Sequential',
}

export type BpmnLoopConfig = BpmnStandardLoopConfig | BpmnMultiInstanceLoopConfig;

export type BpmnStandardLoopConfig = {
  readonly kind: 'standard';
  readonly loopCondition?: string;
  readonly loopMaximum?: string;
};

export type BpmnMultiInstanceLoopConfig = {
  readonly kind: 'multiInstance';
  readonly isSequential: boolean;
  readonly loopCardinality?: string;
  readonly completionCondition?: string;
  readonly inputDataItem?: string;
  readonly outputDataItem?: string;
  readonly inputCollection?: string;
  readonly outputCollection?: string;
  readonly loopBreakCondition?: string;
  readonly loopInterval?: string;
  readonly maxIterations?: string;
};

type BpmnElementCommonProperties = {
  readonly __internalModdleId: string;

  readonly id: string;
  readonly name: string;
  readonly documentation: string;
  readonly loopCharacteristics?: LoopCharacteristics;
  readonly loopConfig?: BpmnLoopConfig;
  readonly customProperties: BpmnElementCustomProperty[] | null;
  readonly incomingFlows: BpmnElementIncomingFlow[];
  readonly outgoingFlows: BpmnElementOutgoingFlow[];
  readonly attachedElements: BpmnElementAttachedElement[];
};

type BpmnElementIncomingFlow = {
  readonly id: string;
  readonly type: BpmnElementTypeWithFallback;
  readonly source: {
    readonly id: string;
    readonly type: BpmnElementTypeWithFallback;
  };
};

type BpmnElementOutgoingFlow = {
  readonly id: string;
  readonly type: BpmnElementTypeWithFallback;
  readonly target: {
    readonly id: string;
    readonly type: BpmnElementTypeWithFallback;
  };
};

type BpmnElementAttachedElement = {
  readonly id: string;
  readonly type: BpmnElementTypeWithFallback;
};

type BpmnElementTypeWithFallback = BpmnElementType | string;
