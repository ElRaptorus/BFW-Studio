import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';
import { onExplorerRescanRequested, registerDeployPlanCommands } from '#modules/engine-deploy/commands';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost } from '../support/recordingBifrost';

type DialogAnswer = { wasCancelled: boolean; response?: string; formData?: { name: string } };

function setup(options: {
  packages?: { name: string; files: string[] }[];
  existingFiles?: string[];
  planUris?: string[];
  dialogAnswers?: DialogAnswer[];
  hasSolution?: boolean;
}) {
  const { packages = [], existingFiles = [], planUris = [], dialogAnswers = [], hasSolution = true } = options;
  const recording = createRecordingBifrost();
  const bifrost = recording.bifrost as any;
  const stored: { packages: unknown } = { packages };
  const replaced: string[][] = [];
  const modes: string[] = [];
  const model = {
    getPlanUris: () => planUris,
    replaceItems: async (uris: string[]) => replaced.push(uris),
    setExplorerMode: (mode: string) => modes.push(mode),
  };
  const document = { uri: 'deploy://plan' };
  bifrost.editors = {
    focusOrOpenEditorDocument: () => document,
    getEditorDocumentModel: async () => model,
    getEditorDocumentByUri: () => document,
    getEditorDocumentModelIfPresent: () => model,
  };
  bifrost.solution = {
    getSolution: () =>
      hasSolution
        ? { solutionFileUri: 'file:///work/app.bfwsln', projects: [{ baseUri: 'file:///work/app' }] }
        : { projects: [] },
  };
  bifrost.settings = {
    get: () => stored.packages,
    set: async (_key: string, value: unknown) => {
      stored.packages = value;
      return 'solution';
    },
  };
  bifrost.files = { doesFileOrDirectoryExist: async (path: string) => existingFiles.includes(path) };
  const answers = [...dialogAnswers];
  bifrost.dialog.open = async () => answers.shift() ?? { wasCancelled: true };
  registerDeployPlanCommands(bifrost);
  const notifications = () =>
    recording.calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  return { ...recording, stored, replaced, modes, notifications };
}

const submit = { wasCancelled: false, response: StandardDialogResponse.Submit };

describe('deploy package commands', () => {
  it('loads a package, skipping missing files with one warning', async () => {
    const { bifrost, replaced, notifications } = setup({
      packages: [{ name: 'core', files: ['app/a.bpmn', 'app/gone.bpmn'] }],
      existingFiles: ['/work/app/a.bpmn'],
    });

    await bifrost.commands.executeCommand('engine.deploy.loadPackage', ['core']);

    expect(replaced).toEqual([['file:///work/app/a.bpmn']]);
    expect(notifications()).toHaveLength(1);
    expect(JSON.stringify(notifications()[0])).toContain('gone.bpmn');
  });

  it('ignores an unknown package and a missing solution', async () => {
    const unknown = setup({ packages: [] });
    await unknown.bifrost.commands.executeCommand('engine.deploy.loadPackage', ['nope']);
    const noSolution = setup({ packages: [{ name: 'core', files: ['a.bpmn'] }], hasSolution: false });
    await noSolution.bifrost.commands.executeCommand('engine.deploy.loadPackage', ['core']);

    expect(unknown.replaced).toEqual([]);
    expect(noSolution.replaced).toEqual([]);
  });

  it('saves the plan with solution-relative paths', async () => {
    const { bifrost, stored, notifications } = setup({
      planUris: ['file:///work/app/a.bpmn'],
      dialogAnswers: [{ wasCancelled: false, response: StandardDialogResponse.Submit, formData: { name: 'core' } }],
    });

    await bifrost.commands.executeCommand('engine.deploy.savePlanAsPackage', []);

    expect(stored.packages).toEqual([{ name: 'core', files: ['app/a.bpmn'] }]);
    expect(notifications()).toHaveLength(1);
  });

  it('asks before replacing an existing package and keeps it when declined', async () => {
    const { bifrost, stored } = setup({
      packages: [{ name: 'core', files: ['old.bpmn'] }],
      planUris: ['file:///work/app/a.bpmn'],
      dialogAnswers: [
        { wasCancelled: false, response: StandardDialogResponse.Submit, formData: { name: 'core' } },
        { wasCancelled: true },
      ],
    });

    await bifrost.commands.executeCommand('engine.deploy.savePlanAsPackage', []);

    expect(stored.packages).toEqual([{ name: 'core', files: ['old.bpmn'] }]);
  });

  it('is only enabled for a non-empty plan and saves nothing for an empty one', async () => {
    const empty = setup({ planUris: [] });
    const filled = setup({ planUris: ['file:///work/app/a.bpmn'] });

    expect(empty.registrationOptions.get('engine.deploy.savePlanAsPackage')?.enabledWhen?.()).toBe(false);
    expect(filled.registrationOptions.get('engine.deploy.savePlanAsPackage')?.enabledWhen?.()).toBe(true);
    await empty.bifrost.commands.executeCommand('engine.deploy.savePlanAsPackage', []);
    expect(empty.stored.packages).toEqual([]);
  });

  it('deletes a package only after confirmation', async () => {
    const declined = setup({ packages: [{ name: 'core', files: [] }], dialogAnswers: [{ wasCancelled: true }] });
    await declined.bifrost.commands.executeCommand('engine.deploy.deletePackage', ['core']);
    const confirmed = setup({ packages: [{ name: 'core', files: [] }], dialogAnswers: [submit] });
    await confirmed.bifrost.commands.executeCommand('engine.deploy.deletePackage', ['core']);

    expect(declined.stored.packages).toHaveLength(1);
    expect(confirmed.stored.packages).toEqual([]);
  });
});

describe('deploy explorer commands', () => {
  it('rescanExplorer notifies the listeners until they are disposed', async () => {
    const { bifrost } = setup({});
    let calls = 0;
    const subscription = onExplorerRescanRequested(() => calls++);

    await bifrost.commands.executeCommand('engine.deploy.rescanExplorer', []);
    subscription.dispose();
    await bifrost.commands.executeCommand('engine.deploy.rescanExplorer', []);

    expect(calls).toBe(1);
  });

  it('setExplorerMode forwards the mode to the plan model', async () => {
    const { bifrost, modes } = setup({});

    await bifrost.commands.executeCommand('engine.deploy.setExplorerMode', ['project']);

    expect(modes).toEqual(['project']);
  });
});
