import React from 'react';

export type DmnSimulatorBadgeProps = {
  label: string;
  tone: 'value' | 'error';
  title: string;
};

export function DmnSimulatorBadge(props: DmnSimulatorBadgeProps): React.ReactElement {
  return (
    <span className={`dmn-sim-badge dmn-sim-badge--${props.tone}`} title={props.title}>
      {props.label}
    </span>
  );
}
