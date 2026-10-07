import type { Bifrost } from '#bifrost/Bifrost';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;

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
});
