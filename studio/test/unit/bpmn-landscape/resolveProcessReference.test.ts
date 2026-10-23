import type { SolutionBpmnModelEntry, SolutionProcessEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { replaceCandidates, resolveProcessReference } from '#modules/bpmn-landscape/resolveProcessReference';
import { describe, expect, it } from 'vitest';

const MAP_URI = 'file:///work/landscapes/Overview.bfwmap';

function process(id: string): SolutionProcessEntry {
  return {
    id,
    name: null,
    version: '1',
    isExecutable: true,
    callActivities: [],
    decisionRefs: [],
    thrownMessages: [],
    caughtMessages: [],
    thrownSignals: [],
    caughtSignals: [],
  };
}

function file(uri: string, ...processes: SolutionProcessEntry[]): SolutionBpmnModelEntry {
  return { kind: 'bpmn', uri, sha256: 'hash', processes, storedLinterScores: [] };
}

describe('resolveProcessReference', () => {
  it('resolves an id that one file defines, even when the hint is stale after a move', () => {
    const catalog = [file('file:///work/billing/order.bpmn', process('order'))];

    const resolution = resolveProcessReference(catalog, MAP_URI, { processId: 'order', fileHint: '../old/order.bpmn' });

    expect(resolution).toMatchObject({ status: 'resolved', uri: 'file:///work/billing/order.bpmn' });
  });

  it('tells apart files with the same process id by the hint', () => {
    const catalog = [
      file('file:///work/a/order.bpmn', process('order')),
      file('file:///work/b/order.bpmn', process('order')),
    ];

    const resolution = resolveProcessReference(catalog, MAP_URI, { processId: 'order', fileHint: '../b/order.bpmn' });

    expect(resolution).toMatchObject({ status: 'resolved', uri: 'file:///work/b/order.bpmn' });
  });

  it('is ambiguous when several files define the id and the hint matches none, never the first file', () => {
    const catalog = [
      file('file:///work/a/order.bpmn', process('order')),
      file('file:///work/b/order.bpmn', process('order')),
    ];

    const resolution = resolveProcessReference(catalog, MAP_URI, { processId: 'order', fileHint: null });

    expect(resolution.status).toBe('ambiguous');
    expect(resolution.status === 'ambiguous' && resolution.candidates.map((candidate) => candidate.uri)).toEqual([
      'file:///work/a/order.bpmn',
      'file:///work/b/order.bpmn',
    ]);
  });

  it('is missing when no file defines the id, and ignores files that are not valid BPMN', () => {
    const catalog: SolutionBpmnModelEntry[] = [
      { kind: 'invalid', uri: 'file:///work/broken.bpmn', error: 'not xml' },
      file('file:///work/other.bpmn', process('other')),
    ];

    expect(resolveProcessReference(catalog, MAP_URI, { processId: 'order', fileHint: null })).toEqual({
      status: 'missing',
    });
  });
});

describe('replaceCandidates', () => {
  it('offers every process whose id is not on the map yet', () => {
    const catalog: SolutionBpmnModelEntry[] = [
      file('file:///work/a.bpmn', process('order'), process('payment')),
      { kind: 'invalid', uri: 'file:///work/broken.bpmn', error: 'not xml' },
      file('file:///work/b.bpmn', process('shipping')),
    ];

    const candidates = replaceCandidates(catalog, ['order']);

    expect(candidates.map((candidate) => candidate.process.id)).toEqual(['payment', 'shipping']);
  });

  it('offers nothing when the map shows every process', () => {
    expect(replaceCandidates([file('file:///work/a.bpmn', process('order'))], ['order'])).toEqual([]);
  });
});
