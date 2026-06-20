import { EventDefinitionType, FlowNodeType, ProcessInstanceState } from '@elraptorus/daemonengine_sdk';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import type { EditorDocument } from '@evil/bifrost_fw_sdk';

import { ENGINE_DEBUGGER_DOCUMENT_TYPE } from '../Constants';
import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import { hasDataPipeline } from '../libs/BpmnFlowNodeAccessors';
import {
  getHttpMethod,
  isDivergingGateway,
  isHttpServiceTask,
  isSequentialMultiInstance,
  isStandardLoop,
} from '../libs/BpmnProcessHelpers';
import type { DataObject, FlowNode } from '../libs/SelectableElement';

export function shouldDisplayGenericPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasSingleSelectedGeneric(model)
  );
}

export function shouldDisplayMultipleSelectionsPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasMultipleSelectedElements(model)
  );
}

export function shouldDisplayDataObjectInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return isDebuggerDocumentWithSingleSelectedDataObject(document, model);
}

export function shouldDisplayDataObjectValuesPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedDataObject(document, model)) {
    return false;
  }

  const dataObject = getSelectedDataObject(model);

  return model.getSelectableDataObjectInstancesByDataObject(dataObject).length > 0;
}

export function shouldDisplayDataInputAssociationInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) &&
    targetEngineIsOnline(model) &&
    hasSingleSelectedDataInputAssociation(model)
  );
}

export function shouldDisplayDataOutputAssociationInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) &&
    targetEngineIsOnline(model) &&
    hasSingleSelectedDataOutputAssociation(model)
  );
}

export function shouldDisplaySequenceFlowInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasSingleSelectedSequenceFlow(model)
  );
}

export function shouldDisplayProcessInstanceInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasNothingSelected(model);
}

export function shouldDisplayProcessInstanceTriggeredByPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!shouldDisplayProcessInstanceInfoPane(document, model)) {
    return false;
  }

  return model.processInstance != null && model.processInstance.triggererFlowNodeInstanceId != null;
}

export function shouldDisplayProcessInstanceEndEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!shouldDisplayProcessInstanceInfoPane(document, model)) {
    return false;
  }

  return model.processInstance != null && model.processInstance.state != ProcessInstanceState.Running;
}

export function shouldDisplayProcessInstanceErrorPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!shouldDisplayProcessInstanceInfoPane(document, model)) {
    return false;
  }

  return (
    model.processInstance?.errorInfo != null ||
    ((model.processInstance?.state === ProcessInstanceState.Fatal ||
      model.processInstance?.state === ProcessInstanceState.Error) &&
      model.flowNodeInstances.some((instance) => instance.errorInfo != null))
  );
}

export function shouldDisplayCollapsedPoolPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!editorDocumentTypeIsDebugger(document, model) || !targetEngineIsOnline(model)) {
    return false;
  }

  return hasSingleSelectedCollapsedPool(model);
}

export function shouldDisplayProcessModelInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!editorDocumentTypeIsDebugger(document, model) || !targetEngineIsOnline(model)) {
    return false;
  }

  return hasNothingSelected(model) || hasSingleSelectedParticipant(model);
}

export function shouldDisplayFlowNodeInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasSingleSelectedFlowNode(model)
  );
}

export function shouldDisplayFlowNodeInstanceInfoPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model);
}

export function shouldDisplayLoopConfigurationPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel;
  if (!selectedFlowNode) {
    return false;
  }
  return isStandardLoop(selectedFlowNode);
}

export function shouldDisplaySequentialMultiInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel;
  if (!selectedFlowNode) {
    return false;
  }
  return isSequentialMultiInstance(selectedFlowNode);
}

export function shouldDisplayBusinessRuleTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel;
  if (!selectedFlowNode) {
    return false;
  }

  return selectedFlowNode.type === FlowNodeType.BusinessRuleTask;
}

export function shouldDisplayEventTriggerSourcePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.triggererFlowNodeInstanceId != null;
}

export function shouldDisplayFlowNodeInstanceErrorPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.errorInfo != null;
}

export function shouldDisplayCallActivityInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.CallActivity;
}

export function shouldDisplaySubProcessInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!model) {
    return false;
  }

  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.SubProcess;
}

export function shouldDisplayThrowingMessageOrSignalEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  const isThrowingEvent =
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent;

  const isMessageOrSignalEvent =
    selectedFlowNodeInstance.eventType === EventDefinitionType.Message ||
    selectedFlowNodeInstance.eventType === EventDefinitionType.Signal;

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.SendTask || (isThrowingEvent && isMessageOrSignalEvent);
}

