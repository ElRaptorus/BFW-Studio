import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import type { Overlay } from '../BpmnElementOverlayManager';
import { OverlayPosition } from '../BpmnElementOverlayManager';

export type SingletonProcessOverlayProps = {
  studio: Studio;
};

export function createSingletonProcessOverlay(elementId: string, studio: Studio): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.topRight,
    overlayElement: SingletonProcessOverlay,
    overlayProps: { studio: studio },
  };
}

export function SingletonProcessOverlay(props: SingletonProcessOverlayProps): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__process-is-singleton"
      title="This process is a Singleton and will only be active one instance at a time."
      data-bs-toggle="tooltip"
    >
      <Icon id="bpmn/element/overlay/singletonProcess" />
    </div>
  );
}
