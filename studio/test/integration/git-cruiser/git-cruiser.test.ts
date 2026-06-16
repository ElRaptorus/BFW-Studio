import { execSync } from 'child_process';
import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const GIT_FIXTURE = path.join(FIXTURES_DIR, 'test-solution-git-cruiser');

function createGitRepoFromFixture(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-git-test-'));
  fs.cpSync(GIT_FIXTURE, tmpDir, { recursive: true });
  execSync('git init', { cwd: tmpDir });
  execSync('git add -A', { cwd: tmpDir });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir });
  return tmpDir;
}

describe('git-cruiser/smoke', { timeout: 40_000 }, () => {
  let studioAgent: StudioAgent;
  let repoDir: string;

  beforeAll(async () => {
    repoDir = createGitRepoFromFixture();
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.openDirectoryAsSolution(repoDir);
    // Wait for the git module to finish its detection.
    await studioAgent.pause(1000);
  });

  beforeEach(({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
    try {
      fs.rmSync(repoDir);
    } catch {
      // cleanup is best-effort
    }
  });

  it('smoke/git-pane: should toggle the Git pane via left menubar', async () => {
    await studioAgent.leftMenuBar.togglePane('pane/left/git');
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/git');

    await studioAgent.assertVisible('[data-test--git-pane]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/git-detect: should detect the git repo after opening solution', async () => {
    await studioAgent.leftMenuBar.togglePane('pane/left/git');
    await studioAgent.assertGitPaneVisible();

    const branchLabel = await studioAgent.getGitPaneBranchLabel();
    assert.ok(
      branchLabel.includes('master') || branchLabel.includes('main'),
      `Expected branch label to contain 'master' or 'main', got: ${branchLabel}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/git-stage: should stage and unstage a file', async () => {
    fs.writeFileSync(path.join(repoDir, 'readme.txt'), 'Modified content\n');

    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);

    await studioAgent.leftMenuBar.togglePane('pane/left/git');
    await studioAgent.assertGitPaneVisible();
    await studioAgent.pause(1000);

    const sectionsBeforeStage = await studioAgent.getGitPaneSectionCount();
    assert.ok(sectionsBeforeStage > 0, 'Expected at least one section (Changes) in the Git pane');

    await studioAgent.stageFileViaApi('readme.txt');
    await studioAgent.pause(1000);

    await studioAgent.unstageFileViaApi('readme.txt');
    await studioAgent.pause(1000);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/git-commit: should stage and commit a file', async () => {
    fs.writeFileSync(path.join(repoDir, 'readme.txt'), 'Committed content\n');

    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);

    await studioAgent.stageFileViaApi('readme.txt');
    await studioAgent.pause(500);

    await studioAgent.commitAllStagedViaApi('test commit from integration test');
    await studioAgent.pause(1000);

    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(500);

    const sectionsAfterCommit = await studioAgent.getGitPaneSectionCount();
    assert.strictEqual(sectionsAfterCommit, 0, 'Expected no sections after committing all changes');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/git-commands: should expose git commands in command search', async () => {
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
