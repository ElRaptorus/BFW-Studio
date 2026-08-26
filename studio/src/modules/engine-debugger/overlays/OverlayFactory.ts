import type { Bifrost } from '#bifrost/Bifrost';
import {
  EventDefinitionType,
  FlowNodeInstanceState,
  FlowNodeType,
  ProcessInstanceState,
} from '@elraptorus/daemonengine_sdk';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode, DataObjectReference, DataStoreReference } from '@elraptorus/daemonengine_sdk';
import type { Shape } from 'diagram-js/lib/model/Types';

import type { Overlay } from '../../bpmn-core/overlays';
import {
  createCallActivityTargetLink,
  createDocumentationBadge,
  createMultipleOutgoingSequenceFlowsWarning,
} from '../../bpmn-core/overlays';
import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { ExecutableFlowNode } from '../libs';
import { getEscalationCode } from '../libs/BpmnFlowNodeAccessors';
import {
  getChildProcessInstanceId,
  getEventDefinition,
  getTriggererFlowNodeInstance,
  hasLoopCharacteristics,
  isAdHocSubprocess,
  isFlowNodeInParallelRunningBranch,
  resolveEscalationCode,
  resolveMessageName,
  resolveSignalName,
} from '../libs/BpmnProcessHelpers';
import { createAdHocActivationCountBadge } from './AdHocActivationCountBadge';
import { createHasUnfinishedInstancesInfoBadge } from './HasUnfinishedInstancesInfoBadge';
import { createParentProcessInstanceLink } from './ParentProcessInstanceLink';
import { createReviewCompletedTaskLink } from './ReviewCompletedTaskLink';
import { createTriggerTimerEventLink } from './TriggerTimerEventLink';
import { createViewDefinitionLink } from './ViewDefinitionLink';
import {
  createContinueInteractiveTaskLink,
  createEventOverlayLink,
  createFlowNodeExecutionCountBadge,
  createRetryAtFlowNodeLink,
  createTriggerEscalationEventLink,
  createTriggerMessageEventLink,
  createTriggerSignalEventLink,
} from './index';

export function createProcessModelOverlays(studio: Bifrost, model: EngineBpmnDebuggerEditorDocumentModel): Overlay[] {
  const overlays: Overlay[] = [];

  const participant = model.bpmnViewerComponentAdapter
    ?.getElementRegistry()
    .filter((element) => element.type === 'bpmn:Participant' && (element as Shape).businessObject.processRef?.id)
    .find((element) => (element as Shape).businessObject.processRef.id === model.processInstance?.processModelId);
  if (!participant) {
    return overlays;
  }

  if (model.processInstance?.parentProcessInstanceId) {
    overlays.push(
      createParentProcessInstanceLink(participant.id, model, model.processInstance.parentProcessInstanceId, studio),
    );
  }

  if (model.processInstance?.processModelId) {
    overlays.push(createViewDefinitionLink(participant.id, model, studio));
  }

  return overlays;
}

export function createDataStoreOverlays(
  _dataStoreReference: DataStoreReference,
  _studio: Bifrost,
  _model: EngineBpmnDebuggerEditorDocumentModel,
): Overlay[] {
  return [];
}

export function createDataObjectModelOverlays(
  _dataObjectReference: DataObjectReference,
  _studio: Bifrost,
  _model: EngineBpmnDebuggerEditorDocumentModel,
): Overlay[] {
  return [];
}

export function createFlowNodeModelOverlays(
  flowNode: BpmnFlowNode,
  studio: Bifrost,
  model: EngineBpmnDebuggerEditorDocumentModel,
): Overlay[] {
  const overlays: Overlay[] = [];
  const sequenceFlowCount = flowNode.outgoing.length;

  const multipleOutgoingSequenceFlowsAllowed =
    flowNode.type === FlowNodeType.ComplexGateway ||
    flowNode.type === FlowNodeType.ParallelGateway ||
    flowNode.type === FlowNodeType.ExclusiveGateway ||
    flowNode.type === FlowNodeType.InclusiveGateway ||
    flowNode.type === FlowNodeType.EventBasedGateway;

  if (
    model.showMultipleOutgoingSequenceFlowsMarkers &&
    sequenceFlowCount > 1 &&
    !multipleOutgoingSequenceFlowsAllowed
  ) {
    overlays.push(createMultipleOutgoingSequenceFlowsWarning(flowNode.id, sequenceFlowCount));
  }

  if (model.showDocumentationMarker && flowNode.documentation) {
    overlays.push(createDocumentationBadge(flowNode.id, studio, () => openDocumentationPane(studio)));
  }

  return overlays;
}

