import type {
  SolutionBpmnModelEntry,
  SolutionCommunicationEventEntry,
  SolutionProcessEntry,
} from '#modules/bpmn-core/scanSolutionBpmnModels';
import { buildInteractionGraph } from '#modules/bpmn-interactions/buildInteractionGraph';
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

function communicationEvent(
  flowNodeId: string,
  kind: 'message' | 'signal',
  direction: 'throw' | 'catch',
  name: string | null,
  extra: Partial<SolutionCommunicationEventEntry> = {},
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
    ...extra,
  };
}

function file(uri: string, ...processes: SolutionProcessEntry[]): SolutionBpmnModelEntry {
  return { kind: 'bpmn', uri, sha256: 'hash', processes, storedLinterScores: [] };
}

function select(uri: string, processId: string) {
  return { uri, processId };
}

describe('buildInteractionGraph', () => {
  it('draws one direct line per throw/catch pair in view', () => {
    const catalog = [
      file(
        'file:///sales.bpmn',
        process('sales', {
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'OrderPlaced')],
        }),
      ),
      file(
        'file:///stock.bpmn',
        process('stock', {
          communicationEvents: [communicationEvent('Catch_1', 'message', 'catch', 'OrderPlaced')],
        }),
      ),
    ];
    const graph = buildInteractionGraph(
      catalog,
      [select('file:///sales.bpmn', 'sales'), select('file:///stock.bpmn', 'stock')],
      {
        layout: 'direct',
        hideProcessesWithoutInteraction: false,
      },
    );

    expect(graph.lines).toEqual([
      {
        id: 'line:file:///sales.bpmn#sales#Throw_1->file:///stock.bpmn#stock#Catch_1',
        kind: 'message',
        name: 'OrderPlaced',
        sourceId: 'file:///sales.bpmn#sales#Throw_1',
        targetId: 'file:///stock.bpmn#stock#Catch_1',
      },
    ]);
    expect(graph.stations).toHaveLength(0);
  });

  it('keeps selected processes without communication events when the hide option is off', () => {
    const catalog = [file('file:///quiet%20one.bpmn', process('quiet'))];
    const graph = buildInteractionGraph(catalog, [select('file:///quiet%20one.bpmn', 'quiet')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(graph.processes).toEqual([
      {
        id: 'process:file:///quiet%20one.bpmn#quiet',
        uri: 'file:///quiet%20one.bpmn',
        processId: 'quiet',
        label: 'quiet',
        fileLabel: 'quiet one.bpmn',
      },
    ]);
    expect(graph.ports).toEqual([]);
  });

  it('routes lines through stations in station layout', () => {
    const catalog = [
      file(
        'file:///a.bpmn',
        process('a', { communicationEvents: [communicationEvent('T1', 'message', 'throw', 'Ping')] }),
      ),
      file(
        'file:///b.bpmn',
        process('b', { communicationEvents: [communicationEvent('C1', 'message', 'catch', 'Ping')] }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///a.bpmn', 'a'), select('file:///b.bpmn', 'b')], {
      layout: 'stations',
      hideProcessesWithoutInteraction: false,
    });

    expect(graph.stations).toEqual([{ id: 'station:message:Ping', kind: 'message', name: 'Ping' }]);
    expect(graph.lines.map((line) => [line.sourceId, line.targetId])).toEqual([
      ['file:///a.bpmn#a#T1', 'station:message:Ping'],
      ['station:message:Ping', 'file:///b.bpmn#b#C1'],
    ]);
  });

  it('draws one line per port to the station, not one per sender and receiver pair', () => {
    const sender = (uri: string, id: string) =>
      file(uri, process(id, { communicationEvents: [communicationEvent('T', 'signal', 'throw', 'Tick')] }));
    const receiver = (uri: string, id: string) =>
      file(uri, process(id, { communicationEvents: [communicationEvent('C', 'signal', 'catch', 'Tick')] }));
    const catalog = [
      sender('file:///s1.bpmn', 's1'),
      sender('file:///s2.bpmn', 's2'),
      sender('file:///s3.bpmn', 's3'),
      receiver('file:///r1.bpmn', 'r1'),
      receiver('file:///r2.bpmn', 'r2'),
    ];
    const selected = ['s1', 's2', 's3', 'r1', 'r2'].map((id) => select(`file:///${id}.bpmn`, id));

    const stations = buildInteractionGraph(catalog, selected, {
      layout: 'stations',
      hideProcessesWithoutInteraction: false,
    });
    const direct = buildInteractionGraph(catalog, selected, {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(stations.stations).toHaveLength(1);
    expect(stations.lines).toHaveLength(5);
    expect(direct.lines).toHaveLength(6);
  });

  it('shows a stub when every partner is outside the view', () => {
    const catalog = [
      file(
        'file:///sales.bpmn',
        process('sales', {
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'OrderPlaced')],
        }),
      ),
      file(
        'file:///stock.bpmn',
        process('stock', {
          communicationEvents: [communicationEvent('Catch_1', 'message', 'catch', 'OrderPlaced')],
        }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///sales.bpmn', 'sales')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    const throwPort = graph.ports.find((port) => port.direction === 'throw');
    expect(throwPort?.showPartnersOutsideViewStub).toBe(true);
    expect(throwPort?.partnersOutsideViewCount).toBe(1);
    expect(graph.lines).toHaveLength(0);
  });

  it('shows the no-partner glyph for a named event without a partner in the solution', () => {
    const catalog = [
      file(
        'file:///solo.bpmn',
        process('solo', {
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'NobodyListens')],
        }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///solo.bpmn', 'solo')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(graph.ports[0]?.showNoPartnerInSolutionGlyph).toBe(true);
    expect(graph.ports[0]?.hasPartnerInSolution).toBe(false);
  });

  it('keeps unnamed events as ports with a warning and connects nothing', () => {
    const catalog = [
      file(
        'file:///a.bpmn',
        process('a', {
          communicationEvents: [
            communicationEvent('Throw_1', 'message', 'throw', null),
            communicationEvent('Catch_1', 'message', 'catch', 'Named'),
          ],
        }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///a.bpmn', 'a')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    const unnamed = graph.ports.find((port) => port.name == null);
    expect(unnamed?.nameWarning).toBe('No message name');
    expect(graph.lines).toHaveLength(0);
  });

  it('does not connect throw and catch on the same process', () => {
    const catalog = [
      file(
        'file:///loop.bpmn',
        process('loop', {
          communicationEvents: [
            communicationEvent('Throw_1', 'signal', 'throw', 'Ping'),
            communicationEvent('Catch_1', 'signal', 'catch', 'Ping'),
          ],
        }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///loop.bpmn', 'loop')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(graph.lines).toHaveLength(0);
  });

  it('treats the same process id in two files as separate processes', () => {
    const catalog = [
      file(
        'file:///a.bpmn',
        process('shared', {
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'Link')],
        }),
      ),
      file(
        'file:///b.bpmn',
        process('shared', {
          communicationEvents: [communicationEvent('Catch_1', 'message', 'catch', 'Link')],
        }),
      ),
    ];
    const graph = buildInteractionGraph(
      catalog,
      [select('file:///a.bpmn', 'shared'), select('file:///b.bpmn', 'shared')],
      { layout: 'direct', hideProcessesWithoutInteraction: false },
    );

    expect(graph.lines).toHaveLength(1);
  });

  it('drops processes without a line when the hide option is on', () => {
    const catalog = [
      file(
        'file:///a.bpmn',
        process('sender', {
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'Evt')],
        }),
      ),
      file(
        'file:///b.bpmn',
        process('receiver', {
          communicationEvents: [communicationEvent('Catch_1', 'message', 'catch', 'Evt')],
        }),
      ),
      file('file:///c.bpmn', process('lonely', { communicationEvents: [] })),
    ];
    const graph = buildInteractionGraph(
      catalog,
      [select('file:///a.bpmn', 'sender'), select('file:///b.bpmn', 'receiver'), select('file:///c.bpmn', 'lonely')],
      { layout: 'direct', hideProcessesWithoutInteraction: true },
    );

    expect(graph.processes.map((entry) => entry.processId).sort()).toEqual(['receiver', 'sender']);
  });

  it('sorts ports deterministically by process label, kind, direction, name and flow node id', () => {
    const catalog = [
      file(
        'file:///z.bpmn',
        process('z', {
          name: 'Zulu',
          communicationEvents: [communicationEvent('Z_throw', 'signal', 'throw', 'Alpha')],
        }),
        process('a', {
          name: 'Alpha',
          communicationEvents: [communicationEvent('A_catch', 'message', 'catch', 'Beta')],
        }),
      ),
    ];
    const first = buildInteractionGraph(catalog, [select('file:///z.bpmn', 'z'), select('file:///z.bpmn', 'a')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });
    const second = buildInteractionGraph(catalog, [select('file:///z.bpmn', 'a'), select('file:///z.bpmn', 'z')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(second.ports.map((port) => port.id)).toEqual(first.ports.map((port) => port.id));
  });

  it('preserves nested location metadata on ports', () => {
    const catalog = [
      file(
        'file:///sub.bpmn',
        process('main', {
          communicationEvents: [
            communicationEvent('Boundary_1', 'message', 'catch', 'Inside', {
              position: 'boundary',
              location: [{ id: 'Sub_1', name: 'Validate', eventSubprocess: false }],
            }),
          ],
        }),
      ),
    ];
    const graph = buildInteractionGraph(catalog, [select('file:///sub.bpmn', 'main')], {
      layout: 'direct',
      hideProcessesWithoutInteraction: false,
    });

    expect(graph.ports[0]?.location).toEqual([{ id: 'Sub_1', name: 'Validate', eventSubprocess: false }]);
  });

  it('uses the process name as the label, otherwise the id', () => {
    const catalog = [
      file(
        'file:///n.bpmn',
        process('pid', {
          name: 'Named Process',
          communicationEvents: [communicationEvent('Throw_1', 'message', 'throw', 'A')],
        }),
      ),
      file(
        'file:///i.bpmn',
        process('only-id', {
          name: null,
          communicationEvents: [communicationEvent('Throw_2', 'message', 'throw', 'B')],
        }),
      ),
    ];
    const graph = buildInteractionGraph(
      catalog,
      [select('file:///n.bpmn', 'pid'), select('file:///i.bpmn', 'only-id')],
      { layout: 'direct', hideProcessesWithoutInteraction: false },
    );

    const labels = graph.processes.map((entry) => entry.label).sort();
    expect(labels).toEqual(['Named Process', 'only-id']);
  });

  it('builds the same graph when the catalog input order changes', () => {
    const firstFile = file(
      'file:///a.bpmn',
      process('a', { communicationEvents: [communicationEvent('T', 'message', 'throw', 'X')] }),
    );
    const secondFile = file(
      'file:///b.bpmn',
      process('b', { communicationEvents: [communicationEvent('C', 'message', 'catch', 'X')] }),
    );
    const selected = [select('file:///a.bpmn', 'a'), select('file:///b.bpmn', 'b')];
    const options = { layout: 'direct' as const, hideProcessesWithoutInteraction: false };

    const forward = buildInteractionGraph([firstFile, secondFile], selected, options);
    const reverse = buildInteractionGraph([secondFile, firstFile], selected, options);

    expect(JSON.stringify(reverse)).toEqual(JSON.stringify(forward));
  });
});
