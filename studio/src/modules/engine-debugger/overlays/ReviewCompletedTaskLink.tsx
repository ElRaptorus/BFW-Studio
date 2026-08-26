import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../libs/SelectableElement';

export function createReviewCompletedTaskLink(
  flowNode: FlowNode,
  flowNodeInstance: FlowNodeInstance,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Bifrost,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNode.id,
    position: OverlayPosition.below,
    overlayElement: ReviewCompletedTaskLink,
    overlayProps: {
      Icon,
      onClick: cmd('engine.debugger.taskView.reviewCompleted', [model, flowNodeInstance]),
    },
  };
}

export function ReviewCompletedTaskLink(props: { Icon: IconComponent; onClick: () => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() => props.onClick()}
      data-bs-title="Review completed form"
      data-bs-toggle="tooltip"
      data-test--review-completed-task-overlay
    >
      <div className="action-icon">
        <props.Icon id="ph ph-eye" />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id="ph-fill ph-eye" />
      </div>
    </div>
  );
}
