import React, { useEffect, useRef } from 'react';

import type { SimulationLogEntry } from './SimulationToolbar';

export interface SimulationLogPanelProps {
  entries: SimulationLogEntry[];
  visible: boolean;
}

export function SimulationLogPanel(props: SimulationLogPanelProps): React.ReactElement | null {
  const { entries, visible } = props;
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visible, entries.length]);

  if (!visible) {
    return null;
  }

  return (
    <div className="token-sim-log-panel" ref={logRef}>
      {entries.length === 0 ? (
        <div className="token-sim-log-panel__empty">No events yet</div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="token-sim-log-entry">
            <span className="token-sim-log-entry__time">{entry.time}ms</span>
            <span className="token-sim-log-entry__event">{entry.event}</span>
            {' \u2014 '}
            <span className="token-sim-log-entry__name">
              {entry.elementName} ({entry.elementId})
            </span>
          </div>
        ))
      )}
    </div>
  );
}
