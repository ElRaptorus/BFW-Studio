import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';

export function createStartProcessOverlay(
  studio: Bifrost,
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
      data-bs-title={'Start at this Event\n[Shift+Click] Configured Start'}
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
