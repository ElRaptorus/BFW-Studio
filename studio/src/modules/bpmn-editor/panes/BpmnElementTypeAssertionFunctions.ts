import type {
  BpmnElement,
  BpmnElement_BusinessRuleTask,
  BpmnElement_CallActivity,
  BpmnElement_ConditionalBoundaryEvent,
  BpmnElement_ConditionalFlow,
  BpmnElement_ConditionalIntermediateCatchEvent,
  BpmnElement_ConditionalStartEvent,
  BpmnElement_DataObject,
  BpmnElement_DefaultFlow,
  BpmnElement_ErrorBoundaryEvent,
  BpmnElement_ErrorEndEvent,
  BpmnElement_ErrorStartEvent,
  BpmnElement_EscalationBoundaryEvent,
  BpmnElement_EscalationEndEvent,
  BpmnElement_EscalationIntermediateThrowEvent,
  BpmnElement_EscalationStartEvent,
  BpmnElement_Group,
  BpmnElement_HttpServiceTask,
  BpmnElement_IntermediateEvent,
  BpmnElement_LinkIntermediateCatchEvent,
  BpmnElement_LinkIntermediateThrowEvent,
  BpmnElement_ManualTask,
  BpmnElement_MessageBoundaryEvent,
  BpmnElement_MessageEndEvent,
  BpmnElement_MessageIntermediateCatchEvent,
  BpmnElement_MessageIntermediateThrowEvent,
  BpmnElement_MessageStartEvent,
  BpmnElement_Participant,
  BpmnElement_Process,
  BpmnElement_ReceiveTask,
  BpmnElement_ScriptTask,
  BpmnElement_SendTask,
  BpmnElement_ServiceTask,
  BpmnElement_SignalBoundaryEvent,
  BpmnElement_SignalEndEvent,
  BpmnElement_SignalIntermediateCatchEvent,
  BpmnElement_SignalIntermediateThrowEvent,
  BpmnElement_SignalStartEvent,
  BpmnElement_TextAnnotation,
  BpmnElement_TimerBoundaryEvent,
  BpmnElement_TimerIntermediateEvent,
  BpmnElement_TimerStartEvent,
  BpmnElement_UntypedTask,
  BpmnElement_UserTask,
} from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { BpmnElementType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

export function assertBpmnElementIsBusinessRuleTask(
  element: BpmnElement | null,
): asserts element is BpmnElement_BusinessRuleTask {
  assertIsType(element, BpmnElementType.BusinessRuleTask);
}

export function assertBpmnElementIsMessageEvent(
  element: BpmnElement | null,
): asserts element is
  | BpmnElement_MessageBoundaryEvent
  | BpmnElement_MessageEndEvent
  | BpmnElement_MessageIntermediateCatchEvent
  | BpmnElement_MessageIntermediateThrowEvent
  | BpmnElement_MessageStartEvent
  | BpmnElement_SendTask
  | BpmnElement_ReceiveTask {
  const elementIsMessageEvent = element?.type.endsWith('/Message');
  const elementIsReceiveTask = element?.type === BpmnElementType.ReceiveTask;
  const elementIsSendTask = element?.type === BpmnElementType.SendTask;

  if (elementIsMessageEvent || elementIsReceiveTask || elementIsSendTask) {
    return;
  }

  throw new Error(
    `Expected BpmnElement to be of type '*/Message', 'ReceiveTask' or 'SendTask', got: ${JSON.stringify(element, null, 2)}`,
  );
}

export function assertBpmnElementIsSignalEvent(
  element: BpmnElement | null,
): asserts element is
  | BpmnElement_SignalBoundaryEvent
  | BpmnElement_SignalEndEvent
  | BpmnElement_SignalIntermediateCatchEvent
  | BpmnElement_SignalIntermediateThrowEvent
  | BpmnElement_SignalStartEvent {
  const elementIsSignaleEvent = element?.type.endsWith('/Signal');

  if (elementIsSignaleEvent) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '*/Signal', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsMessageBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_MessageBoundaryEvent {
  assertIsType(element, BpmnElementType.MessageBoundaryEvent);
}

export function assertBpmnElementIsReceiveTask(
  element: BpmnElement | null,
): asserts element is BpmnElement_ReceiveTask {
  assertIsType(element, BpmnElementType.ReceiveTask);
}

export function assertBpmnElementIsSendTask(element: BpmnElement | null): asserts element is BpmnElement_SendTask {
  assertIsType(element, BpmnElementType.SendTask);
}

export function assertBpmnElementIsMessageStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_MessageStartEvent {
  assertIsType(element, BpmnElementType.MessageStartEvent);
}

export function assertBpmnElementIsMessageEndEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_MessageEndEvent {
  assertIsType(element, BpmnElementType.MessageEndEvent);
}

export function assertBpmnElementIsIntermediateEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_IntermediateEvent {
  assertIsType(element, BpmnElementType.IntermediateEvent);
}

export function assertBpmnElementIsMessageIntermediateCatchEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_MessageIntermediateCatchEvent {
  assertIsType(element, BpmnElementType.MessageIntermediateCatchEvent);
}

export function assertBpmnElementIsMessageIntermediateThrowEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_MessageIntermediateThrowEvent {
  assertIsType(element, BpmnElementType.MessageIntermediateThrowEvent);
}

export function assertBpmnElementIsSignalBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_SignalBoundaryEvent {
  assertIsType(element, BpmnElementType.SignalBoundaryEvent);
}

export function assertBpmnElementIsSignalStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_SignalStartEvent {
  assertIsType(element, BpmnElementType.SignalStartEvent);
}

export function assertBpmnElementIsSignalEndEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_SignalEndEvent {
  assertIsType(element, BpmnElementType.SignalEndEvent);
}

export function assertBpmnElementIsSignalIntermediateThrowEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_SignalIntermediateThrowEvent {
  assertIsType(element, BpmnElementType.SignalIntermediateThrowEvent);
}

export function assertBpmnElementIsSignalIntermediateCatchEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_SignalIntermediateCatchEvent {
  assertIsType(element, BpmnElementType.SignalIntermediateCatchEvent);
}

export function assertBpmnElementIsErrorEndEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ErrorEndEvent {
  assertIsType(element, BpmnElementType.ErrorEndEvent);
}

export function assertBpmnElementIsErrorBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ErrorBoundaryEvent {
  assertIsType(element, BpmnElementType.ErrorBoundaryEvent);
}

export function assertBpmnElementIsErrorStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ErrorStartEvent {
  assertIsType(element, BpmnElementType.ErrorStartEvent);
}

export function assertBpmnElementIsErrorEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ErrorBoundaryEvent | BpmnElement_ErrorEndEvent | BpmnElement_ErrorStartEvent {
  const elementIsError = element?.type.endsWith('/Error');
  if (elementIsError) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '*/Error', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsTimerStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_TimerStartEvent {
  assertIsType(element, BpmnElementType.TimerStartEvent);
}

export function assertBpmnElementIsTimerBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_TimerBoundaryEvent {
  assertIsType(element, BpmnElementType.TimerBoundaryEvent);
}

export function assertBpmnElementIsTimerIntermediateEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_TimerIntermediateEvent {
  assertIsType(element, BpmnElementType.TimerIntermediateEvent);
}

export function assertBpmnElementIsTimerEvent(
  element: BpmnElement | null,
): asserts element is
  BpmnElement_TimerStartEvent | BpmnElement_TimerBoundaryEvent | BpmnElement_TimerIntermediateEvent {
  const elementIsTimer = element?.type.endsWith('/Timer');
  if (elementIsTimer) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '*/Timer', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsConditionalFlow(
  element: BpmnElement | null,
): asserts element is BpmnElement_ConditionalFlow {
  assertIsType(element, BpmnElementType.ConditionalFlow);
}

export function assertBpmnElementIsDefaultFlow(
  element: BpmnElement | null,
): asserts element is BpmnElement_DefaultFlow {
  assertIsType(element, BpmnElementType.DefaultFlow);
}

export function assertBpmnElementIsConditionalOrDefaultFlow(
  element: BpmnElement | null,
): asserts element is BpmnElement_ConditionalFlow | BpmnElement_DefaultFlow {
  assertIsAnyType(element, [BpmnElementType.ConditionalFlow, BpmnElementType.DefaultFlow]);
}

export function assertBpmnElementIsLinkIntermediateThrowEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_LinkIntermediateThrowEvent {
  assertIsType(element, BpmnElementType.LinkIntermediateThrowEvent);
}

export function assertBpmnElementIsLinkIntermediateCatchEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_LinkIntermediateCatchEvent {
  assertIsType(element, BpmnElementType.LinkIntermediateCatchEvent);
}

export function assertBpmnElementIsScriptTask(element: BpmnElement | null): asserts element is BpmnElement_ScriptTask {
  assertIsType(element, BpmnElementType.ScriptTask);
}

export function assertBpmnElementIsCallActivity(
  element: BpmnElement | null,
): asserts element is BpmnElement_CallActivity {
  assertIsType(element, BpmnElementType.CallActivity);
}

export function assertBpmnElementIsUntypedTask(
  element: BpmnElement | null,
): asserts element is BpmnElement_UntypedTask {
  assertIsType(element, BpmnElementType.UntypedTask);
}

export function assertBpmnElementIsManualTask(element: BpmnElement | null): asserts element is BpmnElement_ManualTask {
  assertIsType(element, BpmnElementType.ManualTask);
}

export function assertBpmnElementIsParticipant(
  element: BpmnElement | null,
): asserts element is BpmnElement_Participant {
  assertIsType(element, BpmnElementType.Participant);
}

export function assertBpmnElementIsProcess(element: BpmnElement | null): asserts element is BpmnElement_Process {
  assertIsType(element, BpmnElementType.Process);
}

export function assertBpmnElementIsConditionalStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ConditionalStartEvent {
  assertIsType(element, BpmnElementType.ConditionalStartEvent);
}

export function assertBpmnElementIsConditionalBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ConditionalBoundaryEvent {
  assertIsType(element, BpmnElementType.ConditionalBoundaryEvent);
}

export function assertBpmnElementIsConditionalIntermediateCatchEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_ConditionalIntermediateCatchEvent {
  assertIsType(element, BpmnElementType.ConditionalIntermediateCatchEvent);
}

export function assertBpmnElementIsConditionalEvent(
  element: BpmnElement | null,
): asserts element is
  | BpmnElement_ConditionalBoundaryEvent
  | BpmnElement_ConditionalStartEvent
  | BpmnElement_ConditionalIntermediateCatchEvent {
  const elementIsConditional = element?.type.endsWith('/Conditional');
  if (elementIsConditional) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '*/Conditional', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsEscalationBoundaryEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_EscalationBoundaryEvent {
  assertIsType(element, BpmnElementType.EscalationBoundaryEvent);
}

export function assertBpmnElementIsEscalationStartEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_EscalationStartEvent {
  assertIsType(element, BpmnElementType.EscalationStartEvent);
}

export function assertBpmnElementIsEscalationIntermediateThrowEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_EscalationIntermediateThrowEvent {
  assertIsType(element, BpmnElementType.EscalationIntermediateThrowEvent);
}

export function assertBpmnElementIsEscalationEndEvent(
  element: BpmnElement | null,
): asserts element is BpmnElement_EscalationEndEvent {
  assertIsType(element, BpmnElementType.EscalationEndEvent);
}

export function assertBpmnElementIsEscalationEvent(
  element: BpmnElement | null,
): asserts element is
  | BpmnElement_EscalationBoundaryEvent
  | BpmnElement_EscalationIntermediateThrowEvent
  | BpmnElement_EscalationEndEvent
  | BpmnElement_EscalationStartEvent {
  const elementIsEscalation = element?.type.endsWith('/Escalation');
  if (elementIsEscalation) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '*/Escalation', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsTextAnnotation(
  element: BpmnElement | null,
): asserts element is BpmnElement_TextAnnotation {
  assertIsType(element, BpmnElementType.TextAnnotation);
}

export function assertBpmnElementIsServiceTask(
  element: BpmnElement | null,
): asserts element is BpmnElement_ServiceTask {
  const elementIsServiceTask = element?.type.startsWith('ServiceTask');
  if (elementIsServiceTask) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type 'ServiceTask/*', got: ${JSON.stringify(element, null, 2)}`);
}

export function assertBpmnElementIsHttpServiceTask(
  element: BpmnElement | null,
): asserts element is BpmnElement_HttpServiceTask {
  assertIsType(element, BpmnElementType.HttpServiceTask);
}

export function assertBpmnElementIsGroup(element: BpmnElement | null): asserts element is BpmnElement_Group {
  assertIsType(element, BpmnElementType.Group);
}

export function assertBpmnElementIsDataObject(element: BpmnElement | null): asserts element is BpmnElement_DataObject {
  assertIsType(element, BpmnElementType.DataObject);
}

export function assertBpmnElementIsUserTask(element: BpmnElement | null): asserts element is BpmnElement_UserTask {
  assertIsType(element, BpmnElementType.UserTask);
}

function assertIsType(element: BpmnElement | null, type: BpmnElementType): void {
  if (element?.type === type) {
    return;
  }

  throw new Error(`Expected BpmnElement to be of type '${type}', got: ${JSON.stringify(element, null, 2)}`);
}

function assertIsAnyType(element: BpmnElement | null, types: BpmnElementType[]): void {
  const elementHasAnyOfGivenTypes = types.some((type) => type === element?.type);

  if (!elementHasAnyOfGivenTypes) {
    throw new Error(
      `Expected BpmnElement to be any of the types: ${types.join(',')}, got: ${JSON.stringify(element, null, 2)}`,
    );
  }
}
