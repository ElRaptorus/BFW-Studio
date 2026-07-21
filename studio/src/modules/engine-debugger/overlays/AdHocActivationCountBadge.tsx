import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import { OverlayPosition } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';

import React from 'react';

import type { IconComponent, Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

export function createAdHocActivationCountBadge(flowNodeId: string, activationCount: number, studio: Studio): Overlay {
  return {
    type: 'positioned',
    elementId: flowNodeId,
    position: OverlayPosition.below,
    overlayElement: AdHocActivationCountBadge,
    overlayProps: {
      Icon,
      activationCount,
    },
  };
}

export function AdHocActivationCountBadge(props: { Icon: IconComponent; activationCount: number }): React.JSX.Element {
  const tooltip =
    props.activationCount === 1
      ? 'Ad-hoc Sub-Process: 1 activity activation.'
      : `Ad-hoc Sub-Process: ${props.activationCount} activity activations.`;

  return (
    <div
      className="bpmn-element-overlay__below-item bpmn-element-overlay__below-item--adhoc-subprocess"
      data-bs-title={tooltip}
      data-bs-toggle="tooltip"
    >
      <div className="fw-bold">
        <props.Icon id="ph-fill ph-list-checks" /> {props.activationCount}
      </div>
    </div>
  );
}
