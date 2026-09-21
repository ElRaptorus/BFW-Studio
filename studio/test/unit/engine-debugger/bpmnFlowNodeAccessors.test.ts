import { describe, expect, it } from 'vitest';

import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';
import type { FlowNode } from '@elraptorus/bfw_engine_sdk';

import {
  getCallActivityCalledProcessVersion,
  getCorrelationRetrievalExpression,
  hasInputMappings,
  hasOutputMappings,
} from '../../../src/modules/engine-debugger/libs/BpmnFlowNodeAccessors';

function flowNode(type: FlowNodeType, typeData: FlowNode['typeData']): FlowNode {
  return {
    id: 'n',
    name: null,
    type,
    typeData,
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
}

describe('BpmnFlowNodeAccessors mapping visibility', () => {
  it('does not treat start events as mapping carriers', () => {
    const start = flowNode(FlowNodeType.StartEvent, {
      type: 'start_event',
      eventDefinition: {
        type: 'message',
        messageRef: 'M',
        correlationRetrievalExpression: null,
      },
      isInterrupting: true,
      resultContract: { type: 'object' },
    });

    expect(hasInputMappings(start)).toBe(false);
    expect(hasOutputMappings(start)).toBe(false);
  });

  it('matches Engine GraphQL mapping fields for throw, catch, send, receive, call, and subprocess', () => {
    const throwEvent = flowNode(FlowNodeType.IntermediateThrowEvent, {
      type: 'intermediate_throw_event',
      eventDefinition: {
        type: 'message',
        messageRef: 'M',
        correlationRetrievalExpression: 'token.orderId',
      },
      inMappings: [],
      payloadContract: null,
    });
    const catchEvent = flowNode(FlowNodeType.IntermediateCatchEvent, {
      type: 'intermediate_catch_event',
      eventDefinition: {
        type: 'message',
        messageRef: 'M',
        correlationRetrievalExpression: null,
      },
      outMappings: [],
      resultContract: null,
    });
    const sendTask = flowNode(FlowNodeType.SendTask, {
      type: 'send_task',
      messageRef: 'M',
      inMappings: [],
      outMappings: [],
      payloadContract: null,
    });
    const receiveTask = flowNode(FlowNodeType.ReceiveTask, {
      type: 'receive_task',
      messageRef: 'M',
      inMappings: [],
      outMappings: [],
      resultContract: null,
    });
    const callActivity = flowNode(FlowNodeType.CallActivity, {
      type: 'call_activity',
      calledElement: 'child',
      startEventId: null,
      calledProcessVersion: '1.2.0',
      inMappings: [],
      outMappings: [],
    });
    const subprocess = flowNode(FlowNodeType.SubProcess, {
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
      flowNodes: [],
      sequenceFlows: [],
      dataObjects: [],
      dataObjectReferences: [],
    });

    expect(hasInputMappings(throwEvent)).toBe(true);
    expect(hasOutputMappings(throwEvent)).toBe(false);
    expect(getCorrelationRetrievalExpression(throwEvent)).toBe('token.orderId');

    expect(hasInputMappings(catchEvent)).toBe(false);
    expect(hasOutputMappings(catchEvent)).toBe(true);

    expect(hasInputMappings(sendTask)).toBe(true);
    expect(hasOutputMappings(sendTask)).toBe(false);
    expect(getCorrelationRetrievalExpression(sendTask)).toBe('');

    expect(hasInputMappings(receiveTask)).toBe(false);
    expect(hasOutputMappings(receiveTask)).toBe(true);

    expect(hasInputMappings(callActivity)).toBe(true);
    expect(hasOutputMappings(callActivity)).toBe(true);
    expect(getCallActivityCalledProcessVersion(callActivity)).toBe('1.2.0');

    expect(hasInputMappings(subprocess)).toBe(true);
    expect(hasOutputMappings(subprocess)).toBe(true);
  });
});
