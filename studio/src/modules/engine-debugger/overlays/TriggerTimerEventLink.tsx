import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export function createTriggerTimerEventLink(
  flowNodeInstance: FlowNodeInstance,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Bifrost,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNodeInstance.flowNodeId,
    position: OverlayPosition.below,
    overlayElement: TriggerTimerEventLink,
    overlayProps: {
      Icon,
      onClick: cmd('engine.debugger.triggerTimerEvent', [model, flowNodeInstance]),
    },
  };
}

function TriggerTimerEventLink(props: { Icon: IconComponent; onClick: () => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() => props.onClick()}
      data-bs-title="Trigger Timer Event"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <props.Icon id="ph ph-fast-forward" />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id="ph-fill ph-fast-forward" />
      </div>
    </div>
  );
}
