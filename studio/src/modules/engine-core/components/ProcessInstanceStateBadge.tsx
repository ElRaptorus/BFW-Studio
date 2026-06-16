import type { ProcessInstanceState } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { getProcessInstanceStateName } from '../Formatters';

interface ProcessInstanceStateBadgeProps {
  state: ProcessInstanceState | string;
  className?: string;
}

export const ProcessInstanceStateBadge: React.FC<ProcessInstanceStateBadgeProps> = ({ state, className }) => {
  const label = getProcessInstanceStateName(state);
  const cssClass = `engine-state-badge engine-state-badge--${state}`;

  return (
    <span className={className ? `${cssClass} ${className}` : cssClass} title={label}>
      {label}
    </span>
  );
};
