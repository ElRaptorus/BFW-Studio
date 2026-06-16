import React from 'react';

import type { Overlay } from '../BpmnElementOverlayManager';
import { OverlayPosition } from '../BpmnElementOverlayManager';

export type MultipleSequenceFlowsWarningOverlayProps = {
  outgoingSequenceFlows: number;
};

export function createMultipleOutgoingSequenceFlowsWarning(elementId: string, sequenceFlowCount: number): Overlay {
  return {
    type: 'positioned',
    elementId: elementId,
    position: OverlayPosition.middleRight,
    overlayElement: MultipleSequenceFlowsWarningOverlay,
    overlayProps: { outgoingSequenceFlows: sequenceFlowCount },
  };
}

export function MultipleSequenceFlowsWarningOverlay(
  props: MultipleSequenceFlowsWarningOverlayProps,
): React.JSX.Element {
  return (
    <div
      className="flow-node-overlay__multiple-outgoing-sequence-flows-indicator"
      title={`Error: Flow Node has ${props.outgoingSequenceFlows} outgoing Sequence Flows. Only one is allowed.`}
      data-bs-toggle="tooltip"
    >
      <span>{props.outgoingSequenceFlows}</span>
    </div>
  );
}
