import React, { useState } from 'react';

export interface MultiInstanceCountOverlayProps {
  count: number;
  onConfirm: (newCount: number) => void;
}

export function MultiInstanceCountOverlay(props: MultiInstanceCountOverlayProps): React.ReactElement {
  const { count, onConfirm } = props;
  const [inputValue, setInputValue] = useState(String(count));

  const handleConfirm = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      onConfirm(parsed);
    }
  };

  return (
    <div className="token-sim-multi-instance-overlay">
      <div className="token-sim-gateway-choice__title">Iterations</div>
      <input
        className="token-sim-multi-instance-overlay__input"
        type="number"
        min={1}
        max={50}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleConfirm();
          }
        }}
        autoFocus
      />
      <button className="token-sim-gateway-choice__confirm" onClick={handleConfirm}>
        Set
      </button>
    </div>
  );
}
