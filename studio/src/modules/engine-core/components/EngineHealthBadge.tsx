import { Icon } from '#components/Icon';

import React from 'react';

import './EngineHealthBadge.scss';

export type EngineHealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

interface EngineHealthBadgeProps {
  healthState: EngineHealthState;
  /** Render as a half-sized inline badge suitable for breadcrumb placement. */
  inline?: boolean;
}

const HEALTH_CONFIG: Record<EngineHealthState, { icon: string; label: string }> = {
  healthy: { icon: 'ph ph-check-circle', label: 'Healthy' },
  degraded: { icon: 'ph ph-warning', label: 'Degraded' },
  critical: { icon: 'ph ph-warning-octagon', label: 'Critical' },
  unknown: { icon: 'ph ph-question', label: 'Unknown' },
};

export function EngineHealthBadge({ healthState, inline }: EngineHealthBadgeProps): React.JSX.Element {
  const config = HEALTH_CONFIG[healthState];
  const className = `engine-health-badge engine-health-badge--${healthState}${inline ? ' engine-health-badge--inline' : ''}`;
  return (
    <span className={className}>
      <Icon id={config.icon} />
      {config.label}
    </span>
  );
}

export function resolveHealthState(
  healthy: boolean | null,
  healthOverride?: 'elevated' | 'critical' | null,
): EngineHealthState {
  if (healthOverride === 'critical') {
    return 'critical';
  }
  if (healthOverride === 'elevated') {
    return 'degraded';
  }
  if (healthy === true) {
    return 'healthy';
  }
  if (healthy === false) {
    return 'degraded';
  }
  return 'unknown';
}
