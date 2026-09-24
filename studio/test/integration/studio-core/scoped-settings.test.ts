import * as fs from 'fs';
import * as assert from 'node:assert';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const PROJECT_A = path.join(FIXTURES_DIR, 'test-solution-scoped-settings-a');
const PROJECT_B = path.join(FIXTURES_DIR, 'test-solution-scoped-settings-b');
const SOLUTION_FILE = path.join(FIXTURES_DIR, 'test-solution-scoped-settings.bfwsln');
const PROJECT_ENTRY_SELECTOR =
  '[data-test--tree="std/file-explorer/open-solution"] [data-test--tree-entry-type="project"]';

function writeSolutionFile(): void {
  fs.writeFileSync(
    SOLUTION_FILE,
    JSON.stringify(
      {
        folders: [
          { path: PROJECT_A, name: 'A' },
          { path: PROJECT_B, name: 'B' },
        ],
        settings: {},
      },
      null,
      2,
    ) + '\n',
  );
}

function removeGeneratedFiles(): void {
  if (fs.existsSync(SOLUTION_FILE)) {
    fs.unlinkSync(SOLUTION_FILE);
  }
  fs.rmSync(path.join(PROJECT_A, '.bifrostfw'), { recursive: true, force: true });
  fs.writeFileSync(
    path.join(PROJECT_B, '.bifrostfw', 'settings.json'),
    '{ "bpmnLinter.profile": "bpmn-production-ready" }\n',
  );
  const movedDiagram = path.join(PROJECT_B, 'diagram-a.bpmn');
  if (fs.existsSync(movedDiagram)) {
    fs.renameSync(movedDiagram, path.join(PROJECT_A, 'diagram-a.bpmn'));
  }
}

describe('scoped settings', () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    writeSolutionFile();
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openSolutionFileFromFixtures('test-solution-scoped-settings.bfwsln');
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    removeGeneratedFiles();
  });

  it('shows the project profile and writes profile changes into that project file', async () => {
    const projects = await studioAgent.getSolutionProjects();
    const projectA = projects.find((project) => project.name === 'A');
    const projectB = projects.find((project) => project.name === 'B');
    assert.ok(projectA != null && projectB != null);

    await studioAgent.openFile(`${projectA.baseUri}/diagram-a.bpmn`);
    assert.strictEqual(await studioAgent.getMenuBarSelectValue('bpmn-linter-profile-select'), 'bpmn-development');

    await studioAgent.openFile(`${projectB.baseUri}/diagram-b.bpmn`);
    assert.strictEqual(await studioAgent.getMenuBarSelectValue('bpmn-linter-profile-select'), 'bpmn-production-ready');

    await studioAgent.selectMenuBarOption('bpmn-linter-profile-select', 'bpmn-development');
    await studioAgent.waitForJsonFileValue(
      path.join(PROJECT_B, '.bifrostfw', 'settings.json'),
      'bpmnLinter.profile',
      'bpmn-development',
    );
    assert.strictEqual(fs.existsSync(path.join(PROJECT_A, '.bifrostfw', 'settings.json')), false);
  });

  it('creates a project settings file from the File Explorer project entry', async () => {
    const projectA = (await studioAgent.getSolutionProjects()).find((project) => project.name === 'A');
    assert.ok(projectA != null);
    await studioAgent.rightClickOn(PROJECT_ENTRY_SELECTOR);
    await studioAgent.assertContextMenuVisible();
    await studioAgent.clickOn('[data-test--context-menu-id="std/file-explorer/solution-root/project-settings"]');
    await studioAgent.assertVisible('[data-test-settings-scope="project"]');
    assert.strictEqual(await studioAgent.getValue('[data-test-settings-scope="project"]'), projectA.baseUri);
    await studioAgent.clickOn('[data-test-setting-key="bpmn.editor.showGrid"] input');

    await studioAgent.waitForJsonFileValue(
      path.join(PROJECT_A, '.bifrostfw', 'settings.json'),
      'bpmn.editor.showGrid',
      true,
    );
  });

  it('writes solution settings and keeps them when a project is renamed', async () => {
    await studioAgent.executeCommand('std.settings.openUserSettings');
    await studioAgent.clickSettingsScope('solution');
    await studioAgent.clickOn('[data-test-setting-key="bpmn.editor.showGrid"] input');
    await studioAgent.waitForJsonFileValue(SOLUTION_FILE, 'settings', { 'bpmn.editor.showGrid': true });
    const projectA = (await studioAgent.getSolutionProjects()).find((project) => project.name === 'A');
    assert.ok(projectA != null);
    await studioAgent.renameSolutionProjectViaApi(projectA.baseUri, 'A renamed');

    const solution = JSON.parse(fs.readFileSync(SOLUTION_FILE, 'utf8'));
    assert.strictEqual(solution.settings['bpmn.editor.showGrid'], true);
    assert.ok(solution.folders.some((folder: { name?: string }) => folder.name === 'A renamed'));
  });

  it('follows a moved BPMN file without reopening the tab', async () => {
    const projects = await studioAgent.getSolutionProjects();
    const projectA = projects.find((project) => project.name === 'A');
    const projectB = projects.find((project) => project.name === 'B');
    assert.ok(projectA != null && projectB != null);

    await studioAgent.openFile(`${projectA.baseUri}/diagram-a.bpmn`);
    assert.strictEqual(await studioAgent.getMenuBarSelectValue('bpmn-linter-profile-select'), 'bpmn-development');

    await studioAgent.executeCommand('std.fileExplorer.dropItems', [
      [`${projectA.baseUri}/diagram-a.bpmn`],
      projectB.baseUri,
    ]);

    assert.strictEqual(await studioAgent.getMenuBarSelectValue('bpmn-linter-profile-select'), 'bpmn-production-ready');
  });
});

describe('scoped settings in a single folder', () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-scoped-settings-a');
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
  });

  it('does not show a Solution scope', async () => {
    await studioAgent.executeCommand('std.settings.openUserSettings');
    await studioAgent.assertVisible('[data-test-settings-scope="user"]');
    assert.strictEqual(await studioAgent.getElementCount('[data-test-settings-scope="solution"]'), 0);
  });
});
