import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { IconComponent, Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../libs/SelectableElement';

export function createContinueInteractiveTaskLink(
  flowNode: FlowNode,
  flowNodeInstanceId: string,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Studio,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNode.id,
    position: OverlayPosition.below,
    overlayElement: ContinueTaskLink,
    overlayProps: {
      Icon,
      onClick: cmd('engine.debugger.continueInteractiveTask', [model, flowNode, flowNodeInstanceId]),
    },
  };
}

export function ContinueTaskLink(props: { Icon: IconComponent; onClick: () => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() => props.onClick()}
      data-bs-title="Continue Task"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <props.Icon id="ph ph-play" />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id="ph-fill ph-play" />
      </div>
    </div>
  );
}
