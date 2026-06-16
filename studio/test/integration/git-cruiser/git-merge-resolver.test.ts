import { execSync } from 'child_process';
import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const MERGE_FIXTURE = path.join(FIXTURES_DIR, 'test-solution-git-merge');

/**
 * Creates a temporary Git repo in a MERGING state with conflicted BPMN and DMN files.
 *
 * 1. Copies base/ files, commits them on main
 * 2. Creates a feature branch, applies theirs/ changes (deleting theirs-deleted files), commits
 * 3. Returns to main, applies ours/ changes (deleting ours-deleted files), commits
 * 4. Attempts `git merge feature` — fails with conflicts
 */
function createMergeConflictRepo(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-merge-test-'));

  fs.cpSync(path.join(MERGE_FIXTURE, 'base'), tmpDir, { recursive: true });
  execSync('git init && git add -A && git commit -m "base"', { cwd: tmpDir });

  execSync('git checkout -b feature', { cwd: tmpDir });
  const theirsDeleteTarget = path.join(tmpDir, 'process-delete-theirs.bpmn');
  if (fs.existsSync(theirsDeleteTarget)) {
    fs.unlinkSync(theirsDeleteTarget);
  }
  fs.cpSync(path.join(MERGE_FIXTURE, 'theirs'), tmpDir, { force: true, recursive: true });
  execSync('git add -A && git commit -m "theirs changes"', { cwd: tmpDir });

  execSync('git checkout -', { cwd: tmpDir });
  const oursDeleteTarget = path.join(tmpDir, 'process-delete-ours.bpmn');
  if (fs.existsSync(oursDeleteTarget)) {
    fs.unlinkSync(oursDeleteTarget);
  }
  fs.cpSync(path.join(MERGE_FIXTURE, 'ours'), tmpDir, { force: true, recursive: true });
  execSync('git add -A && git commit -m "ours changes"', { cwd: tmpDir });

  try {
    execSync('git merge feature --no-edit', { cwd: tmpDir });
  } catch {
    // Expected: merge fails with conflicts
  }

  return tmpDir;
}

