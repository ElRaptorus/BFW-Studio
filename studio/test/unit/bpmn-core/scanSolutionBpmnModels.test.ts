import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionCommunicationEventEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { installInlineBpmnModelScanWorker } from '../support/inlineBpmnModelScanWorker';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;
const scanWorker = installInlineBpmnModelScanWorker();

function createBifrost(fileNames: string[], overrides: Record<string, string> = {}): Bifrost {
  const uriFor = (file: string) => `${baseUri}/${file}`;
  return {
    solution: {
      listIncludedFileUris: async (pattern: RegExp) =>
        fileNames
          .filter((file) => pattern.test(file))
          .sort()
          .map(uriFor),
    },
    files: {
      load: async (uri: string) => {
        const file = uri.slice(baseUri.length + 1);
        return overrides[file] ?? fileSystem.readFile(path.join(fixtureDirectory, file), 'utf8');
      },
    },
  } as unknown as Bifrost;
}

const RELATIONS_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bfw="https://bifrostforge.world/schema/bpmn" id="Definitions_relations" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:message id="Message_order" name="OrderPlaced" />
  <bpmn:message id="Message_blank" name="  " />
  <bpmn:signal id="Signal_stock" name="StockLow" />
  <bpmn:error id="Error_failed" name="Failed" errorCode="FAILED" />
  <bpmn:process id="relations-process" name="Relations" isExecutable="true">
    <bpmn:extensionElements>
      <bfw:correlationKey>token.orderId</bfw:correlationKey>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start_interrupting" name="Start order" isInterrupting="true">
      <bpmn:messageEventDefinition messageRef="Message_order">
        <bpmn:extensionElements>
          <bfw:correlationRetrievalExpression>payload.orderId</bfw:correlationRetrievalExpression>
        </bpmn:extensionElements>
      </bpmn:messageEventDefinition>
    </bpmn:startEvent>
    <bpmn:startEvent id="Start_non_interrupting" isInterrupting="false">
      <bpmn:signalEventDefinition signalRef="Signal_stock" />
    </bpmn:startEvent>
    <bpmn:sendTask id="Send_order" name="Send order" messageRef="Message_order">
      <bpmn:extensionElements>
        <bfw:correlationRetrievalExpression>token.orderId</bfw:correlationRetrievalExpression>
      </bpmn:extensionElements>
    </bpmn:sendTask>
    <bpmn:receiveTask id="Receive_order" name="Receive order" messageRef="Message_order" />
    <bpmn:intermediateCatchEvent id="Catch_message" name="Catch order">
      <bpmn:messageEventDefinition messageRef="Message_order" />
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="Catch_signal">
      <bpmn:signalEventDefinition signalRef="Signal_stock" />
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateThrowEvent id="Throw_blank" name="Blank throw">
      <bpmn:messageEventDefinition messageRef="Message_blank" />
    </bpmn:intermediateThrowEvent>
    <bpmn:intermediateThrowEvent id="Throw_unknown">
      <bpmn:signalEventDefinition signalRef="Signal_missing" />
    </bpmn:intermediateThrowEvent>
    <bpmn:intermediateThrowEvent id="Throw_missing">
      <bpmn:messageEventDefinition />
    </bpmn:intermediateThrowEvent>
    <bpmn:boundaryEvent id="Boundary_interrupting" name="Interrupt" attachedToRef="Send_order" cancelActivity="true">
      <bpmn:messageEventDefinition messageRef="Message_order" />
    </bpmn:boundaryEvent>
    <bpmn:boundaryEvent id="Boundary_non_interrupting" attachedToRef="Send_order" cancelActivity="false">
      <bpmn:signalEventDefinition signalRef="Signal_stock" />
    </bpmn:boundaryEvent>
    <bpmn:intermediateCatchEvent id="Catch_timer" name="Wait">
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT1H</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="End_error">
      <bpmn:errorEventDefinition errorRef="Error_failed" />
    </bpmn:endEvent>
    <bpmn:subProcess id="Sub_outer" name="Outer">
      <bpmn:subProcess id="Sub_inner" name="Inner">
        <bpmn:intermediateThrowEvent id="Throw_nested" name="Nested throw">
          <bpmn:messageEventDefinition messageRef="Message_order" />
        </bpmn:intermediateThrowEvent>
      </bpmn:subProcess>
    </bpmn:subProcess>
    <bpmn:subProcess id="Sub_event" name="On cancel" triggeredByEvent="true">
      <bpmn:startEvent id="Start_event_subprocess" name="Cancel start" isInterrupting="true">
        <bpmn:messageEventDefinition messageRef="Message_order" />
      </bpmn:startEvent>
    </bpmn:subProcess>
    <bpmn:endEvent id="End_message" name="End order">
      <bpmn:messageEventDefinition messageRef="Message_order" />
    </bpmn:endEvent>
    <bpmn:endEvent id="End_signal">
      <bpmn:signalEventDefinition signalRef="Signal_stock" />
    </bpmn:endEvent>
    <bpmn:startEvent id="Start_none" />
  </bpmn:process>
  <bpmn:process id="plain-process" name="Plain" isExecutable="false">
    <bpmn:startEvent id="Start_plain" />
  </bpmn:process>
