import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';

import React from 'react';

import type { Overlay } from '../BpmnElementOverlayManager';
import { OverlayPosition } from '../BpmnElementOverlayManager';

export type ProcessNotExecutableOverlayProps = {
  studio: Bifrost;
};

export function createProcessNotExecutableOverlay(elementId: string, studio: Bifrost): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.topRight,
    overlayElement: ProcessNotExecutableOverlay,
    overlayProps: { studio: studio },
  };
}

export function ProcessNotExecutableOverlay(props: ProcessNotExecutableOverlayProps): React.JSX.Element {
  return (
    <div
      className="bpmn-element-overlay__process-not-executable"
      data-bs-title="Process is not marked as executable"
      data-bs-toggle="tooltip"
    >
      <Icon id="bpmn/element/overlay/processNotExecutable" />
    </div>
  );
}
