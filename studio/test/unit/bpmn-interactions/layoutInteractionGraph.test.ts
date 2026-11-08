import type {
  SolutionBpmnModelEntry,
  SolutionCommunicationEventEntry,
  SolutionProcessEntry,
} from '#modules/bpmn-core/scanSolutionBpmnModels';
import { buildInteractionGraph, type InteractionGraph } from '#modules/bpmn-interactions/buildInteractionGraph';
import { INTERACTION_PROCESS_WIDTH, layoutInteractionGraph } from '#modules/bpmn-interactions/layoutInteractionGraph';
import ElkBundled from 'elkjs/lib/elk.bundled.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('elkjs/lib/elk-api', async () => {
  const ElkInProcess = (await import('elkjs/lib/elk.bundled.js')).default;
  return {
    default: class extends ElkInProcess {
      constructor({ workerUrl }: { workerUrl?: string }) {
        super({ workerUrl });
      }
    },
  };
});

function process(id: string, events: SolutionCommunicationEventEntry[]): SolutionProcessEntry {
  return {
    id,
    name: id,
    version: '1',
    isExecutable: true,
    callActivities: [],
    decisionRefs: [],
    correlationKey: null,
    communicationEvents: events,
  };
}

function messageEvent(flowNodeId: string, direction: 'throw' | 'catch', name: string): SolutionCommunicationEventEntry {
  return {
    flowNodeId,
    flowNodeName: null,
    kind: 'message',
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

function catalog(): SolutionBpmnModelEntry[] {
  return [
    {
      kind: 'bpmn',
      uri: 'file:///sender.bpmn',
      sha256: '1',
      processes: [process('sender', [messageEvent('Throw_1', 'throw', 'Evt')])],
      storedLinterScores: [],
    },
    {
      kind: 'bpmn',
      uri: 'file:///receiver.bpmn',
      sha256: '2',
      processes: [process('receiver', [messageEvent('Catch_1', 'catch', 'Evt')])],
      storedLinterScores: [],
    },
  ];
}

function sampleGraph(layout: 'direct' | 'stations'): InteractionGraph {
  return buildInteractionGraph(
    catalog(),
    [
      { uri: 'file:///sender.bpmn', processId: 'sender' },
      { uri: 'file:///receiver.bpmn', processId: 'receiver' },
    ],
    { layout, hideProcessesWithoutInteraction: false },
  );
}

describe('layoutInteractionGraph', () => {
  beforeAll(() => {
    vi.stubGlobal('document', { baseURI: 'file:///studio/electron-renderer.html' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('places catch ports on the west side and throw ports on the east side of each process', async () => {
    const graph = sampleGraph('direct');
    const layout = await layoutInteractionGraph(graph, 'direct');

    const senderProcess = graph.processes.find((entry) => entry.processId === 'sender');
    const receiverProcess = graph.processes.find((entry) => entry.processId === 'receiver');
    expect(senderProcess).toBeDefined();
    expect(receiverProcess).toBeDefined();

    const senderBounds = layout.processes.get(senderProcess!.id)!;
    const receiverBounds = layout.processes.get(receiverProcess!.id)!;
    const throwPort = graph.ports.find((port) => port.direction === 'throw')!;
    const catchPort = graph.ports.find((port) => port.direction === 'catch')!;
    const throwPosition = layout.ports.get(throwPort.id)!;
    const catchPosition = layout.ports.get(catchPort.id)!;

    const senderCenterX = senderBounds.x + INTERACTION_PROCESS_WIDTH / 2;
    const receiverCenterX = receiverBounds.x + INTERACTION_PROCESS_WIDTH / 2;

    expect(throwPosition.x).toBeGreaterThan(senderCenterX);
    expect(catchPosition.x).toBeLessThan(receiverCenterX);
  });

  it('returns waypoints for every line in direct mode', async () => {
    const graph = sampleGraph('direct');
    const layout = await layoutInteractionGraph(graph, 'direct');

    expect(graph.lines.length).toBeGreaterThan(0);
    for (const line of graph.lines) {
      const edge = layout.edges.get(line.id);
      expect(edge?.waypoints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('lays out a station shared by several senders and receivers with waypoints for every line', async () => {
    const entry = (uri: string, id: string, direction: 'throw' | 'catch'): SolutionBpmnModelEntry => ({
      kind: 'bpmn',
      uri,
      sha256: id,
      processes: [process(id, [messageEvent(`${direction}_${id}`, direction, 'Evt')])],
      storedLinterScores: [],
    });
    const graph = buildInteractionGraph(
      [
        entry('file:///s1.bpmn', 's1', 'throw'),
        entry('file:///s2.bpmn', 's2', 'throw'),
        entry('file:///r1.bpmn', 'r1', 'catch'),
        entry('file:///r2.bpmn', 'r2', 'catch'),
      ],
      ['s1', 's2', 'r1', 'r2'].map((id) => ({ uri: `file:///${id}.bpmn`, processId: id })),
      { layout: 'stations', hideProcessesWithoutInteraction: false },
    );
    const layout = await layoutInteractionGraph(graph, 'stations');

    expect(layout.stations.size).toBe(1);
    expect(graph.lines).toHaveLength(4);
    for (const line of graph.lines) {
      expect(layout.edges.get(line.id)?.waypoints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('places the first port row below the process header', async () => {
    const graph = sampleGraph('direct');
    const layout = await layoutInteractionGraph(graph, 'direct');
    const process = graph.processes[0]!;
    const processBounds = layout.processes.get(process.id)!;
    const firstPort = graph.ports[0]!;
    const firstPortPosition = layout.ports.get(firstPort.id)!;
    const headerBottom = 30;
    expect(firstPortPosition.y).toBeGreaterThanOrEqual(processBounds.y + headerBottom);
  });

  it('stacks the ports of each side top to bottom in graph order', async () => {
    const graph = buildInteractionGraph(
      [
        {
          kind: 'bpmn',
          uri: 'file:///hub.bpmn',
          sha256: 'hub',
          processes: [
            process('hub', [
              messageEvent('Catch_A', 'catch', 'A'),
              messageEvent('Catch_B', 'catch', 'B'),
              messageEvent('Throw_C', 'throw', 'C'),
              messageEvent('Throw_D', 'throw', 'D'),
            ]),
          ],
          storedLinterScores: [],
        },
      ],
      [{ uri: 'file:///hub.bpmn', processId: 'hub' }],
      { layout: 'direct', hideProcessesWithoutInteraction: false },
    );
    const layout = await layoutInteractionGraph(graph, 'direct');

    for (const direction of ['catch', 'throw']) {
      const sidePorts = graph.ports.filter((port) => port.direction === direction);
      const positions = sidePorts.map((port) => layout.ports.get(port.id)!.y);
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
      expect(positions[0]).toBeLessThan(positions[1]!);
    }
  });

  it('creates station positions only in station layout', async () => {
    const directLayout = await layoutInteractionGraph(sampleGraph('direct'), 'direct');
    const stationLayout = await layoutInteractionGraph(sampleGraph('stations'), 'stations');

    expect(directLayout.stations.size).toBe(0);
    expect(stationLayout.stations.size).toBeGreaterThan(0);
  });

  it('rejects when ELK layout fails', async () => {
    vi.spyOn(ElkBundled.prototype, 'layout').mockRejectedValueOnce(new Error('broken'));

    await expect(layoutInteractionGraph(sampleGraph('direct'), 'direct')).rejects.toThrow(
      'The interaction layout failed: broken',
    );
  });
});
