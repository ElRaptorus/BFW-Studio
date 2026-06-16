import type { EventDefinitionType, FlowNodeType } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { resolveFlowNodeIconName } from '../FlowNodeIconResolver';

interface FlowNodeIconProps {
  flowNodeType: FlowNodeType;
  eventType?: EventDefinitionType | null;
  className?: string;
  size?: number;
}

export const FlowNodeIcon: React.FC<FlowNodeIconProps> = ({ flowNodeType, eventType, className, size = 16 }) => {
  const iconName = resolveFlowNodeIconName(flowNodeType, eventType);

  return (
    <span
      className={`${iconName}${className ? ` ${className}` : ''}`}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    />
  );
};
