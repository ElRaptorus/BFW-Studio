import type { ProcessRelation, ProcessRelationKind } from '#modules/bpmn-landscape/buildProcessRelations';
import { buildRelationLines } from '#modules/bpmn-landscape/buildRelationLines';
import { describe, expect, it } from 'vitest';

function relation(
  kind: ProcessRelationKind,
  source: string,
  target: string,
  name: string | null = null,
): ProcessRelation {
  return {
    key: `${kind}:${source}:${target}${name == null ? '' : `:${name}`}`,
    kind,
    source: { uri: `file:///${source}.bpmn`, processId: source },
    target: { uri: `file:///${target}.bpmn`, processId: target },
    name,
    sourceFlowNodeIds: [],
    targetFlowNodeIds: [],
  };
}

const placed = (...processIds: string[]) =>
  processIds.map((processId) => ({
    elementId: `shape-${processId}`,
    reference: { uri: `file:///${processId}.bpmn`, processId },
  }));

const ALL_LAYERS = { callActivity: true, message: true, signal: true };

describe('buildRelationLines', () => {
  it('draws only relations whose two processes are placed and whose kind is switched on', () => {
    const lines = buildRelationLines({
      relations: [
        relation('callActivity', 'order', 'payment'),
        relation('callActivity', 'order', 'archive'),
        relation('signal', 'order', 'payment', 'Paid'),
      ],
      placedProcesses: placed('order', 'payment'),
      relationLayers: { ...ALL_LAYERS, signal: false },
      hiddenRelations: [],
    });

    expect(lines.map((line) => line.id)).toEqual(['relation:callActivity:shape-order:shape-payment']);
  });

  it('puts two message names between the same elements on one line, sorted by key', () => {
    const [line, ...others] = buildRelationLines({
      relations: [
        relation('message', 'order', 'billing', 'Invoice'),
        relation('message', 'order', 'billing', 'Credit'),
      ],
      placedProcesses: placed('order', 'billing'),
      relationLayers: ALL_LAYERS,
      hiddenRelations: [],
    });

    expect(others).toEqual([]);
    expect(line.kind).toBe('message');
    expect(line.sourceElementId).toBe('shape-order');
    expect(line.targetElementId).toBe('shape-billing');
    expect(line.relations.map((entry) => entry.name)).toEqual(['Credit', 'Invoice']);
  });

  it('keeps a partly hidden line with its hidden keys and drops a fully hidden one', () => {
    const lines = buildRelationLines({
      relations: [
        relation('message', 'order', 'billing', 'Invoice'),
        relation('message', 'order', 'billing', 'Credit'),
        relation('callActivity', 'order', 'billing'),
      ],
      placedProcesses: placed('order', 'billing'),
      relationLayers: ALL_LAYERS,
      hiddenRelations: ['message:order:billing:Invoice', 'callActivity:order:billing', 'signal:gone:away:X'],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('relation:message:shape-order:shape-billing');
    expect(lines[0].hiddenKeys).toEqual(['message:order:billing:Invoice']);
  });

  it('gives each direction between two processes its own line', () => {
    const lines = buildRelationLines({
      relations: [relation('message', 'order', 'billing', 'Invoice'), relation('message', 'billing', 'order', 'Paid')],
      placedProcesses: placed('order', 'billing'),
      relationLayers: ALL_LAYERS,
      hiddenRelations: [],
    });

    expect(lines.map((line) => line.id)).toEqual([
      'relation:message:shape-billing:shape-order',
      'relation:message:shape-order:shape-billing',
    ]);
  });
});
