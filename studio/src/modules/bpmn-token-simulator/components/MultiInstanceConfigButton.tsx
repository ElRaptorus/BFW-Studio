import React, { useState } from 'react';

import { MultiInstanceCountOverlay } from './MultiInstanceCountOverlay';

export interface MultiInstanceConfigButtonProps {
  count: number;
  onChangeCount: (newCount: number) => void;
  badgeText?: React.ReactNode;
  description?: string;
  heading?: string;
  maximum?: number;
}

export function MultiInstanceConfigButton(props: MultiInstanceConfigButtonProps): React.ReactElement {
  const {
    count,
    onChangeCount,
    badgeText = `${count}x`,
    description = `Multi-instance: ${count} iterations`,
    heading,
    maximum,
  } = props;
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="token-sim-multi-instance-badge"
        onClick={() => setOpen(!open)}
        title={`${description} (click to change)`}
        aria-label={description}
      >
        {badgeText}
      </button>

      {open && (
        <MultiInstanceCountOverlay
          count={count}
          heading={heading}
          maximum={maximum}
          onConfirm={(newCount) => {
            onChangeCount(newCount);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