export function shouldDisplayThrowingMessageOrSignalOrEscalationEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  const isThrowingEvent =
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent;

  const isMessageOrSignalOrEscalationEvent =
    selectedFlowNodeInstance.eventType === EventDefinitionType.Message ||
    selectedFlowNodeInstance.eventType === EventDefinitionType.Signal ||
    selectedFlowNodeInstance.eventType === EventDefinitionType.Escalation;

  return (
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.SendTask ||
    (isThrowingEvent && isMessageOrSignalOrEscalationEvent)
  );
}

export function shouldDisplayEndTokenPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.outputToken != null;
}

export function shouldDisplayErrorBoundaryEventInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.BoundaryEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Error
  );
}

export function shouldDisplayErrorEndEventInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Error
  );
}

export function ShouldDisplayOutgoingFlowsAndConditionsPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel as BpmnFlowNode | undefined;
  if (!selectedFlowNode) {
    return false;
  }

  return (
    isDivergingGateway(selectedFlowNode) &&
    (selectedFlowNode.type === FlowNodeType.ExclusiveGateway || selectedFlowNode.type === FlowNodeType.InclusiveGateway)
  );
}

export function shouldDisplayHttpServiceTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel as BpmnFlowNode | undefined;
  if (!selectedFlowNode) {
    return false;
  }

  return isHttpServiceTask(selectedFlowNode);
}

export function shouldDisplayHttpServiceTaskInstanceBodyPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel as BpmnFlowNode | undefined;
  if (!selectedFlowNode) {
    return false;
  }

  const method = getHttpMethod(selectedFlowNode);

  return isHttpServiceTask(selectedFlowNode) && (method === 'post' || method === 'put');
}

export function shouldDisplayConditionalEventInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.eventType === EventDefinitionType.Conditional;
}

export function shouldDisplayLinkCatchEventInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateCatchEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Link
  );
}

export function shouldDisplayLinkThrowEventInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Link
  );
}

export function shouldDisplayManualTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.ManualTask;
}

export function shouldDisplayMessageEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.eventType === EventDefinitionType.Message;
}

export function shouldDisplayMessagePayloadPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.eventType === EventDefinitionType.Message &&
    (selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
      selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent)
  );
}

export function shouldDisplayNextFlowNodeInstancesPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  // Note: Parallel Join Gateways have multiple "previousFlowNodeInstanceIds", joined by a ";".
  const nextFlowNodeInstances = model.flowNodeInstances.filter((fni) =>
    fni.previousFlowNodeInstanceIds.includes(selectedFlowNodeInstance.id),
  );

  return nextFlowNodeInstances.length > 0;
}

export function shouldDisplayPreviousFlowNodeInstancesPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.previousFlowNodeInstanceIds.length > 0;
}

export function shouldDisplayReceiveTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.ReceiveTask;
}

export function shouldDisplayScriptTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.ScriptTask;
}

export function shouldDisplaySendTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.SendTask;
}

export function shouldDisplaySignalEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.eventType === EventDefinitionType.Signal;
}

export function shouldDisplaySignalPayloadPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return (
    selectedFlowNodeInstance.eventType === EventDefinitionType.Signal &&
    (selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
      selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent)
  );
}

export function shouldDisplayEscalationThrowEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  const isThrowingEvent =
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent;

  return isThrowingEvent && selectedFlowNodeInstance.eventType === EventDefinitionType.Escalation;
}

export function shouldDisplayEscalationBoundaryEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  const isBoundaryEvent = selectedFlowNodeInstance.flowNodeType === FlowNodeType.BoundaryEvent;

  return isBoundaryEvent && selectedFlowNodeInstance.eventType === EventDefinitionType.Escalation;
}

export function shouldDisplayStartTokenPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.inputToken != null;
}

export function shouldDisplayTimerEventPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.eventType === EventDefinitionType.Timer;
}

export function shouldDisplayUntypedTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.Task;
}

export function shouldDisplayUserTaskInstancePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  return selectedFlowNodeInstance.flowNodeType === FlowNodeType.UserTask;
}

export function shouldDisplayWritenDataObjectValuesPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);

  const hasWrittenToAnyDataObject = model.dataObjectValues.find(
    (dataObjectInstance) => dataObjectInstance.flowNodeInstanceId === selectedFlowNodeInstance.id,
  );

  return hasWrittenToAnyDataObject != null;
}

function isDebuggerDocumentWithSingleSelectedDataObject(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) && targetEngineIsOnline(model) && hasSingleSelectedDataObject(model)
  );
}

