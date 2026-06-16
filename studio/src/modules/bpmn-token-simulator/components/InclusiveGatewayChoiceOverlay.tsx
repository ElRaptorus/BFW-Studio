import React, { useCallback, useState } from 'react';

import { getFlowLabel } from './flowLabel';

export interface InclusiveGatewayChoiceOverlayProps {
  outgoingFlows: any[];
  onChoose: (flows: any[]) => void;
  initialSelected?: Set<string>;
}

export function InclusiveGatewayChoiceOverlay(props: InclusiveGatewayChoiceOverlayProps): React.ReactElement {
  const { outgoingFlows, onChoose, initialSelected } = props;
  const [selected, setSelected] = useState<Set<string>>(
    () => initialSelected ?? new Set(outgoingFlows.map((flow) => flow.id)),
  );

  const toggle = useCallback((flowId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) {
        if (next.size > 1) {
          next.delete(flowId);
        }
      } else {
        next.add(flowId);
      }
      return next;
    });
  }, []);

  const confirm = useCallback(() => {
    const chosen = outgoingFlows.filter((flow) => selected.has(flow.id));
    onChoose(chosen);
  }, [outgoingFlows, selected, onChoose]);

  return (
    <div className="token-sim-gateway-choice">
      <div className="token-sim-gateway-choice__title">Select paths</div>
      {outgoingFlows.map((flow, index) => (
        <label
          key={flow.id || index}
          className={`token-sim-gateway-choice__option token-sim-gateway-choice__option--checkbox ${selected.has(flow.id) ? 'token-sim-gateway-choice__option--selected' : ''}`}
        >
          <input type="checkbox" checked={selected.has(flow.id)} onChange={() => toggle(flow.id)} />
          {getFlowLabel(flow)}
        </label>
      ))}
      <button className="token-sim-gateway-choice__confirm" onClick={confirm}>
        Go
      </button>
    </div>
  );
}
