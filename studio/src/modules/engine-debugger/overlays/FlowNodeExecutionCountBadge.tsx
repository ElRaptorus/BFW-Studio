import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export function createFlowNodeExecutionCountBadge(
  flowNodeId: string,
  selectedCycle: number,
  model: EngineBpmnDebuggerEditorDocumentModel,
  instancesCount: number,
): Overlay {
  return {
    type: 'positioned',
    elementId: flowNodeId,
    position: OverlayPosition.below,
    overlayElement: FlowNodeExecutionCountBadge,
    overlayProps: {
      selectedCycle: selectedCycle,
      uri: model.getUri(),
      flowNodeId: flowNodeId,
      instancesCount: instancesCount,
      selectNextFlowNodeInstance: (direction: -1 | 1) => {
        model.navigateToNextFlowNodeInstance(flowNodeId, direction);
      },
    },
  };
}

export function FlowNodeExecutionCountBadge(props: {
  selectedCycle: number;
  uri: string;
  instancesCount: number;
  selectNextFlowNodeInstance: (direction: -1 | 1) => void;
}): React.JSX.Element {
  const linkText =
    props.selectedCycle === props.instancesCount
      ? props.instancesCount
      : `${props.selectedCycle}/${props.instancesCount}`;

  let tooltip;
  if (props.selectedCycle !== props.instancesCount) {
    tooltip = `Currently viewing Iteration No. ${props.selectedCycle} of ${props.instancesCount}. Click to view previous Iteration.`;
  } else {
    tooltip = `Flow Node was executed ${props.instancesCount} times. Click to view previous Iteration.`;
  }

  return (
    <div
      className={
        'bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action bpmn-element-overlay__below-item--execution-count'
      }
      data-bs-title={tooltip}
      data-bs-toggle="tooltip"
      onClick={(e) => props.selectNextFlowNodeInstance(e.shiftKey ? -1 : 1)}
    >
      <div>{linkText}</div>
    </div>
  );
}