function isDebuggerDocumentWithSingleSelectedExecutedFlowNode(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  return (
    editorDocumentTypeIsDebugger(document, model) &&
    targetEngineIsOnline(model) &&
    hasSingleSelectedFlowNodeWithFlowNodeInstances(model)
  );
}

function editorDocumentTypeIsDebugger(document: EditorDocument, model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  return document != null && model != null && document.documentType === ENGINE_DEBUGGER_DOCUMENT_TYPE;
}

function targetEngineIsOnline(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  return model != null && model.engineIsOnline;
}

function hasMultipleSelectedElements(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements == null || selectedElements.length > 1;
}

function hasNothingSelected(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements == null || selectedElements.length < 1;
}

function hasSingleSelectedDataObject(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'DataObject';
}

function hasSingleSelectedDataInputAssociation(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return (
    selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'DataInputAssociation'
  );
}

function hasSingleSelectedDataOutputAssociation(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return (
    selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'DataOutputAssociation'
  );
}

function hasSingleSelectedFlowNode(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'FlowNode';
}

function hasSingleSelectedGeneric(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'Generic';
}

function hasSingleSelectedCollapsedPool(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return (
    selectedElements != null &&
    selectedElements.length === 1 &&
    selectedElements[0].type === 'Participant' &&
    !selectedElements[0].processModelId
  );
}

function hasSingleSelectedParticipant(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return (
    selectedElements != null &&
    selectedElements.length === 1 &&
    selectedElements[0].type === 'Participant' &&
    selectedElements[0].processModelId != null
  );
}

function hasSingleSelectedSequenceFlow(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return selectedElements != null && selectedElements.length === 1 && selectedElements[0].type === 'SequenceFlow';
}

function hasSingleSelectedFlowNodeWithFlowNodeInstances(model: EngineBpmnDebuggerEditorDocumentModel): boolean {
  const selectedElements = model?.selectedElements;
  return (
    selectedElements != null &&
    selectedElements.length === 1 &&
    selectedElements[0].type === 'FlowNode' &&
    selectedElements[0].flowNodeInstances.length > 0
  );
}

function getSelectedDataObject(model: EngineBpmnDebuggerEditorDocumentModel): DataObject {
  return model.selectedElements[0] as DataObject;
}

function getSelectedFlowNode(model: EngineBpmnDebuggerEditorDocumentModel): FlowNode {
  return model.selectedElements[0] as FlowNode;
}

function getSelectedFlowNodeInstance(model: EngineBpmnDebuggerEditorDocumentModel): FlowNodeInstance {
  return model.getSelectedFlowNodeInstanceByFlowNode(getSelectedFlowNode(model));
}

export function shouldDisplayDataPipelinePane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNode = getSelectedFlowNode(model).flowNodeModel as BpmnFlowNode | undefined;
  return hasDataPipeline(selectedFlowNode);
}

const PAYLOAD_CONTRACT_TASK_TYPES = new Set([
  FlowNodeType.UserTask,
  FlowNodeType.ServiceTask,
  FlowNodeType.ScriptTask,
  FlowNodeType.BusinessRuleTask,
  FlowNodeType.CallActivity,
  FlowNodeType.SendTask,
]);

export function shouldDisplayPayloadContractPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);
  if (PAYLOAD_CONTRACT_TASK_TYPES.has(selectedFlowNodeInstance.flowNodeType)) {
    return true;
  }

  const isThrowSideEvent =
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent;

  return isThrowSideEvent && selectedFlowNodeInstance.eventType === EventDefinitionType.Message;
}

const RESULT_CONTRACT_TASK_TYPES = new Set([
  FlowNodeType.UserTask,
  FlowNodeType.ServiceTask,
  FlowNodeType.ScriptTask,
  FlowNodeType.BusinessRuleTask,
  FlowNodeType.CallActivity,
  FlowNodeType.ReceiveTask,
]);

export function shouldDisplayResultContractPane(
  document: EditorDocument,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean {
  if (!isDebuggerDocumentWithSingleSelectedExecutedFlowNode(document, model)) {
    return false;
  }

  const selectedFlowNodeInstance = getSelectedFlowNodeInstance(model);
  if (RESULT_CONTRACT_TASK_TYPES.has(selectedFlowNodeInstance.flowNodeType)) {
    return true;
  }

  const isCatchSideEvent =
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.IntermediateCatchEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.BoundaryEvent ||
    selectedFlowNodeInstance.flowNodeType === FlowNodeType.StartEvent;

  return isCatchSideEvent && selectedFlowNodeInstance.eventType === EventDefinitionType.Message;
}
