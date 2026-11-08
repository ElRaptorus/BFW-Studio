import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import InteractionsDocumentModel from '#modules/bpmn-interactions/InteractionsDocumentModel';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from '#modules/bpmn-landscape/LandscapeSolutionScan';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('#modules/bpmn-interactions/viewer/InteractionsViewer', () => ({
  default: class MockInteractionsViewer {
    container = { isConnected: false, remove: () => undefined };
    importLayout = vi.fn();
    updateFocus = vi.fn();
    get = vi.fn(() => ({ on: vi.fn() }));
    destroy = vi.fn();
  },
}));

vi.mock('#modules/bpmn-interactions/layoutInteractionGraph', () => ({
  layoutInteractionGraph: vi.fn(
    async (graph: { processes: unknown[]; ports: unknown[]; lines: unknown[]; stations: unknown[] }) => ({
      processes: new Map(),
      ports: new Map(),
      stations: new Map(),
      edges: new Map(),
      graph,
    }),
  ),
  INTERACTION_PROCESS_WIDTH: 200,
  INTERACTION_PROCESS_HEIGHT: 100,
}));

describe('Interactions properties summary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts graph elements for the empty selection summary', async () => {
    const catalog: SolutionBpmnModelEntry[] = [
      {
        kind: 'bpmn',
        uri: 'file:///a.bpmn',
        sha256: '1',
        processes: [
          {
            id: 'Sender',
            name: 'Sender',
            version: '1',
            isExecutable: true,
            correlationKey: null,
            callActivities: [],
            decisionRefs: [],
            communicationEvents: [
              {
                flowNodeId: 'Throw',
                flowNodeName: null,
                kind: 'message',
                direction: 'throw',
                position: 'intermediateThrow',
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
        storedLinterScores: [],
      },
      {
        kind: 'bpmn',
        uri: 'file:///b.bpmn',
        sha256: '2',
        processes: [
          {
            id: 'Receiver',
            name: 'Receiver',
            version: '1',
            isExecutable: true,
            correlationKey: null,
            callActivities: [],
            decisionRefs: [],
            communicationEvents: [
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
            ],
          },
        ],
        storedLinterScores: [],
      },
    ];
    const bifrost = {
      getSharedRessource: (key: string) =>
        key === LANDSCAPE_SOLUTION_SCAN_KEY
          ? { getSnapshot: () => ({ catalog }), onDidChange: () => ({ dispose: () => undefined }), refresh: vi.fn() }
          : null,
      events: { on: () => ({ dispose: () => undefined }) },
      solution: { getSolution: () => ({ projects: [] }) },
      settings: { inspectForTarget: () => ({ value: undefined }), onDidChange: () => ({ dispose: () => undefined }) },
      notifications: { open: vi.fn() },
    };
    const model = await InteractionsDocumentModel.create(
      'interactions://solution',
      null,
      null,
      null as any,
      bifrost as any,
    );
    model.onEditorDocumentModelDidRegister();
    model.setProcessSelected({ uri: 'file:///a.bpmn', processId: 'Sender' }, true);
    model.setProcessSelected({ uri: 'file:///b.bpmn', processId: 'Receiver' }, true);
    await model.generate();
    const summary = model.getDiagramSummary();
    expect(summary.processCount).toBe(2);
    expect(summary.portCount).toBe(2);
    expect(summary.lineCount).toBe(1);
  });
});
