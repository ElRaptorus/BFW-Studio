import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export function createTriggerSignalEventLink(
  flowNodeInstance: FlowNodeInstance,
  signalName: string,
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Bifrost,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNodeInstance.flowNodeId,
    position: OverlayPosition.below,
    overlayElement: TriggerSignalEventLink,
    overlayProps: {
      Icon,
      onClick: cmd('engine.debugger.triggerSignalEvent', [model, signalName, flowNodeInstance]),
    },
  };
}

export function TriggerSignalEventLink(props: { Icon: IconComponent; onClick: () => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={() => props.onClick()}
      data-bs-title="Trigger Signal Event"
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <props.Icon id="ph ph-broadcast" />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id="ph-fill ph-broadcast" />
      </div>
    </div>
  );
}
