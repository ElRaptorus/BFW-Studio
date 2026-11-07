import type {
  SolutionBpmnModelEntry,
  SolutionCommunicationEventEntry,
  SolutionProcessEntry,
} from '#modules/bpmn-core/scanSolutionBpmnModels';
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
    correlationKey: null,
    communicationEvents: [],
    ...references,
  };
}

function namedEvent(
  flowNodeId: string,
  kind: 'message' | 'signal',
  direction: 'throw' | 'catch',
  name: string | null,
): SolutionCommunicationEventEntry {
  return {
    flowNodeId,
    flowNodeName: null,
    kind,
    direction,
    position: direction === 'throw' ? 'intermediateThrow' : 'intermediateCatch',
    name,
    interrupting: null,
    attachedToId: null,
    attachedToName: null,
    location: [],
    correlationRetrievalExpression: null,
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
          communicationEvents: [
            namedEvent('Send_1', 'message', 'throw', 'OrderPlaced'),
            namedEvent('End_1', 'message', 'throw', 'OrderPlaced'),
          ],
        }),
        process('billing', {
          communicationEvents: [namedEvent('Start_1', 'message', 'catch', 'OrderPlaced')],
        }),
      ),
      file(
        'file:///stock.bpmn',
        process('stock', {
          communicationEvents: [namedEvent('Receive_1', 'message', 'catch', 'OrderPlaced')],
        }),
      ),
      file(
        'file:///other.bpmn',
        process('other', {
          communicationEvents: [namedEvent('Catch_1', 'message', 'catch', 'Unrelated')],
        }),
      ),
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
        process('alarm', {
          communicationEvents: [namedEvent('End_signal', 'signal', 'throw', 'Fire')],
        }),
        process('evacuate', {
          communicationEvents: [namedEvent('Start_signal', 'signal', 'catch', 'Fire')],
        }),
        process('listener', {
          communicationEvents: [namedEvent('Start_message', 'message', 'catch', 'Fire')],
        }),
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
          communicationEvents: [
            namedEvent('Throw', 'message', 'throw', 'Ping'),
            namedEvent('Catch', 'message', 'catch', 'Ping'),
          ],
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
        process('zeta', {
          communicationEvents: [namedEvent('Throw', 'signal', 'throw', 'Go')],
        }),
        process('alpha', {
          callActivities: [call('Call', 'zeta')],
          communicationEvents: [namedEvent('Catch', 'signal', 'catch', 'Go')],
        }),
      ),
    ]);

    expect(relations.map((relation) => relation.key)).toEqual(['callActivity:alpha:zeta', 'signal:zeta:alpha:Go']);
  });

  it('does not link an event whose name is null', () => {
    const relations = buildProcessRelations([
      file(
        'file:///a.bpmn',
        process('sender', { communicationEvents: [namedEvent('Throw', 'message', 'throw', null)] }),
        process('receiver', { communicationEvents: [namedEvent('Catch', 'message', 'catch', null)] }),
      ),
    ]);

    expect(relations).toEqual([]);
  });
});
