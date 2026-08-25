import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { IconComponent, Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export function createTriggerEscalationEventLink(
  flowNodeInstance: FlowNodeInstance,
  escalationCode: string,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Studio,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNodeInstance.flowNodeId,
    position: OverlayPosition.below,
    overlayElement: TriggerEscalationEventLink,
    overlayProps: {
      Icon,
      onClick: cmd('engine.debugger.triggerEscalationEvent', [model, escalationCode, flowNodeInstance]),
    },
  };
}

export function TriggerEscalationEventLink(props: { Icon: IconComponent; onClick: () => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() => props.onClick()}
      data-bs-title="Trigger Escalation Event"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <props.Icon id="ph ph-arrow-fat-up" />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id="ph-fill ph-arrow-fat-up" />
      </div>
    </div>
  );
}
