import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../libs/index';

export type RetryAtFlowNodeLinkProps = {
  flowNode: FlowNode;
  studio: Studio;
  onClick: (event: React.MouseEvent) => void;
};

export function createRetryAtFlowNodeLink(
  flowNode: FlowNode,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Studio,
): Overlay {
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNode.id,
    position: OverlayPosition.below,
    overlayElement: RetryAtFlowNodeLinkRenderer,
    overlayProps: {
      flowNode: flowNode,
      studio: studio,
      onClick: cmd('engine.debugger.retryWithConfirmation', [
        model,
        {
          resetToFlowNodeInstanceId: selectedFlowNodeInstance.id,
          flowNodeName: flowNode.name ?? flowNode.id,
        },
      ]),
    },
  };
}

export function RetryAtFlowNodeLinkRenderer(props: RetryAtFlowNodeLinkProps): React.JSX.Element | null {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={(event) => props.onClick(event)}
      title="Retry at FlowNodeInstance"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <Icon id="ph ph-arrow-clockwise" />
      </div>
      <div className="action-icon-hovered">
        <Icon id="ph-fill ph-arrow-clockwise" />
      </div>
    </div>
  );
}
