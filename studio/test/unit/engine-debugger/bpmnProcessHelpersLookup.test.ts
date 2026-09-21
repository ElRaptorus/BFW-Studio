import { describe, expect, it } from 'vitest';

import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';
import type { BpmnProcess, FlowNode } from '@elraptorus/bfw_engine_sdk';

import {
  getAllFlowNodes,
  getFlowNodeById,
  getSequenceFlowById,
} from '../../../src/modules/engine-debugger/libs/BpmnProcessHelpers';

function makeProcess(): BpmnProcess {
  const inner: FlowNode = {
    id: 'Inner_1',
    name: 'Inner',
    type: FlowNodeType.Task,
    typeData: { type: 'task' },
    incoming: [],
    outgoing: [],
    boundaryEventRefs: [],
    dataContracts: [],
    dataInputAssociations: [],
    dataOutputAssociations: [],
    multiInstance: null,
    standardLoop: null,
    isForCompensation: false,
    documentation: null,
  };

  const subprocess: FlowNode = {
    id: 'Sub_1',
    name: 'Sub',
    type: FlowNodeType.SubProcess,
    typeData: {
      type: 'sub_process',
      triggeredByEvent: false,
      isTransaction: false,
      transactionMethod: null,
      isAdHoc: false,
      adhocOrdering: 'parallel',
      cancelRemainingInstances: true,
      adhocCompletionCondition: null,
      implementation: null,
      activeElementsExpression: null,
      inMappings: [],
      outMappings: [],
      payloadContract: null,
      resultContract: null,
      flowNodes: [inner],
      sequenceFlows: [
        {
          id: 'InnerFlow',
          name: null,
          sourceRef: 'Inner_1',
          targetRef: 'Inner_1',
          conditionExpression: null,
          isDefault: false,
        },
      ],
      dataObjects: [],
      dataObjectReferences: [],
    },
    incoming: ['Flow_1'],
    outgoing: [],
    boundaryEventRefs: [],
    dataContracts: [],
    dataInputAssociations: [],
    dataOutputAssociations: [],
    multiInstance: null,
    standardLoop: null,
    isForCompensation: false,
    documentation: null,
  };

  const start: FlowNode = {
    id: 'Start_1',
    name: 'Start',
    type: FlowNodeType.StartEvent,
    typeData: {
      type: 'start_event',
      eventDefinition: { type: 'none' },
      isInterrupting: true,
      resultContract: null,
    },
    incoming: [],
    outgoing: ['Flow_1'],
    boundaryEventRefs: [],
    dataContracts: [],
    dataInputAssociations: [],
    dataOutputAssociations: [],
    multiInstance: null,
    standardLoop: null,
    isForCompensation: false,
    documentation: null,
  };

  return {
    id: 'p',
    name: null,
    version: null,
    isExecutable: true,
    isTransactionScope: false,
    isAdHocScope: false,
    correlationKey: null,
    flowNodes: [start, subprocess],
    sequenceFlows: [
      {
        id: 'Flow_1',
        name: null,
        sourceRef: 'Start_1',
        targetRef: 'Sub_1',
        conditionExpression: null,
        isDefault: false,
      },
    ],
    lanes: [],
    dataObjects: [],
    dataObjectReferences: [],
    dataStores: [],
    dataStoreReferences: [],
    associations: [],
    extensions: [],
    linterScores: [],
  };
}

describe('BpmnProcessHelpers lookups', () => {
  it('finds nested flow nodes and sequence flows by id without re-walking', () => {
    const process = makeProcess();

    expect(getAllFlowNodes(process).map((node) => node.id)).toEqual(['Start_1', 'Sub_1', 'Inner_1']);
    expect(getFlowNodeById(process, 'Inner_1')?.name).toBe('Inner');
    expect(getSequenceFlowById(process, 'InnerFlow')?.sourceRef).toBe('Inner_1');
    expect(getSequenceFlowById(process, 'Flow_1')?.targetRef).toBe('Sub_1');
    expect(getFlowNodeById(process, 'missing')).toBeUndefined();

    expect(getAllFlowNodes(process)).toBe(getAllFlowNodes(process));
    expect(getFlowNodeById(process, 'Inner_1')).toBe(getFlowNodeById(process, 'Inner_1'));
  });
});
