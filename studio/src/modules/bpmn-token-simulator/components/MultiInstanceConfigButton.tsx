import React, { useState } from 'react';

import { MultiInstanceCountOverlay } from './MultiInstanceCountOverlay';

export interface MultiInstanceConfigButtonProps {
  count: number;
  onChangeCount: (newCount: number) => void;
}

export function MultiInstanceConfigButton(props: MultiInstanceConfigButtonProps): React.ReactElement {
  const { count, onChangeCount } = props;
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="token-sim-multi-instance-badge"
        onClick={() => setOpen(!open)}
        title={`Multi-instance: ${count} iterations (click to change)`}
        aria-label={`Multi-instance: ${count} iterations`}
      >
        {count}x
      </button>

      {open && (
        <MultiInstanceCountOverlay
          count={count}
          onConfirm={(newCount) => {
            onChangeCount(newCount);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