function openDocumentationPane(studio: Bifrost): void {
  studio.panes.setActiveGroupInArea('right', 'documentation');
  studio.panes.showPaneArea('right');
}

export function createFlowNodeInstanceCover(
  flowNode: ExecutableFlowNode,
  model: EngineBpmnDebuggerEditorDocumentModel,
): Overlay {
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  const flowNodeIsAGateway = flowNodeInstanceIsAGateway(selectedFlowNodeInstance);
  const flowNodeIsAnEvent = flowNodeInstanceIsAnEvent(selectedFlowNodeInstance);

  const flowNodeShadowRendererFlag = getFlowNodeBoxShadowByState(flowNode, selectedFlowNodeInstance);

  const shadowEffect = `bpmn-element-overlay-backdrop-shadow--${flowNodeShadowRendererFlag}`;
  const baseCoverStyle = `bpmn-element-overlay-backdrop--${selectedFlowNodeInstance?.state ?? 'unknown'} ${shadowEffect}`;

  const isCompensationHandler = hasCompensationTypeProperty(selectedFlowNodeInstance);

  if (flowNodeIsAGateway) {
    const shape = model.bpmnViewerComponentAdapter?.getElementRegistry().get(flowNode.id) as Shape | undefined;
    return {
      type: 'partial_cover',
      elementId: flowNode.id,
      cssClassName: `bpmn-element-overlay-backdrop--gateway ${baseCoverStyle}`,
      width: (shape?.width ?? 0) * 0.7,
      height: (shape?.height ?? 0) * 0.7,
    };
  }

  let flowNodeCover: string;
  if (flowNodeIsAnEvent) {
    flowNodeCover = `bpmn-element-overlay-backdrop--rounded ${baseCoverStyle}`;
  } else if (flowNode.flowNodeModel?.type === FlowNodeType.SubProcess) {
    flowNodeCover = isAdHocSubprocess(flowNode.flowNodeModel)
      ? `${baseCoverStyle} bpmn-element-overlay-backdrop--subprocess bpmn-element-overlay-backdrop--adhoc-subprocess`
      : `${baseCoverStyle} bpmn-element-overlay-backdrop--subprocess`;
  } else {
    flowNodeCover = baseCoverStyle;
  }

  if (isCompensationHandler) {
    flowNodeCover = `${flowNodeCover} bpmn-element-overlay-backdrop-compensation`;
  }

  const cornerFlagForRunningOrSuspendedInstancesRequired =
    (flowNodeShadowRendererFlag === 'active' || flowNodeShadowRendererFlag === 'waiting') &&
    flowNodeShadowRendererFlag !== selectedFlowNodeInstance.state;

  if (cornerFlagForRunningOrSuspendedInstancesRequired) {
    flowNodeCover = `${flowNodeCover} bpmn-element-overlay-backdrop-partial--${flowNodeShadowRendererFlag}`;
  }

  return {
    type: 'full_cover',
    elementId: flowNode.id,
    cssClassName: flowNodeCover,
  };
}

