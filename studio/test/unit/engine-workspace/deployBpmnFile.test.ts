import { deployBpmnFile } from '#modules/engine-workspace/deploy/deployBpmnFile';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRecordingBifrost, recordedMethods } from '../support/recordingBifrost';

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'deploy-bpmn-file-'));
  filePath = path.join(directory, 'order.bpmn');
  await writeFile(filePath, '<original/>');
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

function setup(handlers: Record<string, (...commandArguments: any[]) => unknown>) {
  const recording = createRecordingBifrost();
  for (const [name, handler] of Object.entries(handlers)) {
    recording.handlers.set(name, handler);
  }
  return recording;
}

const unchanged = async (_engineId: string, xml: string) => ({ xml, modified: false });

describe('deployBpmnFile', () => {
  it('deploys the file and returns the process ids', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => ({ deployed: [{ processModelId: 'order-process' }, { processModelId: 'second' }] }),
    });

    const outcome = await deployBpmnFile(bifrost, 'e1', filePath);

    expect(outcome).toEqual({
      status: 'deployed',
      processModelId: 'order-process',
      processModelIds: ['order-process', 'second'],
      engineId: 'e1',
      filePath,
      fileName: 'order.bpmn',
    });
  });

  it('writes the file when versions had to be added', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': async () => ({ xml: '<versioned/>', modified: true }),
      'engine.deploy': async (_engineId: string, xml: string) => {
        expect(xml).toBe('<versioned/>');
        return { deployed: [{ processModelId: 'order-process' }] };
      },
    });

    await deployBpmnFile(bifrost, 'e1', filePath);

    expect(await readFile(filePath, 'utf-8')).toBe('<versioned/>');
  });

  it('is cancelled when the version dialog is cancelled and deploys nothing', async () => {
    const { bifrost, calls } = setup({ 'engine.ensureProcessVersions': async () => null });

    expect(await deployBpmnFile(bifrost, 'e1', filePath)).toEqual({ status: 'cancelled' });
    expect(recordedMethods(calls)).not.toContain('command:engine.deploy');
  });

  it('retries after resolving a version conflict and writes the bumped file', async () => {
    let attempts = 0;
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => {
        attempts++;
        if (attempts === 1) {
          throw Object.assign(new Error('conflict'), { errorCode: 'version_exists', conflicts: [{ processId: 'p' }] });
        }
        return { deployed: [{ processModelId: 'order-process' }] };
      },
      'engine.resolveVersionConflicts': async () => ({ xml: '<bumped/>' }),
    });

    const outcome = await deployBpmnFile(bifrost, 'e1', filePath);

    expect(outcome.status).toBe('deployed');
    expect(attempts).toBe(2);
    expect(await readFile(filePath, 'utf-8')).toBe('<bumped/>');
  });

  it('is cancelled when the conflict dialog is cancelled', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => {
        throw Object.assign(new Error('conflict'), { errorCode: 'version_exists', conflicts: [] });
      },
      'engine.resolveVersionConflicts': async () => null,
    });

    expect(await deployBpmnFile(bifrost, 'e1', filePath)).toEqual({ status: 'cancelled' });
  });

  it('returns the existing process when the user chooses to run it', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => {
        throw Object.assign(new Error('conflict'), { errorCode: 'version_exists', conflicts: [] });
      },
      'engine.resolveVersionConflicts': async () => ({ runExisting: true, processModelId: 'order-process' }),
    });

    expect(await deployBpmnFile(bifrost, 'e1', filePath, { allowRunExistingOnConflict: true })).toMatchObject({
      status: 'deployed',
      processModelId: 'order-process',
    });
  });

  it('gives up after three conflict retries', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => {
        throw Object.assign(new Error('conflict'), { errorCode: 'version_exists', conflicts: [] });
      },
      'engine.resolveVersionConflicts': async () => ({ xml: '<bumped/>' }),
    });

    expect(await deployBpmnFile(bifrost, 'e1', filePath)).toEqual({
      status: 'failed',
      message: 'Deployment failed after multiple version-conflict retries.',
    });
  });

  it('fails with the formatted message and keeps the error', async () => {
    const error = Object.assign(new Error('nope'), { statusCode: 500 });
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => {
        throw error;
      },
    });

    const outcome = await deployBpmnFile(bifrost, 'e1', filePath);

    expect(outcome).toMatchObject({ status: 'failed', error });
    expect((outcome as { message: string }).message).toContain('nope');
  });

  it('fails when the Engine returns no process id and when the file cannot be read', async () => {
    const { bifrost } = setup({
      'engine.ensureProcessVersions': unchanged,
      'engine.deploy': async () => ({ deployed: [] }),
    });

    expect(await deployBpmnFile(bifrost, 'e1', filePath)).toEqual({
      status: 'failed',
      message: 'Deploy succeeded but the engine did not return a process model ID.',
    });
    expect(await deployBpmnFile(bifrost, 'e1', path.join(directory, 'missing.bpmn'))).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('Cannot read "missing.bpmn"'),
    });
  });
});
