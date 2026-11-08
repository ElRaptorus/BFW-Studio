import { afterEach, describe, expect, it, vi } from 'vitest';

const viewerMocks = vi.hoisted(() => ({
  reveal: vi.fn(),
  selectionGet: vi.fn((): { id: string }[] => []),
}));

vi.mock('#modules/bpmn-interactions/viewer/InteractionsViewer', () => ({
  default: class MockInteractionsViewer {
    container = { isConnected: false, remove: () => undefined };
    importLayout = vi.fn();
    updateFocus = vi.fn();
    reveal = viewerMocks.reveal;
    get = vi.fn((service: string) => {
      if (service === 'selection') {
        return { get: viewerMocks.selectionGet, select: vi.fn() };
      }
      return { on: vi.fn(), resized: vi.fn() };
    });
    destroy = vi.fn();
    zoomToViewport = vi.fn();
  },
}));

vi.mock('#modules/bpmn-interactions/layoutInteractionGraph', () => ({
  layoutInteractionGraph: vi.fn(async (graph: { processes: { id: string }[] }) => {
    const processes = new Map<string, { x: number; y: number; width: number; height: number }>();
    graph.processes.forEach((process, index) => {
      processes.set(process.id, { x: index * 220, y: 0, width: 200, height: 100 });
    });
    return { processes, ports: new Map(), stations: new Map(), edges: new Map() };
  }),
  INTERACTION_PROCESS_WIDTH: 200,
  INTERACTION_PROCESS_HEIGHT: 100,
  PORT_SIZE: 24,
}));

import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import InteractionsDocumentModel, {
  writeInteractionsSetting,
} from '#modules/bpmn-interactions/InteractionsDocumentModel';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from '#modules/bpmn-landscape/LandscapeSolutionScan';

const catalogEntry = (uri: string, sha256: string, processId: string): SolutionBpmnModelEntry => ({
  kind: 'bpmn',
  uri,
  sha256,
  processes: [
    {
      id: processId,
      name: processId,
      version: '1',
      isExecutable: true,
      correlationKey: null,
      callActivities: [],
      decisionRefs: [],
      communicationEvents: [],
    },
  ],
  storedLinterScores: [],
});

