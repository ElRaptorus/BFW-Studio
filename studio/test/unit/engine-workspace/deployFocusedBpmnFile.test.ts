import type { EngineConnectionManager } from '#modules/engine-core';
import { deployFocusedBpmnFile } from '#modules/engine-workspace/initializers/initializeRunMenu';
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

const connectionManager = { getActiveEngineId: () => 'e1' } as unknown as EngineConnectionManager;

function setup(deploy: () => unknown, ensureVersions: unknown = { xml: '<original/>', modified: false }) {
  const recording = createRecordingBifrost();
  (recording.bifrost as any).editors = { getFocusedEditorDocument: () => ({ uri: `file://${filePath}` }) };
  recording.handlers.set('engine.ensureProcessVersions', async () => ensureVersions);
  recording.handlers.set('engine.deploy', deploy);
  const notifications = () =>
    recording.calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  return { ...recording, notifications };
}

describe('deployFocusedBpmnFile', () => {
  it('returns the deploy result without a notification when it succeeds', async () => {
    const { bifrost, notifications } = setup(async () => ({ deployed: [{ processModelId: 'order-process' }] }));

    expect(await deployFocusedBpmnFile(bifrost, connectionManager)).toEqual({
      processModelId: 'order-process',
      engineId: 'e1',
      filePath,
      fileName: 'order.bpmn',
    });
    expect(notifications()).toEqual([]);
  });

  it('shows the failure message as an error notification and returns null', async () => {
    const { bifrost, notifications } = setup(async () => ({ deployed: [] }));

    expect(await deployFocusedBpmnFile(bifrost, connectionManager)).toBeNull();
    expect(notifications()).toEqual([
      {
        type: 'error',
        content: 'Deploy succeeded but the engine did not return a process model ID.',
        source: 'Engine',
      },
    ]);
  });

  it('returns null without a notification when the user cancels', async () => {
    const { bifrost, notifications } = setup(async () => undefined, null);

    expect(await deployFocusedBpmnFile(bifrost, connectionManager)).toBeNull();
    expect(notifications()).toEqual([]);
  });
});