export async function createFlowNodeInstanceOverlays(
  flowNode: ExecutableFlowNode,
  studio: Bifrost,
  model: EngineBpmnDebuggerEditorDocumentModel,
): Promise<Overlay[]> {
  const overlays: Overlay[] = [];
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const flowNodeModel = flowNode.flowNodeModel;

  const isActive =
    selectedFlowNodeInstance.state === FlowNodeInstanceState.Waiting ||
    selectedFlowNodeInstance.state === FlowNodeInstanceState.Active;
  const isWaiting = selectedFlowNodeInstance.state === FlowNodeInstanceState.Waiting;

  if (shouldDisplayRetryOverlay(flowNode, model)) {
    overlays.push(createRetryAtFlowNodeLink(flowNode, model, studio));
  }

  const unfinishedInstancesCount = flowNode.flowNodeInstances.filter(
    (instance) => instance.state === FlowNodeInstanceState.Waiting || instance.state === FlowNodeInstanceState.Active,
  ).length;

  if (flowNode.flowNodeInstances.length > 1 && unfinishedInstancesCount > 0) {
    overlays.push(createHasUnfinishedInstancesInfoBadge(flowNode.id, unfinishedInstancesCount, studio));
  }

  const hasMiGroups = flowNode.multiInstanceGroups.length > 0;
  if (hasMiGroups) {
    const latestGroup = flowNode.multiInstanceGroups[flowNode.multiInstanceGroups.length - 1];
    const completedIterations = latestGroup.iterationFnis.filter(
      (fni) => fni.state === FlowNodeInstanceState.Finished,
    ).length;
    const totalIterations = latestGroup.iterationFnis.length;
    const label = totalIterations > 0 ? `${completedIterations}/${totalIterations}` : '0';
    overlays.push(createFlowNodeExecutionCountBadge(flowNode.id, completedIterations, model, totalIterations, label));
  } else if (flowNode.flowNodeInstances.length > 1) {
    const executionCycle =
      flowNode.flowNodeInstances.length -
      flowNode.flowNodeInstances.findIndex((flowNodeInstance) => flowNodeInstance.id === selectedFlowNodeInstance.id);
    overlays.push(
      createFlowNodeExecutionCountBadge(flowNode.id, executionCycle, model, flowNode.flowNodeInstances.length),
    );
  }

  if (flowNodeModel && isAdHocSubprocess(flowNodeModel)) {
    const typeProperties = selectedFlowNodeInstance.typeProperties as Record<string, unknown> | null;
    const activationCount = Number(typeProperties?.['totalActivations'] ?? typeProperties?.['activationCount'] ?? 0);
    if (activationCount > 0) {
      overlays.push(createAdHocActivationCountBadge(flowNode.id, activationCount, studio));
    }
  }

  const childProcessInstanceId = getChildProcessInstanceId(selectedFlowNodeInstance);
  const isCallActivityWithChild = flowNodeModel?.type === FlowNodeType.CallActivity && childProcessInstanceId != null;

  if (isCallActivityWithChild) {
    overlays.push(
      createCallActivityTargetLink(
        studio,
        flowNode.id,
        'engine.debugger.focusOrOpen',
        [model.engineUrl, childProcessInstanceId],
        'Open Child Process Instance in new tab',
      ),
    );
  }

  if (flowNodeModel?.type === FlowNodeType.BusinessRuleTask) {
    const typeProperties = selectedFlowNodeInstance.typeProperties as Record<string, unknown> | null;
    const hasDmnTrace = typeProperties?.mode === 'dmn' && typeof typeProperties.decision_ref === 'string';
    if (hasDmnTrace) {
      overlays.push(
        createCallActivityTargetLink(
          studio,
          flowNode.id,
          'engine.debugger.openDmnTrace',
          [model.engineId, selectedFlowNodeInstance.processInstanceId, selectedFlowNodeInstance.id],
          `Inspect DMN Trace for "${typeProperties.decision_ref}"`,
        ),
      );
    }
  }

  const isInteractiveTask =
    flowNodeModel?.type === FlowNodeType.Task ||
    flowNodeModel?.type === FlowNodeType.ManualTask ||
    flowNodeModel?.type === FlowNodeType.UserTask;

  if (isInteractiveTask && isWaiting) {
    overlays.push(createContinueInteractiveTaskLink(flowNode, selectedFlowNodeInstance.id, model, studio));
  }

  const isUserTask = flowNodeModel?.type === FlowNodeType.UserTask;
  const isFinished = selectedFlowNodeInstance.state === FlowNodeInstanceState.Finished;

  if (isUserTask && isFinished && selectedFlowNodeInstance.outputToken != null) {
    overlays.push(createReviewCompletedTaskLink(flowNode, selectedFlowNodeInstance, model, studio));
  }

  const isCatchEvent =
    flowNodeModel?.type === FlowNodeType.BoundaryEvent || flowNodeModel?.type === FlowNodeType.IntermediateCatchEvent;
  const isReceiveTask = flowNodeModel?.type === FlowNodeType.ReceiveTask;

  const eventDefinition = flowNodeModel ? getEventDefinition(flowNodeModel) : null;
  const processDefinition = model.processDefinition;

  if (
    (isCatchEvent || isReceiveTask) &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Message &&
    isActive &&
    processDefinition
  ) {
    let messageRef: string | null = null;
    if (eventDefinition?.type === 'message') {
      messageRef = eventDefinition.messageRef;
    } else if (flowNodeModel?.typeData.type === 'receive_task') {
      messageRef = flowNodeModel.typeData.messageRef;
    }
    const eventName = resolveMessageName(processDefinition, messageRef);
    overlays.push(createTriggerMessageEventLink(selectedFlowNodeInstance, eventName ?? '', model, studio));
  }

  if (
    isCatchEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Signal &&
    isActive &&
    processDefinition
  ) {
    const signalRef = eventDefinition?.type === 'signal' ? eventDefinition.signalRef : null;
    const eventName = resolveSignalName(processDefinition, signalRef);
    overlays.push(createTriggerSignalEventLink(selectedFlowNodeInstance, eventName ?? '', model, studio));
  }

  if (
    isCatchEvent &&
    selectedFlowNodeInstance.eventType === EventDefinitionType.Escalation &&
    isActive &&
    processDefinition &&
    flowNodeModel
  ) {
    const escalationRef = eventDefinition?.type === 'escalation' ? eventDefinition.escalationRef : null;
    const resolvedCode = resolveEscalationCode(processDefinition, escalationRef);
    const inlineCode = getEscalationCode(flowNodeModel);
    const escalationCode = resolvedCode || inlineCode || '__catchall__';
    overlays.push(createTriggerEscalationEventLink(selectedFlowNodeInstance, escalationCode, model, studio));
  }

  if (isCatchEvent && selectedFlowNodeInstance.eventType === EventDefinitionType.Timer && isActive) {
    overlays.push(createTriggerTimerEventLink(selectedFlowNodeInstance, model, studio));
  }

  if (hasCompensationTypeProperty(selectedFlowNodeInstance)) {
    const properties = selectedFlowNodeInstance.typeProperties as Record<string, unknown>;
    const compensatedForFlowNodeId = properties['compensation_for'] as string | undefined;
    if (compensatedForFlowNodeId) {
      const compensatedFni = model.flowNodeInstances.find(
        (instance) =>
          instance.flowNodeId === compensatedForFlowNodeId && instance.state === FlowNodeInstanceState.Finished,
      );
      if (compensatedFni) {
        overlays.push(
          createEventOverlayLink(
            studio,
            flowNode.id,
            'Go to Compensated Activity',
            'ph ph-arrow-square-out',
            'engine.debugger.selectFlowNodeInstance',
            [compensatedFni.id],
          ),
        );
      }
    }
  }

  if (isFinished && model.compensatedActivities.length > 0) {
    const compensatedEntry = model.compensatedActivities.find((entry) => entry.flowNodeId === flowNode.id);
    if (compensatedEntry) {
      const handlerFni = model.flowNodeInstances.find((instance) => instance.id === compensatedEntry.handlerFniId);
      if (handlerFni) {
        overlays.push(
          createEventOverlayLink(
            studio,
            flowNode.id,
            'Go to Compensation Handler',
            'ph ph-arrow-square-out',
            'engine.debugger.selectFlowNodeInstance',
            [handlerFni.id],
          ),
        );
      }
    }
  }

  const triggererLookup = new Map(model.flowNodeInstances.map((instance) => [instance.id, instance]));
  const triggererFlowNodeInstance = getTriggererFlowNodeInstance(selectedFlowNodeInstance, triggererLookup);

  if (
    (flowNodeModel?.type === FlowNodeType.StartEvent ||
      flowNodeModel?.type === FlowNodeType.IntermediateCatchEvent ||
      flowNodeModel?.type === FlowNodeType.ReceiveTask ||
      flowNodeModel?.type === FlowNodeType.BoundaryEvent) &&
    triggererFlowNodeInstance != null
  ) {
    overlays.push(
      createEventOverlayLink(
        studio,
        flowNode.id,
        'Go to Event Source',
        'ph ph-arrow-square-out',
        'engine.debugger.goToEventParticipant',
        [model.engineUrl, triggererFlowNodeInstance.processInstanceId, triggererFlowNodeInstance.id],
      ),
    );
  }

  if (
    (flowNodeModel?.type === FlowNodeType.EndEvent ||
      flowNodeModel?.type === FlowNodeType.IntermediateThrowEvent ||
      flowNodeModel?.type === FlowNodeType.SendTask) &&
    selectedFlowNodeInstance.eventType != null
  ) {
    const continuedEventFlowNodeInstances = await model.getEventsContinuedByFlowNodeInstance(
      selectedFlowNodeInstance.id,
    );

    if (continuedEventFlowNodeInstances.length > 1) {
      overlays.push(
        createEventOverlayLink(
          studio,
          flowNode.id,
          'Go to Event Receivers',
          'ph ph-arrow-square-out',
          'engine.debugger.open.chooseProcessInstanceFromList',
          [model.engineUrl, continuedEventFlowNodeInstances],
        ),
      );
    } else if (continuedEventFlowNodeInstances.length === 1) {
      overlays.push(
        createEventOverlayLink(
          studio,
          flowNode.id,
          'Go to Event Receiver',
          'ph ph-arrow-square-out',
          'engine.debugger.goToEventParticipant',
          [
            model.engineUrl,
            continuedEventFlowNodeInstances[0].processInstanceId,
            continuedEventFlowNodeInstances[0].id,
          ],
        ),
      );
    }
  }

  return overlays;
}

