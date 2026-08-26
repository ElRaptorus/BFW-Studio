import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';

import React from 'react';

import type { Overlay } from '../BpmnElementOverlayManager';
import { OverlayPosition } from '../BpmnElementOverlayManager';

export type DocumentationIndicatorOverlayRendererProps = {
  studio: Bifrost;
  onClick: (event: React.MouseEvent) => void;
};

export function createDocumentationBadge(
  elementId: string,
  studio: Bifrost,
  onClick: (event: React.MouseEvent) => void,
): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.topRight,
    overlayElement: DocumentationIndicatorOverlay,
    overlayProps: { studio: studio, onClick: onClick },
  };
}

export function DocumentationIndicatorOverlay(props: DocumentationIndicatorOverlayRendererProps): React.JSX.Element {
  return (
    <div
      className="flow-node-overlay__docu-indicator"
      onClick={props.onClick}
      data-bs-title="View Element Documentation"
      data-bs-toggle="tooltip"
    >
      <Icon id="bpmn/element/overlay/documentation" />
    </div>
  );
}
