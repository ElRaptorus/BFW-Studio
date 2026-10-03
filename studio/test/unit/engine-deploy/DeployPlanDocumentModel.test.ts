import DeployPlanDocumentModel from '#modules/engine-deploy/models/DeployPlanDocumentModel';
import type { SolutionModelEntry } from '#modules/solution-models/types';
import { beforeAll, describe, expect, it } from 'vitest';

import { fixtureUri, scanDeployFixture } from './support/fixtureEntries';

let entries: SolutionModelEntry[];
beforeAll(async () => {
  entries = await scanDeployFixture();
});

type SetupOptions = {
  connected?: boolean;
  health?: () => Promise<unknown>;
  noClient?: boolean;
  unsaved?: string[];
  deployResults?: Record<string, 'deployed' | 'failed' | 'cancelled'>;
};

async function setup(options: SetupOptions = {}) {
  const {
    connected = true,
    unsaved = [],
    deployResults = {},
    health = async () => undefined,
    noClient = false,
  } = options;
  const deployed: string[] = [];
  const connectionManager = {
    getActiveEngineId: () => 'e1',
    getConnection: () => ({ url: 'http://engine', displayName: 'Local' }),
    isConnected: () => connected,
    getClient: () =>
      noClient
        ? null
        : {
            engine: { health },
            processes: { getAll: async () => [], getVersions: async () => [] },
            decisions: { getAll: async () => [], getVersions: async () => [] },
          },
    identity: { hasCapability: () => true },
    on: () => ({ dispose: () => undefined }),
  };
  const bifrost = {
    getSharedRessource: () => connectionManager,
    solution: { getSolution: () => ({ projects: [] }) },
    settings: { on: () => ({ dispose: () => undefined }) },
    editors: {
      on: () => ({ dispose: () => undefined }),
      getOpenEditorDocuments: () => unsaved.map((uri) => ({ uri, hasUnsavedChanges: true })),
    },
    commands: {
      executeCommand: async (name: string, commandArguments: any[]) => {
        if (name === 'solution.models.scan') {
          return entries;
        }
        if (name === 'engine.workspace.deployBpmnFile') {
          const file = String(commandArguments[1]).split('/').pop() as string;
          deployed.push(file);
          const result = deployResults[file] ?? 'deployed';
          const outcomes = {
            deployed: { status: 'deployed' },
            cancelled: { status: 'cancelled' },
            failed: { status: 'failed', message: 'rejected' },
          };
          return outcomes[result];
        }
        throw new Error(`unexpected command ${name}`);
      },
    },
  };
  const model = await DeployPlanDocumentModel.create('deploy://plan', null, null, null, bifrost as any);
  return { model, deployed };
}

