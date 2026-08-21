import type { BpmnElement, EditorDocument, EditorDocumentModel, PaneComponentProps } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, assertNotNull } from '@evil/bifrost_fw_sdk';
import type { LoopCharacteristics } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../index';

export function shouldBeDisplayedForBpmnElementOfType(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  selectionType: string,
): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const selectedElements = (editorDocumentModel as BpmnDocumentModel)?.selection?.getElements();

  return selectedElements?.length === 1 && selectedElements[0]?.type === selectionType;
}

export function isActivityType(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel) {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.BusinessRuleTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CallActivity) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.HttpServiceTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ManualTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ReceiveTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ScriptTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SendTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ServiceTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.Subprocess) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.Transaction) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.AdHocSubprocess) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.UntypedTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.UserTask)
  );
}

export function isActionableEventType(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel) {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.StartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.IntermediateEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.BoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.SignalIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.SignalIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.TimerStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.TimerIntermediateEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.TimerBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ConditionalStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.ConditionalIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.ConditionalBoundaryEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.EscalationStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.EscalationIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.EscalationBoundaryEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CancelBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.CompensationStartEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.CompensationIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.CompensationBoundaryEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ErrorStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ErrorBoundaryEvent)
  );
}

export function isMessageEventType(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel) {
  return (
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ReceiveTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageEndEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SendTask)
  );
}

export function isSignalEventType(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel) {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalEndEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.SignalIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.SignalIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalBoundaryEvent)
  );
}

const DATA_PIPELINE_BASE_TYPES: string[] = [
  BpmnElementType.UserTask,
  BpmnElementType.ServiceTask,
  BpmnElementType.HttpServiceTask,
  BpmnElementType.ScriptTask,
  BpmnElementType.BusinessRuleTask,
  BpmnElementType.CallActivity,
  BpmnElementType.AdHocSubprocess,
];

const DATA_PIPELINE_PAYLOAD_CONTRACT_TYPES: string[] = [
  BpmnElementType.ServiceTask,
  BpmnElementType.HttpServiceTask,
  BpmnElementType.ScriptTask,
  BpmnElementType.BusinessRuleTask,
  BpmnElementType.AdHocSubprocess,
  BpmnElementType.SendTask,
  BpmnElementType.MessageEndEvent,
  BpmnElementType.MessageIntermediateThrowEvent,
];
const DATA_PIPELINE_INPUT_MAPPING_TYPES: string[] = [
  ...DATA_PIPELINE_BASE_TYPES,
  BpmnElementType.SendTask,
  BpmnElementType.MessageEndEvent,
  BpmnElementType.MessageIntermediateThrowEvent,
  BpmnElementType.SignalEndEvent,
  BpmnElementType.SignalIntermediateThrowEvent,
];
const DATA_PIPELINE_OUTBOUND_TYPES: string[] = [
  ...DATA_PIPELINE_BASE_TYPES,
  BpmnElementType.ReceiveTask,
  BpmnElementType.MessageIntermediateCatchEvent,
  BpmnElementType.MessageBoundaryEvent,
  BpmnElementType.SignalIntermediateCatchEvent,
  BpmnElementType.SignalBoundaryEvent,
];

const DATA_PIPELINE_RESULT_CONTRACT_TYPES: string[] = [
  BpmnElementType.UserTask,
  BpmnElementType.ServiceTask,
  BpmnElementType.HttpServiceTask,
  BpmnElementType.ScriptTask,
  BpmnElementType.BusinessRuleTask,
  BpmnElementType.AdHocSubprocess,
  BpmnElementType.ReceiveTask,
  BpmnElementType.MessageIntermediateCatchEvent,
  BpmnElementType.MessageBoundaryEvent,
  BpmnElementType.MessageStartEvent,
];

const MESSAGE_CATCH_TYPES: string[] = [
  BpmnElementType.MessageIntermediateCatchEvent,
  BpmnElementType.MessageBoundaryEvent,
  BpmnElementType.ReceiveTask,
];

const MESSAGE_THROW_TYPES: string[] = [
  BpmnElementType.MessageIntermediateThrowEvent,
  BpmnElementType.MessageEndEvent,
  BpmnElementType.SendTask,
];

function isSelectedElementInTypeList(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  types: string[],
): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const selectedElements = (editorDocumentModel as BpmnDocumentModel)?.selection?.getElements();
  if (selectedElements?.length !== 1) {
    return false;
  }

  return types.includes(selectedElements[0]?.type);
}

export function shouldBeDisplayedForDataPipelineElement(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, DATA_PIPELINE_BASE_TYPES);
}

export function shouldBeDisplayedForPayloadContractElement(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, DATA_PIPELINE_PAYLOAD_CONTRACT_TYPES);
}

export function shouldBeDisplayedForInputMappingElement(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, DATA_PIPELINE_INPUT_MAPPING_TYPES);
}

export function shouldBeDisplayedForOutboundPipelineElement(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, DATA_PIPELINE_OUTBOUND_TYPES);
}

export function shouldBeDisplayedForResultContractElement(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, DATA_PIPELINE_RESULT_CONTRACT_TYPES);
}

export function isMessageCatchEventType(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, MESSAGE_CATCH_TYPES);
}

export function isMessageThrowEventType(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
): boolean {
  return isSelectedElementInTypeList(editorDocument, editorDocumentModel, MESSAGE_THROW_TYPES);
}

export function getLoopCharacteristicType(editorDocumentModel: EditorDocumentModel): LoopCharacteristics | undefined {
  const selectedElements = (editorDocumentModel as BpmnDocumentModel)?.selection?.getElements();

  return selectedElements?.length === 1 ? selectedElements[0]?.loopCharacteristics : undefined;
}

export function getBpmnSelectionForPropertiesPane(props: PaneComponentProps): BpmnElement[] | null {
  const editorDocument: EditorDocument = props.editorDocument;
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;

  if (
    editorDocument == null ||
    editorDocument.modelKey != 'BpmnDocumentModel' ||
    bpmnDocumentModel == null ||
    !bpmnDocumentModel.isReadyForInteraction()
  ) {
    return null;
  }

  const selection = bpmnDocumentModel.selection.getElements();
  if (selection.length === 0) {
    return null;
  }

  return selection;
}

export function getKeyForPropertiesPane(selection: BpmnElement[]): string {
  const selectedElement = selection[0];
  assertNotNull(selectedElement, 'selectedElement');

  return `${selectedElement.type}__${selectedElement.id}__${selectedElement.name}`;
}
