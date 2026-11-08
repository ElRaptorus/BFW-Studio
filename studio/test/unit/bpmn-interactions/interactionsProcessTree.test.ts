import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import {
  buildInteractionsProcessTree,
  collectFilteredProcessReferences,
  listedProcessesCheckboxState,
} from '#modules/bpmn-interactions/interactionsProcessTree';
import { describe, expect, it } from 'vitest';

function bpmnEntry(uri: string, processIds: string[]): SolutionBpmnModelEntry {
  return {
    kind: 'bpmn',
    uri,
    sha256: 'hash',
    processes: processIds.map((processId) => ({
      id: processId,
      name: processId,
      version: '1',
      isExecutable: true,
      correlationKey: null,
      callActivities: [],
      decisionRefs: [],
      communicationEvents: [],
    })),
    storedLinterScores: [],
  };
}

describe('interactionsProcessTree', () => {
  it('filters processes by name and expands matching files', () => {
    const entries = [bpmnEntry('file:///orders.bpmn', ['OrderProcess']), bpmnEntry('file:///other.bpmn', ['Other'])];
    const tree = buildInteractionsProcessTree(entries, 'order', () => false);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('orders.bpmn');
    expect(tree[0]?.expanded).toBe(true);
    expect(tree[0]?.entries).toHaveLength(1);
    expect(tree[0]?.entries?.[0]?.label).toBe('OrderProcess');
  });

  it('marks listed processes as checked, mixed or unchecked', () => {
    const references = [
      { uri: 'file:///mixed.bpmn', processId: 'First' },
      { uri: 'file:///mixed.bpmn', processId: 'Second' },
    ];
    expect(listedProcessesCheckboxState(references, (reference) => reference.processId === 'First')).toBe('mixed');
    expect(listedProcessesCheckboxState(references, () => true)).toBe('checked');
    expect(listedProcessesCheckboxState(references, () => false)).toBe('unchecked');
    expect(listedProcessesCheckboxState([], () => true)).toBe('unchecked');
  });

  it('sets tri-state checkboxes for file and process rows', () => {
    const entries = [bpmnEntry('file:///mixed.bpmn', ['First', 'Second'])];
    const isSelected = (reference: { processId: string }) => reference.processId === 'First';
    const tree = buildInteractionsProcessTree(entries, '', isSelected);
    expect(tree[0]?.checkboxState).toBe('mixed');
    expect(tree[0]?.entries?.map((process) => process.checkboxState)).toEqual(['checked', 'unchecked']);
  });

  it('derives the file checkbox from the processes the filter shows', () => {
    const entries = [bpmnEntry('file:///mixed.bpmn', ['First', 'Second'])];
    const tree = buildInteractionsProcessTree(entries, 'first', (reference) => reference.processId === 'First');
    expect(tree[0]?.entries).toHaveLength(1);
    expect(tree[0]?.checkboxState).toBe('checked');
  });

  it('collects every process row visible under the current filter', () => {
    const entries = [bpmnEntry('file:///orders.bpmn', ['OrderProcess']), bpmnEntry('file:///other.bpmn', ['Other'])];
    expect(collectFilteredProcessReferences(entries, '')).toHaveLength(2);
    expect(collectFilteredProcessReferences(entries, 'order')).toEqual([
      { uri: 'file:///orders.bpmn', processId: 'OrderProcess' },
    ]);
  });

  it('omits a checkbox on invalid file rows', () => {
    const entries: SolutionBpmnModelEntry[] = [{ kind: 'invalid', uri: 'file:///broken.bpmn', error: 'parse error' }];
    const tree = buildInteractionsProcessTree(entries, '', () => false);
    expect(tree[0]?.checkboxState).toBeUndefined();
  });
});