describe('DeployPlanDocumentModel', () => {
  it('includes new files by default and leaves non-executable files out', async () => {
    const { model } = await setup();

    await model.addItems([fixtureUri('order-process.bpmn'), fixtureUri('draft-process.bpmn')]);

    expect(model.getPlanUris()).toHaveLength(2);
    expect(model.isIncluded(fixtureUri('order-process.bpmn'))).toBe(true);
    expect(model.isIncluded(fixtureUri('draft-process.bpmn'))).toBe(false);
    expect(model.getSelectedUri()).toBe(fixtureUri('order-process.bpmn'));
  });

  it('treats a failed health check as no Engine state: unknown status, nothing ticked, Deploy blocked', async () => {
    let healthy = false;
    const { model } = await setup({
      health: async () => {
        if (!healthy) {
          throw new Error('boom');
        }
      },
    });

    await model.addItems([fixtureUri('payment-process.bpmn')]);

    expect(model.getAnalysis().items[0].status).toBe('unknown');
    expect(model.isIncluded(fixtureUri('payment-process.bpmn'))).toBe(false);
    model.setIncluded(fixtureUri('payment-process.bpmn'), true);
    expect(model.getDeployBlockedReason()).toContain('Engine is not reachable: boom');
    model.setIncluded(fixtureUri('payment-process.bpmn'), false);

    healthy = true;
    await model.refresh();

    expect(model.getAnalysis().items[0].status).toBe('new');
    expect(model.isIncluded(fixtureUri('payment-process.bpmn'))).toBe(true);
  });

  it('behaves as offline when the Engine is connected but has no client', async () => {
    const { model } = await setup({ noClient: true });
    await model.addItems([fixtureUri('payment-process.bpmn')]);

    expect(model.getDeployBlockedReason()).toBe('No connected Engine.');
  });

  it('keeps a user choice made while offline when the Engine state arrives', async () => {
    const { model } = await setup({ noClient: true });
    await model.addItems([fixtureUri('payment-process.bpmn')]);
    model.setIncluded(fixtureUri('payment-process.bpmn'), false);

    await model.refresh();

    expect(model.isIncluded(fixtureUri('payment-process.bpmn'))).toBe(false);
  });

  it('ignores files that are already in the plan', async () => {
    const { model } = await setup();

    await model.addItems([fixtureUri('order-process.bpmn')]);
    model.setIncluded(fixtureUri('order-process.bpmn'), false);
    await model.addItems([fixtureUri('order-process.bpmn')]);

    expect(model.getPlanUris()).toHaveLength(1);
    expect(model.isIncluded(fixtureUri('order-process.bpmn'))).toBe(false);
  });

  it('offers the local dependencies that are not in the plan and adds them', async () => {
    const { model } = await setup();
    await model.addItems([fixtureUri('order-process.bpmn')]);

    expect(model.getMissingLocalDependencyUris().sort()).toEqual(
      [fixtureUri('discount-rules.dmn'), fixtureUri('payment-process.bpmn')].sort(),
    );

    await model.addMissingDependencies();

    expect(model.getPlanUris()).toHaveLength(3);
    expect(model.getMissingLocalDependencyUris()).toEqual([]);
  });

  it('blocks Deploy while the Engine is offline and names the reason', async () => {
    const { model } = await setup({ connected: false });
    await model.addItems([fixtureUri('payment-process.bpmn')]);

    expect(model.canDeploy()).toBe(false);
    expect(model.getDeployBlockedReason()).toBe('No connected Engine.');
  });

  it('blocks Deploy for an included file with unsaved changes', async () => {
    const { model } = await setup({ unsaved: [fixtureUri('payment-process.bpmn')] });
    await model.addItems([fixtureUri('payment-process.bpmn')]);

    expect(model.getDeployBlockedReason()).toContain('Unsaved changes');
    model.setIncluded(fixtureUri('payment-process.bpmn'), false);
    expect(model.getDeployBlockedReason()).toBe('No files are selected for deployment.');
  });

  it('removes a file and clears the selection', async () => {
    const { model } = await setup();
    await model.addItems([fixtureUri('payment-process.bpmn')]);

    await model.removeItem(fixtureUri('payment-process.bpmn'));

    expect(model.getPlanUris()).toEqual([]);
    expect(model.getSelectedUri()).toBeNull();
  });

  it('deploys the included files, keeps going after a failure and unticks the deployed ones', async () => {
    const { model, deployed } = await setup({
      deployResults: { 'order-process.bpmn': 'failed', 'payment-process.bpmn': 'cancelled' },
    });
    await model.addItems([
      fixtureUri('order-process.bpmn'),
      fixtureUri('payment-process.bpmn'),
      fixtureUri('unversioned-process.bpmn'),
    ]);

    const results = await model.deploy();

    expect(deployed).toEqual(['order-process.bpmn', 'payment-process.bpmn', 'unversioned-process.bpmn']);
    expect(results.map((result) => result.status)).toEqual(['failed', 'cancelled', 'deployed']);
    expect(model.getResult(fixtureUri('order-process.bpmn'))?.message).toBe('rejected');
    expect(model.isIncluded(fixtureUri('unversioned-process.bpmn'))).toBe(false);
    expect(model.isIncluded(fixtureUri('order-process.bpmn'))).toBe(true);
    expect(model.isDeploying()).toBe(false);
  });

  it('does not deploy when it is blocked', async () => {
    const { model, deployed } = await setup({ connected: false });
    await model.addItems([fixtureUri('payment-process.bpmn')]);

    expect(await model.deploy()).toEqual([]);
    expect(deployed).toEqual([]);
  });
});