describe('InteractionsDocumentModel staleness', () => {
  const listeners: (() => void)[] = [];
  let snapshot: { catalog: SolutionBpmnModelEntry[] } = { catalog: [] };
  const solutionScan = {
    getSnapshot: () => snapshot,
    onDidChange: (listener: () => void) => {
      listeners.push(listener);
      return { dispose: () => undefined };
    },
    refresh: vi.fn(async () => undefined),
  };

  const settings = new Map<string, unknown>();
  const solutionListeners: (() => void)[] = [];
  let solutionId: string | null = 'solution-1';

  const bifrost = {
    events: {
      on: (eventName: string, listener: () => void) => {
        if (eventName === 'solutionChanged') {
          solutionListeners.push(listener);
        }
        return { dispose: () => undefined };
      },
    },
    getSharedRessource: (key: string) => {
      if (key === LANDSCAPE_SOLUTION_SCAN_KEY) {
        return solutionScan;
      }
      throw new Error(`unknown resource ${key}`);
    },
    solution: { getSolution: () => (solutionId == null ? null : { id: solutionId, projects: [] }) },
    settings: {
      inspectForTarget: (_target: unknown, name: string) => ({ value: settings.get(name) }),
      onDidChange: () => ({ dispose: () => undefined }),
    },
    notifications: { open: vi.fn() },
  };

  afterEach(() => {
    listeners.length = 0;
    solutionListeners.length = 0;
    solutionId = 'solution-1';
    settings.clear();
    snapshot = { catalog: [] };
    viewerMocks.reveal.mockReset();
    viewerMocks.selectionGet.mockReset();
    viewerMocks.selectionGet.mockReturnValue([]);
    vi.restoreAllMocks();
  });

  it('is not stale before the first generation', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    expect(model.isStale()).toBe(false);
  });

  it('becomes stale when the catalog hash changes after generation', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    snapshot = { catalog: [catalogEntry('file:///a/process.bpmn', 'hash-a', 'Process_A')] };
    model.setProcessSelected({ uri: 'file:///a/process.bpmn', processId: 'Process_A' }, true);
    await model.generate();
    expect(model.isStale()).toBe(false);
    snapshot = { catalog: [catalogEntry('file:///a/process.bpmn', 'hash-b', 'Process_A')] };
    listeners.forEach((listener) => listener());
    expect(model.isStale()).toBe(true);
  });

  it('becomes stale when the selection changes after generation', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    snapshot = {
      catalog: [
        catalogEntry('file:///a/first.bpmn', 'hash-1', 'First'),
        catalogEntry('file:///a/second.bpmn', 'hash-2', 'Second'),
      ],
    };
    model.setProcessSelected({ uri: 'file:///a/first.bpmn', processId: 'First' }, true);
    await model.generate();
    model.setProcessSelected({ uri: 'file:///a/second.bpmn', processId: 'Second' }, true);
    expect(model.isStale()).toBe(true);
  });

  it('keeps selection and diagram across file changes and drops them when another solution opens', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    snapshot = { catalog: [catalogEntry('file:///a/process.bpmn', 'hash-a', 'Process_A')] };
    model.setProcessSelected({ uri: 'file:///a/process.bpmn', processId: 'Process_A' }, true);
    await model.generate();

    solutionListeners.forEach((listener) => listener());
    expect(model.getSelectedProcessReferences()).toHaveLength(1);
    expect(model.hasGeneratedDiagram()).toBe(true);

    solutionId = 'solution-2';
    solutionListeners.forEach((listener) => listener());
    expect(model.getSelectedProcessReferences()).toHaveLength(0);
    expect(model.hasGeneratedDiagram()).toBe(false);
    expect(model.isStale()).toBe(false);
    expect(model.getDiagramSummary().portCount).toBe(0);
  });

  it('sets many processes selected or cleared in one revision bump', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    snapshot = {
      catalog: [
        catalogEntry('file:///a/second.bpmn', 'hash-2', 'Second'),
        catalogEntry('file:///a/first.bpmn', 'hash-1', 'First'),
      ],
    };
    const references = [
      { uri: 'file:///a/first.bpmn', processId: 'First' },
      { uri: 'file:///a/second.bpmn', processId: 'Second' },
    ];
    expect(model.getSelectionRevision()).toBe(0);
    model.setProcessesSelected(references, true);
    expect(model.getSelectedProcessReferences()).toEqual(references);
    expect(model.getSelectionRevision()).toBe(1);
    model.setProcessesSelected(references, false);
    expect(model.getSelectedProcessReferences()).toEqual([]);
    expect(model.getSelectionRevision()).toBe(2);
  });

  it('adds partners outside the view when a stub port is activated', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    const outside = catalogEntry('file:///b/outside.bpmn', 'hash-outside', 'Outside');
    const inViewBase = catalogEntry('file:///a/view.bpmn', 'hash-view', 'InView');
    if (inViewBase.kind !== 'bpmn' || outside.kind !== 'bpmn') {
      throw new Error('expected bpmn entries');
    }
    const inView: SolutionBpmnModelEntry = {
      ...inViewBase,
      processes: [
        {
          ...inViewBase.processes[0]!,
          communicationEvents: [
            {
              flowNodeId: 'Throw',
              flowNodeName: null,
              kind: 'message' as const,
              direction: 'throw' as const,
              position: 'intermediateThrow' as const,
              name: 'Evt',
              interrupting: null,
              attachedToId: null,
              attachedToName: null,
              location: [],
              correlationRetrievalExpression: null,
            },
          ],
        },
      ],
    };
    outside.processes[0].communicationEvents = [
      {
        flowNodeId: 'Catch',
        flowNodeName: null,
        kind: 'message',
        direction: 'catch',
        position: 'intermediateCatch',
        name: 'Evt',
        interrupting: null,
        attachedToId: null,
        attachedToName: null,
        location: [],
        correlationRetrievalExpression: null,
      },
    ];
    snapshot = { catalog: [inView, outside] };
    model.setProcessSelected({ uri: 'file:///a/view.bpmn', processId: 'InView' }, true);
    await model.generate();
    const port = model.getInteractionGraph()?.ports.find((entry) => entry.flowNodeId === 'Throw');
    expect(port?.partnersOutsideViewCount).toBeGreaterThan(0);
    const generateSpy = vi.spyOn(model, 'generate').mockResolvedValue();
    await model.addPartnersOutsideViewAndGenerate(port!.id);
    expect(model.isProcessSelected({ uri: 'file:///b/outside.bpmn', processId: 'Outside' })).toBe(true);
    expect(generateSpy).toHaveBeenCalled();
  });

  it('addAllPartnersOutsideViewAndGenerate selects every de-duplicated stub partner and regenerates', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    const outside = catalogEntry('file:///b/outside.bpmn', 'hash-outside', 'Outside');
    const firstInView = catalogEntry('file:///a/first.bpmn', 'hash-first', 'First');
    const secondInView = catalogEntry('file:///a/second.bpmn', 'hash-second', 'Second');
    const event = {
      flowNodeId: 'Throw',
      flowNodeName: null,
      kind: 'message' as const,
      direction: 'throw' as const,
      position: 'intermediateThrow' as const,
      name: 'Shared',
      interrupting: null,
      attachedToId: null,
      attachedToName: null,
      location: [],
      correlationRetrievalExpression: null,
    };
    if (
      firstInView.kind !== 'bpmn' ||
      secondInView.kind !== 'bpmn' ||
      outside.kind !== 'bpmn' ||
      firstInView.processes[0] == null ||
      secondInView.processes[0] == null
    ) {
      throw new Error('expected bpmn entries');
    }
    firstInView.processes[0].communicationEvents = [{ ...event, flowNodeId: 'Throw_A' }];
    secondInView.processes[0].communicationEvents = [{ ...event, flowNodeId: 'Throw_B' }];
    outside.processes[0].communicationEvents = [
      {
        flowNodeId: 'Catch',
        flowNodeName: null,
        kind: 'message',
        direction: 'catch',
        position: 'intermediateCatch',
        name: 'Shared',
        interrupting: null,
        attachedToId: null,
        attachedToName: null,
        location: [],
        correlationRetrievalExpression: null,
      },
    ];
    snapshot = { catalog: [firstInView, secondInView, outside] };
    model.setProcessesSelected(
      [
        { uri: 'file:///a/first.bpmn', processId: 'First' },
        { uri: 'file:///a/second.bpmn', processId: 'Second' },
      ],
      true,
    );
    await model.generate();
    const generateSpy = vi.spyOn(model, 'generate').mockResolvedValue();
    await model.addAllPartnersOutsideViewAndGenerate();
    expect(model.isProcessSelected({ uri: 'file:///b/outside.bpmn', processId: 'Outside' })).toBe(true);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(model.getSelectionRevision()).toBe(2);
  });

  it('revealNextUnconnectedPort cycles through unconnected ports in graph order', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    const lonely = (processId: string, flowNodeId: string, uri: string, sha256: string) => {
      const entry = catalogEntry(uri, sha256, processId);
      if (entry.kind !== 'bpmn' || entry.processes[0] == null) {
        throw new Error('expected bpmn entry');
      }
      entry.processes[0].communicationEvents = [
        {
          flowNodeId,
          flowNodeName: null,
          kind: 'message',
          direction: 'throw',
          position: 'intermediateThrow',
          name: `Lonely_${flowNodeId}`,
          interrupting: null,
          attachedToId: null,
          attachedToName: null,
          location: [],
          correlationRetrievalExpression: null,
        },
      ];
      return entry;
    };
    snapshot = {
      catalog: [
        lonely('Alpha', 'Throw_A', 'file:///a/alpha.bpmn', 'hash-alpha'),
        lonely('Beta', 'Throw_B', 'file:///a/beta.bpmn', 'hash-beta'),
      ],
    };
    model.setProcessesSelected(
      [
        { uri: 'file:///a/alpha.bpmn', processId: 'Alpha' },
        { uri: 'file:///a/beta.bpmn', processId: 'Beta' },
      ],
      true,
    );
    await model.generate();
    const graph = model.getInteractionGraph();
    const unconnected = graph?.ports.filter((port) => port.showNoPartnerInSolutionGlyph) ?? [];
    expect(unconnected).toHaveLength(2);
    model.revealNextUnconnectedPort();
    expect(viewerMocks.reveal).toHaveBeenCalledWith(unconnected[0]!.id);
    viewerMocks.reveal.mockClear();
    viewerMocks.selectionGet.mockReturnValue([{ id: unconnected[0]!.id }]);
    model.revealNextUnconnectedPort();
    expect(viewerMocks.reveal).toHaveBeenCalledWith(unconnected[1]!.id);
    viewerMocks.reveal.mockClear();
    viewerMocks.selectionGet.mockReturnValue([{ id: unconnected[1]!.id }]);
    model.revealNextUnconnectedPort();
    expect(viewerMocks.reveal).toHaveBeenCalledWith(unconnected[0]!.id);
  });

  it('revealNextUnconnectedPort does nothing when every port is connected', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    snapshot = { catalog: [catalogEntry('file:///a/process.bpmn', 'hash-a', 'Process_A')] };
    model.setProcessSelected({ uri: 'file:///a/process.bpmn', processId: 'Process_A' }, true);
    await model.generate();
    model.revealNextUnconnectedPort();
    expect(viewerMocks.reveal).not.toHaveBeenCalled();
  });

  it('deselects only the references passed to setProcessesSelected', async () => {
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    const references = [
      { uri: 'file:///a/first.bpmn', processId: 'First' },
      { uri: 'file:///a/second.bpmn', processId: 'Second' },
    ];
    model.setProcessesSelected(references, true);
    model.setProcessesSelected([references[0]!], false);
    expect(model.getSelectedProcessReferences()).toEqual([references[1]]);
  });
});

describe('writeInteractionsSetting', () => {
  it('writes into the solution file when one is open and into User otherwise', () => {
    const setInScope = vi.fn(async () => true);
    const studio = (targets: { scope: string }[]) =>
      ({ settings: { getAvailableScopeTargets: () => targets, setInScope } }) as any;

    writeInteractionsSetting(
      studio([{ scope: 'user' }, { scope: 'solution' }]),
      'bpmn.interactions.layout',
      'stations',
    );
    writeInteractionsSetting(studio([{ scope: 'user' }]), 'bpmn.interactions.layout', 'direct');

    expect(setInScope.mock.calls).toEqual([
      [{ scope: 'solution' }, 'bpmn.interactions.layout', 'stations'],
      [{ scope: 'user' }, 'bpmn.interactions.layout', 'direct'],
    ]);
  });
});
