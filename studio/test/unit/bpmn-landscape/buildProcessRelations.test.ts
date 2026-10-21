import type { SolutionBpmnModelEntry, SolutionProcessEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { buildProcessRelations } from '#modules/bpmn-landscape/buildProcessRelations';
import { describe, expect, it } from 'vitest';

function process(id: string, references: Partial<SolutionProcessEntry> = {}): SolutionProcessEntry {
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
    ...references,
  };
}

function file(uri: string, ...processes: SolutionProcessEntry[]): SolutionBpmnModelEntry {
  return { kind: 'bpmn', uri, sha256: 'hash', processes, storedLinterScores: [] };
}

const call = (id: string, calledElement: string | null) => ({ id, calledElement, calledProcessVersion: null });

describe('buildProcessRelations', () => {
  it('links a call activity to the called process, one relation per process pair', () => {
    const relations = buildProcessRelations([
      file(
        'file:///order.bpmn',
        process('order', {
          callActivities: [call('Call_a', 'payment'), call('Call_b', 'payment'), call('Call_x', null)],
        }),
      ),
      file('file:///payment.bpmn', process('payment')),
    ]);

    expect(relations).toEqual([
      {
        key: 'callActivity:order:payment',
        kind: 'callActivity',
        source: { uri: 'file:///order.bpmn', processId: 'order' },
        target: { uri: 'file:///payment.bpmn', processId: 'payment' },
        name: null,
        sourceFlowNodeIds: ['Call_a', 'Call_b'],
        targetFlowNodeIds: [],
      },
    ]);
  });

  it('links a call activity to every file that defines the called id, and ignores unknown targets', () => {
    const relations = buildProcessRelations([
      file(
        'file:///a.bpmn',
        process('caller', { callActivities: [call('Call_1', 'shared'), call('Call_2', 'ghost')] }),
      ),
      file('file:///b.bpmn', process('shared')),
      file('file:///c.bpmn', process('shared')),
    ]);

    expect(relations.map((relation) => relation.target.uri)).toEqual(['file:///b.bpmn', 'file:///c.bpmn']);
  });

  it('links a thrown message name to every other process that catches it, named and directed', () => {
    const relations = buildProcessRelations([
      file(
        'file:///sales.bpmn',
        process('sales', {
          thrownMessages: [
            { flowNodeId: 'Send_1', name: 'OrderPlaced' },
            { flowNodeId: 'End_1', name: 'OrderPlaced' },
          ],
        }),
        process('billing', { caughtMessages: [{ flowNodeId: 'Start_1', name: 'OrderPlaced' }] }),
      ),
      file(
        'file:///stock.bpmn',
        process('stock', { caughtMessages: [{ flowNodeId: 'Receive_1', name: 'OrderPlaced' }] }),
      ),
      file('file:///other.bpmn', process('other', { caughtMessages: [{ flowNodeId: 'Catch_1', name: 'Unrelated' }] })),
    ]);

    expect(relations.map((relation) => [relation.key, relation.sourceFlowNodeIds, relation.targetFlowNodeIds])).toEqual(
      [
        ['message:sales:billing:OrderPlaced', ['Send_1', 'End_1'], ['Start_1']],
        ['message:sales:stock:OrderPlaced', ['Send_1', 'End_1'], ['Receive_1']],
      ],
    );
  });

  it('links signals by name and keeps messages and signals of the same name apart', () => {
    const relations = buildProcessRelations([
      file(
        'file:///a.bpmn',
        process('alarm', { thrownSignals: [{ flowNodeId: 'End_signal', name: 'Fire' }] }),
        process('evacuate', { caughtSignals: [{ flowNodeId: 'Start_signal', name: 'Fire' }] }),
        process('listener', { caughtMessages: [{ flowNodeId: 'Start_message', name: 'Fire' }] }),
      ),
    ]);

    expect(relations.map((relation) => relation.key)).toEqual(['signal:alarm:evacuate:Fire']);
  });

  it('leaves out relations of a process with itself and skips invalid files', () => {
    const relations = buildProcessRelations([
      file(
        'file:///loop.bpmn',
        process('loop', {
          callActivities: [call('Call_self', 'loop')],
          thrownMessages: [{ flowNodeId: 'Throw', name: 'Ping' }],
          caughtMessages: [{ flowNodeId: 'Catch', name: 'Ping' }],
        }),
      ),
      { kind: 'invalid', uri: 'file:///broken.bpmn', error: 'Not BPMN.' },
    ]);

    expect(relations).toEqual([]);
  });

  it('sorts relations by key', () => {
    const relations = buildProcessRelations([
      file(
        'file:///a.bpmn',
        process('zeta', { thrownSignals: [{ flowNodeId: 'Throw', name: 'Go' }] }),
        process('alpha', {
          callActivities: [call('Call', 'zeta')],
          caughtSignals: [{ flowNodeId: 'Catch', name: 'Go' }],
        }),
      ),
    ]);

    expect(relations.map((relation) => relation.key)).toEqual(['callActivity:alpha:zeta', 'signal:zeta:alpha:Go']);
  });
});
