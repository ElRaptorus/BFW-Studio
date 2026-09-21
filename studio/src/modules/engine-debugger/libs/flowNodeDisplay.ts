import { resolveFlowNodeIconName } from '#modules/engine-core';
import { getFlowNodeTypeText } from '#modules/engine-core/Formatters';

import type { EventDefinitionType, FlowNodeType } from '@elraptorus/bfw_engine_sdk';

export function resolveFlowNodeIconForDebugger(flowNodeType: string, eventType?: string | null): string {
  return resolveFlowNodeIconName(
    flowNodeType as FlowNodeType,
    (eventType ?? undefined) as EventDefinitionType | undefined,
  );
}

export function getFlowNodeTypeLabelForDebugger(flowNodeType: string): string {
  return getFlowNodeTypeText(flowNodeType as FlowNodeType);
}
