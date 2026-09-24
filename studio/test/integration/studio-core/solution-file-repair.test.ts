import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

describe('solution file repair', () => {
  let studioAgent: StudioAgent;
  let workspace: string;
  let solutionPath: string;

  beforeEach(async ({ task }) => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'bfw-solution-repair-'));
    fs.cpSync(path.join(FIXTURES_DIR, 'test-solution-scoped-settings-a'), path.join(workspace, 'a'), {
      recursive: true,
    });
    fs.cpSync(path.join(FIXTURES_DIR, 'test-solution-scoped-settings-b'), path.join(workspace, 'b'), {
      recursive: true,
    });
    solutionPath = path.join(workspace, 'Repair.bfwsln');
    fs.writeFileSync(
      solutionPath,
      `${JSON.stringify(
        {
          folders: [
            { path: path.join(workspace, 'a'), name: 'A' },
            { path: path.join(workspace, 'b'), name: 'B' },
          ],
          settings: { 'bpmn.editor.showGrid': true },
        },
        null,
        2,
      )}\n`,
    );

    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openViaCommandSearch('Test: Open URI as solution');
    await studioAgent.assertVisible('[data-test--dialog]');
    await studioAgent.sendKeyboardInput([...`file://${solutionPath}`.split(''), 'enter'], false);
    await studioAgent.assertVisible('[data-test--tree="std/file-explorer/open-solution"]');
    await studioAgent.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function waitForDialogTitle(title: string): Promise<void> {
    await studioAgent.waitUntil(
      async () =>
        (await studioAgent.executeInRenderer(
          `return document.querySelector('[data-test--dialog]')?.textContent?.includes(${JSON.stringify(title)}) === true`,
        )) === true,
      { timeout: 5_000, timeoutMsg: `Dialog "${title}" did not open` },
    );
  }

  async function renameProject(newName: string): Promise<void> {
    const projects = await studioAgent.getSolutionProjects();
    const project = projects.find((candidate) => candidate.name === 'A');
    assert.ok(project != null);
    await studioAgent.executeCommandWithoutBlocking('std.test.renameProjectInSolution');
    await waitForDialogTitle('Rename Project');
    await studioAgent.submitActiveDialog('submit', { promptValue: project.baseUri });
    await studioAgent.assertVisible('[data-test--dialog] input[placeholder="Enter new name"]');
    await studioAgent.submitActiveDialog('submit', { promptValue: newName });
    await waitForDialogTitle('Solution file cannot be read');
  }

  it('repairs a broken solution file and keeps a backup', async () => {
    fs.writeFileSync(solutionPath, '{ broken');
    await renameProject('Renamed');
    await studioAgent.submitActiveDialog('repair');
    await studioAgent.waitUntil(
      async () => {
        try {
          const repaired = JSON.parse(fs.readFileSync(solutionPath, 'utf8'));
          return (
            repaired.settings != null &&
            Object.keys(repaired.settings).length === 0 &&
            repaired.folders.some((folder: { name?: string }) => folder.name === 'Renamed')
          );
        } catch {
          return false;
        }
      },
      { timeout: 5_000, timeoutMsg: 'Repaired solution file was not written' },
    );

    assert.strictEqual(fs.readFileSync(`${solutionPath}.broken`, 'utf8'), '{ broken');
  });

  it('leaves the broken file unchanged when the repair is declined', async () => {
    fs.writeFileSync(solutionPath, '{ broken');
    await renameProject('Renamed');
    await studioAgent.closeActiveDialog();
    await studioAgent.waitUntil(async () => !(await studioAgent.isDialogActive()), {
      timeout: 5_000,
      timeoutMsg: 'Repair dialog did not close',
    });

    assert.strictEqual(fs.readFileSync(solutionPath, 'utf8'), '{ broken');
    assert.strictEqual(fs.existsSync(`${solutionPath}.broken`), false);
  });
});