function getFlowNodeBoxShadowByState(flowNode: ExecutableFlowNode, selectedFlowNodeInstance: FlowNodeInstance): string {
  if (flowNode.flowNodeInstances.some((instance) => instance.state === FlowNodeInstanceState.Waiting)) {
    return 'waiting';
  }
  if (flowNode.flowNodeInstances.some((instance) => instance.state === FlowNodeInstanceState.Active)) {
    return 'active';
  }
  return selectedFlowNodeInstance?.state ?? 'unknown';
}

function flowNodeInstanceIsAnEvent(flowNodeInstance: FlowNodeInstance): boolean {
  return (
    flowNodeInstance.flowNodeType === FlowNodeType.StartEvent ||
    flowNodeInstance.flowNodeType === FlowNodeType.EndEvent ||
    flowNodeInstance.flowNodeType === FlowNodeType.IntermediateCatchEvent ||
    flowNodeInstance.flowNodeType === FlowNodeType.IntermediateThrowEvent ||
    flowNodeInstance.flowNodeType === FlowNodeType.BoundaryEvent
  );
}

function flowNodeInstanceIsAGateway(flowNodeInstance: FlowNodeInstance): boolean {
  return (
    flowNodeInstance.flowNodeType === FlowNodeType.ComplexGateway ||
    flowNodeInstance.flowNodeType === FlowNodeType.ParallelGateway ||
    flowNodeInstance.flowNodeType === FlowNodeType.ExclusiveGateway ||
    flowNodeInstance.flowNodeType === FlowNodeType.InclusiveGateway ||
    flowNodeInstance.flowNodeType === FlowNodeType.EventBasedGateway
  );
}

