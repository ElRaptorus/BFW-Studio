import { getHumanizedDateTime } from '#modules/engine-core';
import { AsyncParser } from '@json2csv/node';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import { getHumanReadableFlowNodeInstancePropertyName } from './formattersCompat';

export async function createCsvExportString(model: EngineBpmnDebuggerEditorDocumentModel): Promise<string> {
  const csvColumnHeaders = createCsvColumnHeaders();
  const csvReadyData = convertFlowNodeInstancesToCsvReadyData(model);

  const parser = new AsyncParser({
    delimiter: ';',
    fields: csvColumnHeaders,
  });

  return parser.parse(csvReadyData ?? []).promise();
}

function createCsvColumnHeaders(): { label: string; value: string }[] {
  return [
    { label: getHumanReadableFlowNodeInstancePropertyName('id'), value: 'id' },
    { label: getHumanReadableFlowNodeInstancePropertyName('flowNodeId'), value: 'flowNodeId' },
    { label: getHumanReadableFlowNodeInstancePropertyName('laneName'), value: 'laneName' },
    { label: getHumanReadableFlowNodeInstancePropertyName('flowNodeType'), value: 'flowNodeType' },
    { label: getHumanReadableFlowNodeInstancePropertyName('eventType'), value: 'eventType' },
    {
      label: getHumanReadableFlowNodeInstancePropertyName('previousFlowNodeInstanceIds'),
      value: 'previousFlowNodeInstanceIds',
    },
    { label: getHumanReadableFlowNodeInstancePropertyName('state'), value: 'state' },
    { label: getHumanReadableFlowNodeInstancePropertyName('processInstanceId'), value: 'processInstanceId' },
    { label: getHumanReadableFlowNodeInstancePropertyName('inputToken'), value: 'inputToken' },
    { label: getHumanReadableFlowNodeInstancePropertyName('outputToken'), value: 'outputToken' },
    { label: getHumanReadableFlowNodeInstancePropertyName('startedAt'), value: 'startedAt' },
    { label: getHumanReadableFlowNodeInstancePropertyName('finishedAt'), value: 'finishedAt' },
    { label: getHumanReadableFlowNodeInstancePropertyName('errorInfo'), value: 'errorInfo' },
    { label: 'Metadata', value: 'metadata' },
  ];
}

function convertFlowNodeInstancesToCsvReadyData(
  model: EngineBpmnDebuggerEditorDocumentModel,
): Record<string, unknown>[] {
  return model.flowNodeInstances.map((flowNodeInstance) => ({
    id: flowNodeInstance.id,
    flowNodeId: flowNodeInstance.flowNodeId,
    laneName: flowNodeInstance.laneName ?? '',
    flowNodeType: flowNodeInstance.flowNodeType,
    eventType: flowNodeInstance.eventType ?? '',
    previousFlowNodeInstanceIds: flowNodeInstance.previousFlowNodeInstanceIds.join(';'),
    state: flowNodeInstance.state,
    processInstanceId: flowNodeInstance.processInstanceId,
    inputToken: JSON.stringify(flowNodeInstance.inputToken ?? {}),
    outputToken: flowNodeInstance.outputToken ? JSON.stringify(flowNodeInstance.outputToken) : '--',
    startedAt: getHumanizedDateTime(flowNodeInstance.startedAt),
    finishedAt: flowNodeInstance.finishedAt ? getHumanizedDateTime(flowNodeInstance.finishedAt) : '--',
    errorInfo: flowNodeInstance.errorInfo ? JSON.stringify(flowNodeInstance.errorInfo) : '--',
    metadata: JSON.stringify(flowNodeInstance.typeProperties ?? {}),
  }));
}
