import type { Bifrost } from '#bifrost/Bifrost';
import type { BpmnElement } from '#modules/bpmn-editor/BpmnElementTypes';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_BusinessRuleTask, BpmnElement_Participant } from '#modules/bpmn-editor/BpmnElementTypes';

import type { Overlay } from '../bpmn-core/overlays';
import {
  createCallActivityTargetLink,
  createDocumentationBadge,
  createMultipleOutgoingSequenceFlowsWarning,
  createProcessNotExecutableOverlay,
} from '../bpmn-core/overlays';
import type BpmnDocumentModel from './BpmnDocumentModel';

export function createFlowNodeOverlays(element: BpmnElement, studio: Bifrost, model: BpmnDocumentModel): Overlay[] {
  const overlays: Overlay[] = [];

  if (element.type === BpmnElementType.CallActivity && (element as any).processModelId) {
    overlays.push(
      createCallActivityTargetLink(studio, element.id, 'bpmn.callActivity.openTargetProcess', [
        (element as any).processModelId,
      ]),
    );
  }

  if (element.type === BpmnElementType.BusinessRuleTask) {
    const businessRuleTask = element as BpmnElement_BusinessRuleTask;
    if (businessRuleTask.implementation === 'dmn' && businessRuleTask.decisionRef) {
      overlays.push(
        createCallActivityTargetLink(
          studio,
          element.id,
          'bpmn.businessRuleTask.openTargetDecision',
          [businessRuleTask.decisionRef],
          `Open DMN "${businessRuleTask.decisionRef}" in a new tab`,
        ),
      );
    }
  }

  if (
    element.type === BpmnElementType.Participant &&
    !(element as BpmnElement_Participant).collapsed &&
    !(element as BpmnElement_Participant).process?.isExecutable
  ) {
    overlays.push(createProcessNotExecutableOverlay(element.id, studio));
  }

  if (element.documentation && model.showDocumentationMarker) {
    overlays.push(createDocumentationBadge(element.id, studio, () => openDocumentationPane(studio)));
  }

  const sequenceFlowCount =
    element.outgoingFlows && element.outgoingFlows.filter((flow) => flow.type === BpmnElementType.SequenceFlow).length;

  const multipleOutgoingSequenceFlowsAllowed =
    element.type === BpmnElementType.DataObject ||
    element.type === BpmnElementType.ComplexGateway ||
    element.type === BpmnElementType.ParallelGateway ||
    element.type === BpmnElementType.ExclusiveGateway ||
    element.type === BpmnElementType.InclusiveGateway ||
    element.type === BpmnElementType.EventBasedGateway;

  if (
    model.showMultipleOutgoingSequenceFlowsMarkers &&
    sequenceFlowCount > 1 &&
    !multipleOutgoingSequenceFlowsAllowed
  ) {
    overlays.push(createMultipleOutgoingSequenceFlowsWarning(element.id, sequenceFlowCount));
  }

  return overlays;
}

function openDocumentationPane(studio: Bifrost): void {
  studio.panes.setActiveGroupInArea('right', 'documentation');
  studio.panes.showPaneArea('right');
}