const shouldDisplayRetryOverlay = (
  flowNode: ExecutableFlowNode,
  model: EngineBpmnDebuggerEditorDocumentModel,
): boolean => {
  if (flowNode.flowNodeInstances.length === 0 || !flowNode.flowNodeModel || !model.processModel) {
    return false;
  }

  const firstFlowNodeInstance = flowNode.flowNodeInstances[0];

  const processIsRetryable =
    model.processInstance?.state === ProcessInstanceState.Fatal ||
    model.processInstance?.state === ProcessInstanceState.Aborted ||
    model.processInstance?.state === ProcessInstanceState.Error;

  const isSupportedFlowNode = !(
    flowNode.shapeType === 'bpmn:ComplexGateway' ||
    flowNode.shapeType === 'bpmn:EventBasedGateway' ||
    flowNode.shapeType === 'bpmn:ExclusiveGateway' ||
    flowNode.shapeType === 'bpmn:InclusiveGateway' ||
    flowNode.shapeType === 'bpmn:ParallelGateway' ||
    flowNode.shapeType === 'bpmn:BoundaryEvent'
  );

  const previousFlowNodeInstanceId = firstFlowNodeInstance.previousFlowNodeInstanceIds[0];
  const isNotFollowingAnEventBasedGateway =
    model.flowNodeInstances.find((instance) => instance.id === previousFlowNodeInstanceId)?.flowNodeType !==
    FlowNodeType.EventBasedGateway;

  const isNotEventBasedGatewayLoser =
    firstFlowNodeInstance.state !== FlowNodeInstanceState.Aborted ||
    firstFlowNodeInstance.typeProperties?.reason !== 'event_based_gateway_sibling_cancelled';

  const isRegularFlowNode = flowNode.flowNodeModel ? !hasLoopCharacteristics(flowNode.flowNodeModel) : false;

  return (
    isRegularFlowNode &&
    processIsRetryable &&
    isSupportedFlowNode &&
    isNotFollowingAnEventBasedGateway &&
    isNotEventBasedGatewayLoser &&
    !isFlowNodeInParallelRunningBranch(model.processModel, flowNode.flowNodeModel)
  );
};

function hasCompensationTypeProperty(fni: FlowNodeInstance | null | undefined): boolean {
  if (!fni?.typeProperties) {
    return false;
  }
  const properties = fni.typeProperties as Record<string, unknown>;
  return properties['compensation_for'] != null || properties['compensation_throw_fni_id'] != null;
}

export { isFlowNodeInParallelRunningBranch };
