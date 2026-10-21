import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionEventNameEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
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
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_relations" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:message id="Message_order" name="OrderPlaced" />
  <bpmn:message id="Message_blank" name="  " />
  <bpmn:signal id="Signal_stock" name="StockLow" />
  <bpmn:process id="relations-process" isExecutable="true">
    <bpmn:startEvent id="Start_message"><bpmn:messageEventDefinition messageRef="Message_order" /></bpmn:startEvent>
    <bpmn:sendTask id="Send_order" messageRef="Message_order" />
    <bpmn:intermediateThrowEvent id="Throw_blank"><bpmn:messageEventDefinition messageRef="Message_blank" /></bpmn:intermediateThrowEvent>
    <bpmn:intermediateThrowEvent id="Throw_unknown"><bpmn:messageEventDefinition messageRef="Message_missing" /></bpmn:intermediateThrowEvent>
    <bpmn:boundaryEvent id="Boundary_message" attachedToRef="Send_order"><bpmn:messageEventDefinition messageRef="Message_order" /></bpmn:boundaryEvent>
    <bpmn:subProcess id="Sub_nested">
      <bpmn:receiveTask id="Receive_nested" messageRef="Message_order" />
      <bpmn:intermediateCatchEvent id="Catch_signal"><bpmn:signalEventDefinition signalRef="Signal_stock" /></bpmn:intermediateCatchEvent>
    </bpmn:subProcess>
    <bpmn:endEvent id="End_message"><bpmn:messageEventDefinition messageRef="Message_order" /></bpmn:endEvent>
    <bpmn:endEvent id="End_signal"><bpmn:signalEventDefinition signalRef="Signal_stock" /></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>
`;

const flowNodeIdsOf = (entries: SolutionEventNameEntry[]): string[] =>
  entries.map((entry) => `${entry.flowNodeId}=${entry.name}`).sort();
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

  it('lists thrown and caught message and signal names, nested ones included, without blank or unknown names', async () => {
    const [entry] = await scanSolutionBpmnModels(
      createBifrost(['relations.bpmn'], { 'relations.bpmn': RELATIONS_BPMN }),
    );
    if (entry.kind !== 'bpmn') {
      throw new Error(`relations.bpmn must scan as BPMN: ${entry.error}`);
    }
    const [process] = entry.processes;

    expect(flowNodeIdsOf(process.thrownMessages)).toEqual(['End_message=OrderPlaced', 'Send_order=OrderPlaced']);
    expect(flowNodeIdsOf(process.caughtMessages)).toEqual([
      'Boundary_message=OrderPlaced',
      'Receive_nested=OrderPlaced',
      'Start_message=OrderPlaced',
    ]);
    expect(flowNodeIdsOf(process.thrownSignals)).toEqual(['End_signal=StockLow']);
    expect(flowNodeIdsOf(process.caughtSignals)).toEqual(['Catch_signal=StockLow']);
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
