import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { Icon } from '#components/Icon';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

export function createEventOverlayLink(
  studio: Bifrost,
  flowNodeId: string,
  tooltip: string,
  iconId: string,
  onClickCommand: string,
  onClickCommandArgs?: any[],
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNodeId,
    position: OverlayPosition.below,
    overlayElement: EventOverlayLink,
    overlayProps: {
      Icon,
      iconId: iconId,
      onClick: cmd(onClickCommand, onClickCommandArgs),
      tooltip: tooltip,
    },
  };
}

export function EventOverlayLink(props: {
  Icon: IconComponent;
  onClick: (event: React.MouseEvent) => void;
  tooltip: string;
  iconId: string;
}): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={props.onClick}
      data-bs-title={props.tooltip}
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <props.Icon id={`fal ${props.iconId}`} />
      </div>
      <div className="action-icon-hovered">
        <props.Icon id={`fas ${props.iconId}`} />
      </div>
    </div>
  );
}
