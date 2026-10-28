import type { ProcessRelation, ProcessRelationKind } from '#modules/bpmn-landscape/buildProcessRelations';
import { buildRelationLines } from '#modules/bpmn-landscape/buildRelationLines';
import { findDuplicateConnectors } from '#modules/bpmn-landscape/findDuplicateConnectors';
import { describe, expect, it } from 'vitest';

function relation(kind: ProcessRelationKind, source: string, target: string, name: string | null = null) {
  return {
    key: `${kind}:${source}:${target}${name == null ? '' : `:${name}`}`,
    kind,
    source: { uri: `file:///${source}.bpmn`, processId: source },
    target: { uri: `file:///${target}.bpmn`, processId: target },
    name,
    sourceFlowNodeIds: [],
    targetFlowNodeIds: [],
  } satisfies ProcessRelation;
}

const placed = (...processIds: string[]) =>
  processIds.map((processId) => ({
    elementId: `shape-${processId}`,
    reference: { uri: `file:///${processId}.bpmn`, processId },
  }));

const connector = (id: string, sourceId: string, targetId: string) => ({ id, sourceId, targetId });

const lines = (relations: ProcessRelation[], hiddenRelations: string[] = []) =>
  buildRelationLines({
    relations,
    placedProcesses: placed('order', 'payment', 'archive'),
    relationLayers: { callActivity: true, message: true, signal: true },
    hiddenRelations,
  });

describe('findDuplicateConnectors', () => {
  it('finds the relation lines between the two shapes a connector joins, in either direction', () => {
    const result = findDuplicateConnectors(
      [connector('forward', 'shape-order', 'shape-payment'), connector('backward', 'shape-payment', 'shape-order')],
      lines([relation('callActivity', 'order', 'payment')]),
    );

    expect([...result.keys()]).toEqual(['forward', 'backward']);
    expect(result.get('forward')?.map((line) => line.id)).toEqual(['relation:callActivity:shape-order:shape-payment']);
  });

  it('returns every kind of relation between the pair, including the opposite direction', () => {
    const result = findDuplicateConnectors(
      [connector('link', 'shape-order', 'shape-payment')],
      lines([
        relation('callActivity', 'order', 'payment'),
        relation('message', 'payment', 'order', 'Paid'),
        relation('signal', 'order', 'payment', 'Go'),
      ]),
    );

    expect(result.get('link')).toHaveLength(3);
  });

  it('leaves out a connector between shapes without a relation line', () => {
    const result = findDuplicateConnectors(
      [connector('other', 'shape-order', 'shape-archive'), connector('free', 'note', 'shape-payment')],
      lines([relation('callActivity', 'order', 'payment')]),
    );

    expect(result.size).toBe(0);
  });

  it('does not warn when the only relation is hidden, because the line is not drawn', () => {
    const relations = [relation('callActivity', 'order', 'payment')];

    const result = findDuplicateConnectors(
      [connector('link', 'shape-order', 'shape-payment')],
      lines(relations, ['callActivity:order:payment']),
    );

    expect(result.size).toBe(0);
  });
});
