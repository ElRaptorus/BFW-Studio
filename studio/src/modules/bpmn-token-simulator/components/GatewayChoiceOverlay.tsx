import React from 'react';

import { getFlowLabel } from './flowLabel';

export interface GatewayChoiceOverlayProps {
  outgoingFlows: any[];
  onChoose: (flow: any) => void;
  initialSelectedId?: string;
}

export function GatewayChoiceOverlay(props: GatewayChoiceOverlayProps): React.ReactElement {
  const { outgoingFlows, onChoose, initialSelectedId } = props;

  return (
    <div className="token-sim-gateway-choice">
      <div className="token-sim-gateway-choice__title">Choose path</div>
      {outgoingFlows.map((flow, index) => (
        <button
          key={flow.id || index}
          className={`token-sim-gateway-choice__option ${flow.id === initialSelectedId ? 'token-sim-gateway-choice__option--selected' : ''}`}
          onClick={() => onChoose(flow)}
          title={getFlowLabel(flow)}
        >
          {getFlowLabel(flow)}
        </button>
      ))}
    </div>
  );
}
