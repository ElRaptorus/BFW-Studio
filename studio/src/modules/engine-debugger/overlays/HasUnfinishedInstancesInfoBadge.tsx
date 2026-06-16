import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { IconComponent, Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

export function createHasUnfinishedInstancesInfoBadge(
  flowNodeId: string,
  instancesCount: number,
  studio: Studio,
): Overlay {
  return {
    type: 'positioned',
    elementId: flowNodeId,
    position: OverlayPosition.below,
    overlayElement: HasUnfinishedInstancesInfoBadge,
    overlayProps: {
      Icon,
      instancesCount: instancesCount,
    },
  };
}

export function HasUnfinishedInstancesInfoBadge(props: {
  Icon: IconComponent;
  instancesCount: number;
}): React.JSX.Element {
  const tooltip =
    props.instancesCount === 1
      ? 'There is one Instance still waiting to be finished.'
      : `There are ${props.instancesCount} Instances still waiting to be finished.`;

  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--active-instances"
      title={tooltip}
      data-bs-toggle="tooltip"
    >
      <div className="fw-bold">
        <props.Icon id="ph-fill ph-hourglass" /> {props.instancesCount}
      </div>
    </div>
  );
}
