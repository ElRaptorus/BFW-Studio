import type { EngineConnectionManager } from '#modules/engine-core';
import initializeRunMenu from '#modules/engine-workspace/initializers/initializeRunMenu';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRecordingBifrost } from '../support/recordingBifrost';

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'deploy-focused-'));
  filePath = path.join(directory, 'order.bpmn');
  await writeFile(filePath, '<original/>');
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

const connectionManager = {
  getActiveEngineId: () => 'e1',
  getConnection: () => undefined,
  on: () => undefined,
} as unknown as EngineConnectionManager;

function setup(deploy: () => unknown, ensureVersions: unknown = { xml: '<original/>', modified: false }) {
  const recording = createRecordingBifrost();
  const bifrost = recording.bifrost as any;
  bifrost.editors = { getFocusedEditorDocument: () => ({ uri: `file://${filePath}` }) };
  bifrost.menus = { registerMenuModifier: () => undefined };
  bifrost.menuBar = { registerMenuBarItemModifier: () => undefined, updateMenuBarItems: () => undefined };
  bifrost.keybindings = { registerKeyBindings: () => undefined };
  bifrost.solution = { getSolution: () => null };
  recording.handlers.set('engine.ensureProcessVersions', async () => ensureVersions);
  recording.handlers.set('engine.deploy', deploy);
  initializeRunMenu(recording.bifrost, connectionManager);
  const notifications = () =>
    recording.calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  return { ...recording, notifications };
}

describe('engine.deployCurrentProcess', () => {
  it('notifies that the focused BPMN file was deployed', async () => {
    const { bifrost, notifications } = setup(async () => ({ deployed: [{ processModelId: 'order-process' }] }));

    await bifrost.commands.executeCommand('engine.deployCurrentProcess');

    expect(notifications()).toEqual([
      {
        type: 'info',
        content: 'Deployed "order.bpmn" to e1.',
        source: 'Engine',
        actions: [{ action: 'view', label: 'View on Engine', default: true }],
      },
    ]);
  });

  it('shows the failure message as an error notification', async () => {
    const { bifrost, notifications } = setup(async () => ({ deployed: [] }));

    await bifrost.commands.executeCommand('engine.deployCurrentProcess');

    expect(notifications()).toEqual([
      {
        type: 'error',
        content: 'Deploy succeeded but the engine did not return a process model ID.',
        source: 'Engine',
      },
    ]);
  });

  it('stays quiet when the user cancels', async () => {
    const { bifrost, notifications } = setup(async () => undefined, null);

    await bifrost.commands.executeCommand('engine.deployCurrentProcess');

    expect(notifications()).toEqual([]);
  });
});
