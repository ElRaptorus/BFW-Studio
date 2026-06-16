import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';

export function createStartProcessOverlay(
  studio: Studio,
  startEventId: string,
  engineId: string,
  processModelId: string,
): Overlay {
  const clickHandler = studio.commands.getClickHandler();

  return {
    type: 'positioned',
    elementId: startEventId,
    position: OverlayPosition.below,
    overlayElement: StartProcessOverlayComponent,
    overlayProps: {
      onClick: clickHandler(MODEL_VIEWER_COMMANDS.startProcessAtStartEvent, [engineId, processModelId, startEventId]),
    },
  };
}

function StartProcessOverlayComponent(props: { onClick: (event: React.MouseEvent) => void }): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={props.onClick}
      title={'Start at this Event\n[Shift+Click] Configured Start'}
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <Icon id="ph-light ph-play" />
      </div>
      <div className="action-icon-hovered">
        <Icon id="ph-fill ph-play" />
      </div>
    </div>
  );
}