</bpmn:definitions>
`;

function communicationEvent(fields: {
  flowNodeId: string;
  flowNodeName?: string | null;
  kind: SolutionCommunicationEventEntry['kind'];
  direction: SolutionCommunicationEventEntry['direction'];
  position: SolutionCommunicationEventEntry['position'];
  name: string | null;
  interrupting?: boolean | null;
  attachedToId?: string | null;
  attachedToName?: string | null;
  location?: SolutionCommunicationEventEntry['location'];
  correlationRetrievalExpression?: string | null;
}): SolutionCommunicationEventEntry {
  return {
    flowNodeId: fields.flowNodeId,
    flowNodeName: fields.flowNodeName ?? null,
    kind: fields.kind,
    direction: fields.direction,
    position: fields.position,
    name: fields.name,
    interrupting: fields.interrupting ?? null,
    attachedToId: fields.attachedToId ?? null,
    attachedToName: fields.attachedToName ?? null,
    location: fields.location ?? [],
    correlationRetrievalExpression: fields.correlationRetrievalExpression ?? null,
  };
}

const sentFileUris = (): string[] => scanWorker.requests.flatMap((request) => request.files.map((file) => file.uri));

beforeEach(() => {
  scanWorker.behaviour.current = 'parse';
});

describe('scanSolutionBpmnModels', () => {
  it('lists the fixture processes sorted by URI, with references and stored scores', async () => {
    const fileNames = await fileSystem.readdir(fixtureDirectory);
    const entries = await scanSolutionBpmnModels(createBifrost(fileNames));

    expect(entries.map((entry) => entry.uri.slice(baseUri.length + 1))).toEqual([
      'draft-process.bpmn',
      'order-process.bpmn',
      'payment-process.bpmn',
      'unversioned-process.bpmn',
    ]);

    const [draft, order, payment, unversioned] = entries;
    expect(draft).toMatchObject({ kind: 'bpmn', processes: [{ id: 'draft-process', isExecutable: false }] });
    expect(unversioned).toMatchObject({ kind: 'bpmn', processes: [{ id: 'unversioned-process', version: null }] });
    if (payment.kind !== 'bpmn') {
      throw new Error('payment-process.bpmn must scan as BPMN');
    }
    expect(payment.storedLinterScores).toEqual([]);

    if (order.kind !== 'bpmn') {
      throw new Error('order-process.bpmn must scan as BPMN');
    }
    expect(order.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(order.processes[0].version).toBe('1.0.0');
    expect(order.processes[0].decisionRefs).toEqual(['discount-rules']);
    expect(order.processes[0].callActivities).toEqual(
      expect.arrayContaining([
        { id: 'Call_payment_latest', calledElement: 'payment-process', calledProcessVersion: null },
        { id: 'Call_payment_pinned', calledElement: 'payment-process', calledProcessVersion: '1.0.0' },
        { id: 'Call_archive_missing', calledElement: 'archive-process', calledProcessVersion: null },
      ]),
    );
    expect(order.storedLinterScores.map((score) => [score.rulesetId, score.scorePercent])).toEqual([
      ['bpmn-production-ready', '88.88888888888889'],
      ['bpmn-development', '100'],
    ]);
  });

  it('reports unparseable, empty and truncated files as invalid without stopping the scan', async () => {
    const paymentText = await fileSystem.readFile(path.join(fixtureDirectory, 'payment-process.bpmn'), 'utf8');
    const truncatedText = paymentText.slice(0, paymentText.indexOf('</bpmn:process>') + '</bpmn:process>'.length);
    const fileNames = [...(await fileSystem.readdir(fixtureDirectory)), 'broken.bpmn', 'empty.bpmn', 'truncated.bpmn'];
    const entries = await scanSolutionBpmnModels(
      createBifrost(fileNames, {
        'broken.bpmn': '<not-xml',
        'empty.bpmn': '',
        'truncated.bpmn': truncatedText,
      }),
    );

    for (const file of ['broken.bpmn', 'empty.bpmn', 'truncated.bpmn']) {
      expect(entries.find((entry) => entry.uri.endsWith(`/${file}`))?.kind, file).toBe('invalid');
    }
    expect(entries.filter((entry) => entry.kind !== 'invalid')).toHaveLength(4);
  });

  it('returns nothing when the solution lists no BPMN files', async () => {
    expect(await scanSolutionBpmnModels(createBifrost([]))).toEqual([]);
  });

  it('records every message and signal event, including unnamed ones and nested locations', async () => {
    const [entry] = await scanSolutionBpmnModels(
      createBifrost(['relations.bpmn'], { 'relations.bpmn': RELATIONS_BPMN }),
    );
    if (entry.kind !== 'bpmn') {
      throw new Error(`relations.bpmn must scan as BPMN: ${entry.error}`);
    }
    const [process, plain] = entry.processes;

    expect(process.correlationKey).toBe('token.orderId');
    expect(process.communicationEvents).toEqual([
      communicationEvent({
        flowNodeId: 'Start_interrupting',
        flowNodeName: 'Start order',
        kind: 'message',
        direction: 'catch',
        position: 'start',
        name: 'OrderPlaced',
        interrupting: true,
        correlationRetrievalExpression: 'payload.orderId',
      }),
      communicationEvent({
        flowNodeId: 'Start_non_interrupting',
        kind: 'signal',
        direction: 'catch',
        position: 'start',
        name: 'StockLow',
        interrupting: false,
      }),
      communicationEvent({
        flowNodeId: 'Send_order',
        flowNodeName: 'Send order',
        kind: 'message',
        direction: 'throw',
        position: 'sendTask',
        name: 'OrderPlaced',
        correlationRetrievalExpression: 'token.orderId',
      }),
      communicationEvent({
        flowNodeId: 'Receive_order',
        flowNodeName: 'Receive order',
        kind: 'message',
        direction: 'catch',
        position: 'receiveTask',
        name: 'OrderPlaced',
      }),
      communicationEvent({
        flowNodeId: 'Catch_message',
        flowNodeName: 'Catch order',
        kind: 'message',
        direction: 'catch',
        position: 'intermediateCatch',
        name: 'OrderPlaced',
      }),
      communicationEvent({
        flowNodeId: 'Catch_signal',
        kind: 'signal',
        direction: 'catch',
        position: 'intermediateCatch',
        name: 'StockLow',
      }),
      communicationEvent({
        flowNodeId: 'Throw_blank',
        flowNodeName: 'Blank throw',
        kind: 'message',
        direction: 'throw',
        position: 'intermediateThrow',
        name: null,
      }),
      communicationEvent({
        flowNodeId: 'Throw_unknown',
        kind: 'signal',
        direction: 'throw',
        position: 'intermediateThrow',
        name: null,
      }),
      communicationEvent({
        flowNodeId: 'Throw_missing',
        kind: 'message',
        direction: 'throw',
        position: 'intermediateThrow',
        name: null,
      }),
      communicationEvent({
        flowNodeId: 'Boundary_interrupting',
        flowNodeName: 'Interrupt',
        kind: 'message',
        direction: 'catch',
        position: 'boundary',
        name: 'OrderPlaced',
        interrupting: true,
        attachedToId: 'Send_order',
        attachedToName: 'Send order',
      }),
      communicationEvent({
        flowNodeId: 'Boundary_non_interrupting',
        kind: 'signal',
        direction: 'catch',
        position: 'boundary',
        name: 'StockLow',
        interrupting: false,
        attachedToId: 'Send_order',
        attachedToName: 'Send order',
      }),
      communicationEvent({
        flowNodeId: 'Throw_nested',
        flowNodeName: 'Nested throw',
        kind: 'message',
        direction: 'throw',
        position: 'intermediateThrow',
        name: 'OrderPlaced',
        location: [
          { id: 'Sub_outer', name: 'Outer', eventSubprocess: false },
          { id: 'Sub_inner', name: 'Inner', eventSubprocess: false },
        ],
      }),
      communicationEvent({
        flowNodeId: 'Start_event_subprocess',
        flowNodeName: 'Cancel start',
        kind: 'message',
        direction: 'catch',
        position: 'start',
        name: 'OrderPlaced',
        interrupting: true,
        location: [{ id: 'Sub_event', name: 'On cancel', eventSubprocess: true }],
      }),
      communicationEvent({
        flowNodeId: 'End_message',
        flowNodeName: 'End order',
        kind: 'message',
        direction: 'throw',
        position: 'end',
        name: 'OrderPlaced',
      }),
      communicationEvent({
        flowNodeId: 'End_signal',
        kind: 'signal',
        direction: 'throw',
        position: 'end',
        name: 'StockLow',
      }),
    ]);
    expect(plain).toMatchObject({ id: 'plain-process', correlationKey: null, communicationEvents: [] });
  });

  it('parses a file again only when its content changed, and forgets files that left the solution', async () => {
    const bifrostWith = (text: string) => createBifrost(['cached.bpmn'], { 'cached.bpmn': text });
    const cachedUri = `${baseUri}/cached.bpmn`;
    const changedText = RELATIONS_BPMN.replace('OrderPlaced', 'OrderChanged');

    await scanSolutionBpmnModels(bifrostWith(RELATIONS_BPMN));
    const sentBefore = sentFileUris().length;
    const unchanged = await scanSolutionBpmnModels(bifrostWith(RELATIONS_BPMN));
    expect(sentFileUris()).toHaveLength(sentBefore);
    expect(unchanged[0].kind).toBe('bpmn');

    await scanSolutionBpmnModels(bifrostWith(changedText));
    expect(sentFileUris().slice(sentBefore)).toEqual([cachedUri]);

    await scanSolutionBpmnModels(createBifrost([]));
    await scanSolutionBpmnModels(bifrostWith(changedText));
    expect(sentFileUris().slice(sentBefore)).toEqual([cachedUri, cachedUri]);
  });

  it('reports every file as invalid when the worker fails, and parses them again on the next scan', async () => {
    const bifrost = createBifrost(['failing.bpmn'], { 'failing.bpmn': RELATIONS_BPMN.replace('relations', 'failing') });
    scanWorker.behaviour.current = 'fail';
    const failed = await scanSolutionBpmnModels(bifrost);
    expect(failed).toEqual([
      { kind: 'invalid', uri: `${baseUri}/failing.bpmn`, error: 'The worker script could not be loaded.' },
    ]);

    scanWorker.behaviour.current = 'parse';
    const recovered = await scanSolutionBpmnModels(bifrost);
    expect(recovered[0].kind).toBe('bpmn');
  });
});
