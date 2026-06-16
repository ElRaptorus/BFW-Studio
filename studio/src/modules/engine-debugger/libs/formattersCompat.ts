import { getShortId } from '#modules/engine-core';
import { getHumanizedDuration } from '#modules/engine-core/Formatters';

/** Local helper — not exported from engine-core Formatters. */
export function getHumanReadableFlowNodeInstancePropertyName(propertyName: string): string {
  const labels: Record<string, string> = {
    id: 'Flow Node Instance ID',
    flowNodeId: 'Flow Node ID',
    laneName: 'Flow Node Lane',
    flowNodeType: 'Flow Node Type',
    eventType: 'Event Type',
    previousFlowNodeInstanceIds: 'Previous Flow Node Instance IDs',
    state: 'State',
    processModelId: 'Process Model ID',
    processInstanceId: 'Process Instance ID',
    businessKey: 'Business Key',
    inputToken: 'Input Token',
    outputToken: 'Output Token',
    startedAt: 'Started At',
    finishedAt: 'Finished At',
    errorInfo: 'Error',
  };
  return labels[propertyName] ?? propertyName;
}

export function getShortMultiInstanceId(multiInstanceId: string | undefined | null): string {
  return getShortId(multiInstanceId ?? '');
}

export function getHumanizedDurationFromValue(milliseconds: number | undefined | null): string {
  return getHumanizedDuration(milliseconds);
}

export function getDurationMilliseconds(startedAt: string, finishedAt: string | null): number {
  const endTime = finishedAt != null ? new Date(finishedAt).getTime() : Date.now();
  return endTime - new Date(startedAt).getTime();
}
