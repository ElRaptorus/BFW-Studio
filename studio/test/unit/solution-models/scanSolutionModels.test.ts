import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import { onLoad } from '#modules/solution-models';
import { readStoredLinterScores, scanSolutionModels } from '#modules/solution-models/scanSolutionModels';
import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost } from '../support/recordingBifrost';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;

const solution = {
  name: 'fixture',
  baseUri,
  showHiddenFiles: false,
  projects: [
    {
      type: 'project',
      id: 'project-1',
      name: 'fixture',
      baseUri,
      files: { included: ['**/*.bpmn', '**/*.dmn'], excluded: [] },
    },
  ],
} as unknown as Solution;

function createFiles(overrides: Record<string, string> = {}): FileHandlingService {
  const uriFor = (file: string) => `${baseUri}/${file}`;
  return {
    traverseProject: async (_project: unknown, callback: (item: unknown) => Promise<unknown>) => {
      const names = [...(await fileSystem.readdir(fixtureDirectory)), ...Object.keys(overrides)];
      return Promise.all(names.map((file) => callback({ file, uri: uriFor(file), type: 'file' })));
    },
    load: async (uri: string) => {
      const file = uri.slice(baseUri.length + 1);
      return overrides[file] ?? fileSystem.readFile(path.join(fixtureDirectory, file), 'utf8');
    },
  } as unknown as FileHandlingService;
}

describe('scanSolutionModels', () => {
  it('lists the fixture models sorted by URI with processes, references and the DMN id', async () => {
    const entries = await scanSolutionModels(solution, createFiles());

    expect(entries.map((entry) => entry.uri.slice(baseUri.length + 1))).toEqual([
      'discount-rules.dmn',
      'draft-process.bpmn',
      'order-process.bpmn',
      'payment-process.bpmn',
      'unversioned-process.bpmn',
    ]);

    const [decision, draft, order, , unversioned] = entries;
    expect(decision).toMatchObject({ kind: 'dmn', definitionsId: 'discount-rules' });
    if (decision.kind !== 'dmn') {
      throw new Error('discount-rules.dmn must scan as DMN');
    }
    expect(decision.elements.decisions.length).toBeGreaterThan(0);
    expect(decision.namespace).toEqual(expect.any(String));
    expect(draft).toMatchObject({ kind: 'bpmn', processes: [{ id: 'draft-process', isExecutable: false }] });
    expect(unversioned).toMatchObject({ kind: 'bpmn', processes: [{ id: 'unversioned-process', version: null }] });

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

  it('reports unparseable, empty, non-model and truncated files as invalid without stopping the scan', async () => {
    const paymentText = await fileSystem.readFile(path.join(fixtureDirectory, 'payment-process.bpmn'), 'utf8');
    const truncatedText = paymentText.slice(0, paymentText.indexOf('</bpmn:process>') + '</bpmn:process>'.length);
    const overrides = {
      'broken.bpmn': '<not-xml',
      'empty.bpmn': '',
      'plain.dmn': 'hello',
      'truncated.bpmn': truncatedText,
    };

    const entries = await scanSolutionModels(solution, createFiles(overrides));

    for (const file of Object.keys(overrides)) {
      expect(entries.find((entry) => entry.uri.endsWith(`/${file}`))?.kind, file).toBe('invalid');
    }
    expect(entries.filter((entry) => entry.kind !== 'invalid')).toHaveLength(5);
  });

  it('skips files the solution does not include', async () => {
    const restricted = {
      ...solution,
      projects: [{ ...solution.projects[0], files: { included: ['**/*.dmn'], excluded: [] } }],
    } as Solution;

    const entries = await scanSolutionModels(restricted, createFiles());

    expect(entries.map((entry) => entry.kind)).toEqual(['dmn']);
  });
});

describe('readStoredLinterScores', () => {
  it('returns nothing when the file stores no score', () => {
    expect(readStoredLinterScores('<bpmn:definitions />')).toEqual([]);
  });
});

describe('solution.models commands', () => {
  async function setup(openSolution: Solution | null) {
    const { bifrost } = createRecordingBifrost();
    Object.assign(bifrost, { solution: { getSolution: () => openSolution }, files: createFiles() });
    await onLoad(bifrost);
    return bifrost;
  }

  it('finds the file that defines a process, or null for an unknown process', async () => {
    const bifrost = await setup(solution);

    expect(await bifrost.commands.executeCommand('solution.models.findProcessFile', ['payment-process'])).toBe(
      `${baseUri}/payment-process.bpmn`,
    );
    expect(await bifrost.commands.executeCommand('solution.models.findProcessFile', ['archive-process'])).toBeNull();
  });

  it('finds the file that defines a decision, or null for an unknown decision', async () => {
    const bifrost = await setup(solution);

    expect(await bifrost.commands.executeCommand('solution.models.findDecisionFile', ['discount-rules'])).toBe(
      `${baseUri}/discount-rules.dmn`,
    );
    expect(await bifrost.commands.executeCommand('solution.models.findDecisionFile', ['unknown'])).toBeNull();
  });

  it('scans nothing without an open solution', async () => {
    const bifrost = await setup(null);

    expect(await bifrost.commands.executeCommand('solution.models.scan')).toEqual([]);
  });
});
