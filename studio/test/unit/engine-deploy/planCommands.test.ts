import { collectSelectedModelUris, registerDeployPlanCommands } from '#modules/engine-deploy/commands';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost } from '../support/recordingBifrost';

function setup(selected: object[] = [], model: object | null = null) {
  const recording = createRecordingBifrost();
  const opened: string[] = [];
  const document = { uri: 'deploy://plan' };
  (recording.bifrost as any).editors = {
    focusOrOpenEditorDocument: (uri: string) => {
      opened.push(uri);
      return document;
    },
    getEditorDocumentModel: async () => model,
    getEditorDocumentByUri: () => (model == null ? null : document),
    getEditorDocumentModelIfPresent: () => model,
  };
  (recording.bifrost as any).views = { getById: () => ({ getSelectedMetadata: () => selected }) };
  registerDeployPlanCommands(recording.bifrost);
  const notifications = () =>
    recording.calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  return { ...recording, opened, notifications };
}

describe('collectSelectedModelUris', () => {
  it('flattens folders and files, deduplicates and ignores selections without models', () => {
    expect(
      collectSelectedModelUris([
        { kind: 'folder', uri: 'f', modelUris: ['a', 'b'] },
        { kind: 'file', uri: 'b', modelUris: ['b'] },
        undefined as never,
      ]),
    ).toEqual(['a', 'b']);
  });
});

describe('deploy plan commands', () => {
  it('addToPlan opens the plan and adds the files to its model', async () => {
    const added: string[][] = [];
    const { bifrost, opened } = setup([], { addItems: async (uris: string[]) => void added.push(uris) });

    await bifrost.commands.executeCommand('engine.deploy.addToPlan', [['a.bpmn']]);

    expect(opened).toEqual(['deploy://plan']);
    expect(added).toEqual([['a.bpmn']]);
  });

  it('addSelectedToPlan adds the models below the selection', async () => {
    const added: string[][] = [];
    const { bifrost } = setup([{ kind: 'folder', uri: 'f', modelUris: ['a.bpmn', 'b.dmn'] }], {
      addItems: async (uris: string[]) => void added.push(uris),
    });

    await bifrost.commands.executeCommand('engine.deploy.addSelectedToPlan', []);

    expect(added).toEqual([['a.bpmn', 'b.dmn']]);
  });

  it('addSelectedToPlan tells the user when the selection holds no models', async () => {
    const { bifrost, opened, notifications } = setup([{ kind: 'folder', uri: 'f', modelUris: [] }]);

    await bifrost.commands.executeCommand('engine.deploy.addSelectedToPlan', []);

    expect(opened).toEqual([]);
    expect(notifications()).toEqual([
      { type: 'info', content: 'The selection contains no BPMN or DMN files.', source: 'Deploy' },
    ]);
  });

  it('forwards remove, add-missing-dependencies and refresh to the model, and ignores them without a plan', async () => {
    const calls: string[] = [];
    const model = {
      removeItem: async (uri: string) => void calls.push(`remove:${uri}`),
      addMissingDependencies: async () => void calls.push('addMissing'),
      refresh: async () => void calls.push('refresh'),
    };
    const { bifrost } = setup([], model);
    await bifrost.commands.executeCommand('engine.deploy.removeFromPlan', ['a.bpmn']);
    await bifrost.commands.executeCommand('engine.deploy.addMissingDependencies', []);
    await bifrost.commands.executeCommand('engine.deploy.refreshPlan', []);
    expect(calls).toEqual(['remove:a.bpmn', 'addMissing', 'refresh']);

    const { bifrost: withoutPlan } = setup();
    await expect(withoutPlan.commands.executeCommand('engine.deploy.refreshPlan', [])).resolves.toBeUndefined();
  });

  it('deployPlan reports the deployed count and is only enabled when the plan can be deployed', async () => {
    const model = {
      canDeploy: () => true,
      deploy: async () => [
        { uri: 'a', status: 'deployed' },
        { uri: 'b', status: 'failed' },
      ],
    };
    const { bifrost, notifications, registrationOptions } = setup([], model);

    await bifrost.commands.executeCommand('engine.deploy.deployPlan', []);

    expect(notifications()).toEqual([{ type: 'warning', content: 'Deployed 1 of 2 file(s).', source: 'Deploy' }]);
    const enabledWhen = registrationOptions.get('engine.deploy.deployPlan')?.enabledWhen;
    expect(enabledWhen?.()).toBe(true);

    const blocked = setup([], { canDeploy: () => false });
    expect(blocked.registrationOptions.get('engine.deploy.deployPlan')?.enabledWhen?.()).toBe(false);
    expect(setup().registrationOptions.get('engine.deploy.deployPlan')?.enabledWhen?.()).toBe(false);
  });
});
