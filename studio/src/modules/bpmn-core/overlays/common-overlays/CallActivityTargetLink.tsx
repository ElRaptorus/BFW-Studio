import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type { Overlay } from '../BpmnElementOverlayManager';
import { OverlayPosition } from '../BpmnElementOverlayManager';

export function createCallActivityTargetLink(
  studio: Studio,
  flowNodeId: string,
  onClickCommand: string,
  onClickCommandArgs?: any[],
  tooltip?: string,
): Overlay {
  const cmd = studio.commands.getClickHandler();
  return {
    type: 'positioned',
    elementId: flowNodeId,
    position: OverlayPosition.below,
    overlayElement: CallActivityTargetLink,
    overlayProps: {
      onClick: cmd(onClickCommand, onClickCommandArgs),
      tooltip: tooltip,
    },
  };
}

export function CallActivityTargetLink(props: {
  onClick: (event: React.MouseEvent) => void;
  tooltip?: string;
}): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action"
      onClick={props.onClick}
      title={props.tooltip ?? 'Open Target Process in new tab'}
      data-bs-toggle="tooltip"
    >
      <div className="action-icon">
        <Icon id="ph-light ph-arrow-square-out" />
      </div>
      <div className="action-icon-hovered">
        <Icon id="ph-fill ph-arrow-square-out" />
      </div>
    </div>
  );
}
