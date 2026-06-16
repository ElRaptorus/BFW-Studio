import React from 'react';

export interface BoundaryEventCheckboxProps {
  enabled: boolean;
  interrupting: boolean;
  onToggle: () => void;
}

export function BoundaryEventCheckbox(props: BoundaryEventCheckboxProps): React.ReactElement {
  const { enabled, interrupting, onToggle } = props;
  const variant = interrupting ? 'interrupting' : 'non-interrupting';
  const className = `token-sim-boundary-checkbox token-sim-boundary-checkbox--${variant} ${enabled ? 'token-sim-boundary-checkbox--enabled' : ''}`;
  const label = enabled ? 'Disable boundary event trigger' : 'Enable boundary event trigger';

  return (
    <button className={className} onClick={onToggle} title={label} aria-label={label} aria-pressed={enabled}>
      {enabled && <i className="ph-bold ph-check" />}
    </button>
  );
}
