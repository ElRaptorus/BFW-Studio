import { describe, expect, it } from 'vitest';

import { convertGraphqlProcessModel } from '../../../src/modules/engine-core/bpmn/graphqlProcessModelToSdk';

describe('convertGraphqlProcessModel', () => {
  it('returns null for a missing or unidentifiable payload', () => {
    expect(convertGraphqlProcessModel(null)).toBeNull();
    expect(convertGraphqlProcessModel({})).toBeNull();
    expect(convertGraphqlProcessModel({ name: 'no-id' })).toBeNull();
  });

  it('maps GraphQL *Node fields onto SDK typeData including nested subprocesses', () => {
    const converted = convertGraphqlProcessModel(
      {
        id: 'order-process',
        name: 'Order',
        version: '1.0.0',
        isExecutable: true,
        isTransactionScope: false,
        isAdHocScope: false,
        correlationKey: 'token.orderId',
        definitionsId: 'Definitions_1',
        messages: [{ id: 'Message_payment', name: 'payment-received' }],
        signals: [],
        errors: [],
        escalations: [],
        sequenceFlows: [{ id: 'Flow_1', sourceRef: 'Start_1', targetRef: 'Task_http', isDefault: false }],
        lanes: [{ id: 'Lane_default', name: 'default', flowNodeRefs: ['Start_1', 'Task_http'] }],
        dataObjects: [],
        dataObjectReferences: [],
        associations: [],
        extensions: [],
        linterScores: [{ rulesetId: 'evil-default', scorePercent: '92.5', complianceStatus: 'compliant' }],
        flowNodes: [
          {
            id: 'Start_1',
            name: 'Order received',
            type: 'START_EVENT',
            incoming: [],
            outgoing: ['Flow_1'],
            boundaryEventRefs: [],
            isForCompensation: false,
            documentation: null,
            eventDefinition: {
              _Typename: 'MessageEventDefinition',
              messageRef: 'Message_payment',
            },
            isInterrupting: true,
          },
          {
            id: 'Task_http',
            name: 'Call API',
            type: 'service_task',
            incoming: ['Flow_1'],
            outgoing: [],
            boundaryEventRefs: [],
            isForCompensation: false,
            implementation: 'http',
            httpUrl: 'https://api.example.com/v1/echo',
            httpMethod: 'POST',
            httpBody: '{ "message": token.message }',
            inMappings: [{ source: 'token.orderId', target: 'orderId' }],
            outMappings: [],
          },
          {
            id: 'Sub_validate',
            name: 'Validate',
            type: 'SUB_PROCESS',
            incoming: [],
            outgoing: [],
            boundaryEventRefs: [],
            isForCompensation: false,
            isAdHoc: false,
            triggeredByEvent: false,
            isTransaction: false,
            cancelRemainingInstances: true,
            adhocOrdering: 'PARALLEL',
            sequenceFlows: [],
            dataObjects: [],
            dataObjectReferences: [],
            flowNodes: [
              {
                id: 'Inner_script',
                name: 'Inner',
                type: 'SCRIPT_TASK',
                incoming: [],
                outgoing: [],
                boundaryEventRefs: [],
                isForCompensation: false,
                scriptFormat: 'feel',
                script: '{ ok: true }',
              },
            ],
          },
        ],
      },
      '<xml/>',
    );

    expect(converted).not.toBeNull();
    const { process, definitions } = converted!;

    expect(process.id).toBe('order-process');
    expect(process.isExecutable).toBe(true);
    expect(process.correlationKey).toBe('token.orderId');
    expect(process.associations).toEqual([]);
    expect(definitions.rawXml).toBe('<xml/>');
    expect(definitions.messages).toEqual([{ id: 'Message_payment', name: 'payment-received' }]);
    expect(process.linterScores[0]?.rulesetId).toBe('evil-default');
    expect(process.linterScores[0]?.score).toBe(92.5);

    const start = process.flowNodes.find((node) => node.id === 'Start_1');
    expect(start?.typeData.type).toBe('start_event');
    if (start?.typeData.type === 'start_event') {
      expect(start.typeData.eventDefinition.type).toBe('message');
      if (start.typeData.eventDefinition.type === 'message') {
        expect(start.typeData.eventDefinition.messageRef).toBe('Message_payment');
      }
    }

    const httpTask = process.flowNodes.find((node) => node.id === 'Task_http');
    expect(httpTask?.typeData.type).toBe('service_task');
    if (httpTask?.typeData.type === 'service_task') {
      expect(httpTask.typeData.httpUrl).toBe('https://api.example.com/v1/echo');
      expect(httpTask.typeData.httpMethod).toBe('POST');
      expect(httpTask.typeData.inMappings).toEqual([{ source: 'token.orderId', target: 'orderId' }]);
    }

    const subprocess = process.flowNodes.find((node) => node.id === 'Sub_validate');
    expect(subprocess?.typeData.type).toBe('sub_process');
    if (subprocess?.typeData.type === 'sub_process') {
      expect(subprocess.typeData.flowNodes).toHaveLength(1);
      expect(subprocess.typeData.flowNodes[0]?.typeData.type).toBe('script_task');
    }
  });

  it('maps a BusinessRuleTask decisionRef without falling back to implementation', () => {
    const converted = convertGraphqlProcessModel({
      id: 'brt-process',
      isExecutable: true,
      flowNodes: [
        {
          id: 'BRT_1',
          type: 'BUSINESS_RULE_TASK',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          implementation: 'dmn',
          decisionRef: 'discount-rules',
          decisionElementId: 'Decision_Risk_Level',
          traceUnmatchedRules: true,
        },
      ],
    });

    const task = converted?.process.flowNodes[0];
    expect(task?.typeData.type).toBe('business_rule_task');
    if (task?.typeData.type === 'business_rule_task') {
      expect(task.typeData.decisionRef).toBe('discount-rules');
      expect(task.typeData.implementation).toBe('dmn');
      expect(task.typeData.traceUnmatchedRules).toBe(true);
    }
  });

  it('maps SendTask, UserTask, and throw-side message event definition fields', () => {
    const converted = convertGraphqlProcessModel({
      id: 'msg-process',
      isExecutable: true,
      flowNodes: [
        {
          id: 'Send_1',
          type: 'SEND_TASK',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          messageRef: 'Message_payment',
          payloadContract: { type: 'object' },
          inMappings: [{ source: 'token.orderId', target: 'orderId' }],
          outMappings: [{ source: 'result.status', target: 'status' }],
        },
        {
          id: 'User_1',
          type: 'USER_TASK',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          assigneesExpression: 'identity.groups',
          formSchema: { fields: [{ name: 'approved' }] },
          payloadContract: { type: 'object' },
          resultContract: { type: 'object' },
        },
        {
          id: 'Throw_1',
          type: 'INTERMEDIATE_THROW_EVENT',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          eventDefinition: {
            _Typename: 'MessageEventDefinition',
            messageRef: 'Message_payment',
            payloadExpression: '{ orderId: token.orderId }',
            correlationRetrievalExpression: 'token.orderId',
          },
          inMappings: [],
          payloadContract: { type: 'object' },
        },
        {
          id: 'Start_1',
          type: 'START_EVENT',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          eventDefinition: { _Typename: 'NoneEventDefinition', isNone: true },
          isInterrupting: true,
          resultContract: { type: 'object' },
        },
        {
          id: 'Call_1',
          type: 'CALL_ACTIVITY',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          calledElement: 'child-process',
          startEventId: 'Start_Express',
          inMappings: [],
          outMappings: [],
        },
        {
          id: 'Sub_1',
          type: 'SUB_PROCESS',
          incoming: [],
          outgoing: [],
          boundaryEventRefs: [],
          isForCompensation: false,
          isAdHoc: false,
          triggeredByEvent: false,
          isTransaction: false,
          cancelRemainingInstances: true,
          flowNodes: [],
          sequenceFlows: [],
          dataObjects: [],
          dataObjectReferences: [],
          payloadContract: { type: 'object' },
          resultContract: { type: 'object' },
        },
      ],
    });

    const byId = Object.fromEntries((converted?.process.flowNodes ?? []).map((node) => [node.id, node]));

    expect(byId.Send_1?.typeData.type).toBe('send_task');
    if (byId.Send_1?.typeData.type === 'send_task') {
      expect(byId.Send_1.typeData.messageRef).toBe('Message_payment');
      expect(byId.Send_1.typeData.payloadContract).toEqual({ type: 'object' });
      expect(byId.Send_1.typeData.outMappings).toEqual([{ source: 'result.status', target: 'status' }]);
    }

    expect(byId.User_1?.typeData.type).toBe('user_task');
    if (byId.User_1?.typeData.type === 'user_task') {
      expect(byId.User_1.typeData.assigneesExpression).toBe('identity.groups');
      expect(byId.User_1.typeData.formSchema).toEqual({ fields: [{ name: 'approved' }] });
    }

    expect(byId.Throw_1?.typeData.type).toBe('intermediate_throw_event');
    if (byId.Throw_1?.typeData.type === 'intermediate_throw_event') {
      expect(byId.Throw_1.typeData.eventDefinition.type).toBe('message');
      if (byId.Throw_1.typeData.eventDefinition.type === 'message') {
        expect(byId.Throw_1.typeData.eventDefinition.payloadExpression).toBe('{ orderId: token.orderId }');
        expect(byId.Throw_1.typeData.eventDefinition.correlationRetrievalExpression).toBe('token.orderId');
      }
    }

    expect(byId.Start_1?.typeData.type).toBe('start_event');
    if (byId.Start_1?.typeData.type === 'start_event') {
      expect(byId.Start_1.typeData.eventDefinition.type).toBe('none');
      expect(byId.Start_1.typeData.resultContract).toEqual({ type: 'object' });
      expect('inMappings' in byId.Start_1.typeData).toBe(false);
      expect('outMappings' in byId.Start_1.typeData).toBe(false);
    }

    expect(byId.Call_1?.typeData.type).toBe('call_activity');
    if (byId.Call_1?.typeData.type === 'call_activity') {
      expect(byId.Call_1.typeData.calledElement).toBe('child-process');
      expect('payloadContract' in byId.Call_1.typeData).toBe(false);
    }

    expect(byId.Sub_1?.typeData.type).toBe('sub_process');
    if (byId.Sub_1?.typeData.type === 'sub_process') {
      expect(byId.Sub_1.typeData.payloadContract).toEqual({ type: 'object' });
      expect(byId.Sub_1.typeData.resultContract).toEqual({ type: 'object' });
    }
  });
});