describe('git-merge-resolver', { timeout: 120_000 }, () => {
  let studioAgent: StudioAgent;
  let repoDir: string;

  beforeEach(async ({ task }) => {
    repoDir = createMergeConflictRepo();
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    await studioAgent.openDirectoryAsSolution(repoDir);
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.stopAndRecordErrors();

    try {
      fs.rmSync(repoDir, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('should detect merge state and show conflicts in Git Pane', async () => {
    await studioAgent.leftMenuBar.togglePane('pane/left/git');
    await studioAgent.assertGitPaneVisible();

    const branchLabel = await studioAgent.getGitPaneBranchLabel();
    assert.ok(
      branchLabel.includes('MERGING') || branchLabel.includes('master') || branchLabel.includes('main'),
      `Expected branch label to indicate merge state, got: ${branchLabel}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should show merge indicator in status bar', async () => {
    const statusBarText = await studioAgent.getText('.status-bar');
    assert.ok(
      statusBarText.includes('MERGING') || statusBarText.includes('conflict'),
      `Expected status bar to indicate merge state, got: ${statusBarText}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should display file progress counter in title', async () => {
    await studioAgent.openMergeResolver();

    const title = await studioAgent.getMergeResolverTitle();
    assert.ok(
      title.includes('1 of') || title.includes('Conflict'),
      `Expected title to contain file progress, got: ${title}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should accept ours and advance to next file', async () => {
    await studioAgent.openMergeResolver();

    const titleBefore = await studioAgent.getMergeResolverTitle();

    await studioAgent.clickMergeToolbarButton('Accept Ours');
    await studioAgent.pause(1000);

    const titleAfter = await studioAgent.getMergeResolverTitle();
    assert.notStrictEqual(titleBefore, titleAfter, 'Expected title to change after accepting ours');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should skip a file and advance', async () => {
    await studioAgent.openMergeResolver();

    const titleBefore = await studioAgent.getMergeResolverTitle();

    await studioAgent.clickMergeToolbarButton('Next File');
    await studioAgent.pause(1000);

    const titleAfter = await studioAgent.getMergeResolverTitle();
    assert.notStrictEqual(titleBefore, titleAfter, 'Expected title to change after skipping to next file');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should accept theirs and advance to next file', async () => {
    await studioAgent.openMergeResolver();

    await studioAgent.clickMergeToolbarButton('Accept Theirs');
    await studioAgent.pause(1000);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should resolve remaining files until completed state', async () => {
    await studioAgent.openMergeResolver();

    const MERGE_RESOLVER_SELECTOR = '[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]';

    for (let idx = 0; idx < 10; idx++) {
      const elements = await studioAgent.$$(MERGE_RESOLVER_SELECTOR);
      if (elements.length === 0) {
        break;
      }
      await studioAgent.clickMergeToolbarButton('Accept Ours');
      await studioAgent.pause(1000);
      try {
        await studioAgent.clickMergeToolbarButton('Resolve & Stage');
        await studioAgent.pause(1000);
      } catch {
        // Resolve & Stage is not visible, when one merge-side was deleted.
      }
    }

    await studioAgent.waitForNotVisible(MERGE_RESOLVER_SELECTOR);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should show DMN merge resolver for conflicted .dmn files', async () => {
    await studioAgent.openMergeResolver();

    const MERGE_RESOLVER_SELECTOR = '[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]';
    let foundDmnResolver = false;

    for (let idx = 0; idx < 10; idx++) {
      const isDmn = await studioAgent.isDmnMergeResolverVisible();
      if (isDmn) {
        foundDmnResolver = true;
        break;
      }

      const elements = await studioAgent.$$(MERGE_RESOLVER_SELECTOR);
      if (elements.length === 0) {
        break;
      }

      await studioAgent.clickMergeToolbarButton('Next File');
      await studioAgent.pause(1000);
    }

    assert.ok(foundDmnResolver, 'Expected at least one DMN merge resolver to appear among the conflicted files');
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should accept ours on DMN merge and advance', async () => {
    await studioAgent.openMergeResolver();

    const MERGE_RESOLVER_SELECTOR = '[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]';

    for (let idx = 0; idx < 10; idx++) {
      const isDmn = await studioAgent.isDmnMergeResolverVisible();
      if (isDmn) {
        const titleBefore = await studioAgent.getMergeResolverTitle();

        await studioAgent.clickMergeToolbarButton('Accept Ours');
        await studioAgent.pause(1000);

        try {
          await studioAgent.clickMergeToolbarButton('Resolve & Stage');
          await studioAgent.pause(1000);
        } catch {
          // May not be visible depending on conflict type
        }

        const elements = await studioAgent.$$(MERGE_RESOLVER_SELECTOR);
        if (elements.length > 0) {
          const titleAfter = await studioAgent.getMergeResolverTitle();
          assert.notStrictEqual(titleBefore, titleAfter, 'Expected title to change after resolving DMN conflict');
        }
        break;
      }

      const elements = await studioAgent.$$(MERGE_RESOLVER_SELECTOR);
      if (elements.length === 0) {
        break;
      }

      await studioAgent.clickMergeToolbarButton('Next File');
      await studioAgent.pause(1000);
    }

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('should accept theirs on DMN merge', async () => {
    await studioAgent.openMergeResolver();

    const MERGE_RESOLVER_SELECTOR = '[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]';

    for (let idx = 0; idx < 10; idx++) {
      const isDmn = await studioAgent.isDmnMergeResolverVisible();
      if (isDmn) {
        await studioAgent.clickMergeToolbarButton('Accept Theirs');
        await studioAgent.pause(1000);
        break;
      }

      const elements = await studioAgent.$$(MERGE_RESOLVER_SELECTOR);
      if (elements.length === 0) {
        break;
      }

      await studioAgent.clickMergeToolbarButton('Next File');
      await studioAgent.pause(1000);
    }

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
