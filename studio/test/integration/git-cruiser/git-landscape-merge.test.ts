import type { LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { parseLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const MERGE_FIXTURE = path.join(__dirname, '..', '..', 'fixtures', 'test-solution-git-merge-landscape');
const MAP_PATH = 'landscapes/Overview.bfwmap';
const SOLUTION_FILE = 'Landscapes.bfwsln';
const MERGE_OURS = '[data-test--landscape-merge-ours]';
const MERGE_THEIRS = '[data-test--landscape-merge-theirs]';
const MERGE_RESULT = '[data-test--landscape-merge-result]';
const MERGE_PANE = '[data-test--pane="bpmn-landscape/panes/merge/LandscapeMergeChangeOverview"]';
const conflictEntry = (key: string): string => `${MERGE_PANE} [data-test--landscape-merge-conflict="${key}"]`;
const autoAppliedEntry = (key: string): string => `${MERGE_PANE} [data-test--landscape-merge-auto-applied="${key}"]`;

/**
 * A temporary repo in a MERGING state with a conflicted landscape map. Ours renames `archive` to "Records", renames
 * `billing` and connects `payment` to `returns`; theirs renames `archive` to "Vault", edits `memo`, moves `draft` and
 * removes `returns`. The solution file is written here because it names the project folder by its absolute path; it
 * stays out of Git.
 */
function createLandscapeMergeConflictRepo(): string {
  const repoDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-landscape-merge-')));
  fs.cpSync(path.join(MERGE_FIXTURE, 'base'), repoDir, { recursive: true });
  execSync('git init && git add -A && git commit -m "base"', { cwd: repoDir });
  fs.appendFileSync(path.join(repoDir, '.git', 'info', 'exclude'), `${SOLUTION_FILE}\n`);

  execSync('git checkout -b feature', { cwd: repoDir });
  fs.cpSync(path.join(MERGE_FIXTURE, 'theirs'), repoDir, { force: true, recursive: true });
  execSync('git add -A && git commit -m "theirs changes"', { cwd: repoDir });

  execSync('git checkout -', { cwd: repoDir });
  fs.cpSync(path.join(MERGE_FIXTURE, 'ours'), repoDir, { force: true, recursive: true });
  execSync('git add -A && git commit -m "ours changes"', { cwd: repoDir });

  try {
    execSync('git merge feature --no-edit', { cwd: repoDir });
  } catch {
    // Expected: the map conflicts on the `archive` line
  }

  fs.writeFileSync(
    path.join(repoDir, SOLUTION_FILE),
    `${JSON.stringify({ folders: [{ path: repoDir }], views: { landscapes: { path: 'landscapes' } } }, null, 2)}\n`,
  );
  return repoDir;
}

describe('git-cruiser/landscape-merge', () => {
  let studioAgent: StudioAgent;
  let repoDir: string;

  const git = (command: string): string => execSync(command, { cwd: repoDir }).toString();

  const openResolver = async (): Promise<void> => {
    await studioAgent.executeCommand('git.test.openMergeResolver');
    await studioAgent.assertVisible(MERGE_OURS, TIMEOUT);
  };

  const accept = async (key: string, side: 'ours' | 'theirs'): Promise<void> => {
    await studioAgent.clickOn(`${conflictEntry(key)} [data-test--landscape-merge-accept-${side}]`);
    await studioAgent.assertVisible(`${conflictEntry(key)} [data-test--landscape-merge-undo]`, TIMEOUT);
  };

  const isResolveAndStageEnabled = async (): Promise<boolean> => {
    for (const button of await studioAgent.$$('.editor-toolbar__button')) {
      if ((await button.getText()).includes('Resolve & Stage')) {
        return !((await button.getAttribute('class')) ?? '').includes('editor-toolbar__button--disabled');
      }
    }
    return false;
  };

  const element = (map: LandscapeMap, id: string): any => map.elements.find((candidate) => candidate.id === id);

  beforeEach(async ({ task }) => {
    repoDir = createLandscapeMergeConflictRepo();
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    await studioAgent.openSolutionFile(path.join(repoDir, SOLUTION_FILE));
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
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('offers the merge resolver for the conflicted map in the Git pane', async () => {
    const mergeState = await studioAgent.executeCommand<{ conflictedFiles: string[] } | null>(
      'git.test.getMergeState',
      [repoDir],
    );
    assert.deepStrictEqual(mergeState?.conflictedFiles, [MAP_PATH]);

    await studioAgent.navigation.showLeftPane('design/source/git');
    await studioAgent.assertGitPaneVisible();
    await studioAgent.clickOn(`[data-test--git-pane] [data-test--tree-entry-uri$="${MAP_PATH}"]`);
    await studioAgent.assertVisible(MERGE_OURS, TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('shows both maps, the result and the merge pane', async () => {
    await openResolver();

    await studioAgent.assertVisible(`${MERGE_OURS} .djs-container`, TIMEOUT);
    await studioAgent.assertVisible(`${MERGE_THEIRS} .djs-container`, TIMEOUT);
    await studioAgent.assertVisible(`${MERGE_RESULT} .djs-container`, TIMEOUT);
    await studioAgent.assertVisible('[data-test--landscape-merge-relation-hint]', TIMEOUT);
    await studioAgent.assertVisible(MERGE_PANE, TIMEOUT);
    // `returns` is removed by theirs while ours connects to it, so the removal is a conflict as well
    for (const key of ['archive', 'returns', 'payment-to-returns']) {
      await studioAgent.assertVisible(conflictEntry(key), TIMEOUT);
    }

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('lists the changes that merged without a conflict as auto-applied', async () => {
    await openResolver();

    for (const key of ['draft', 'memo']) {
      await studioAgent.assertVisible(autoAppliedEntry(key), TIMEOUT);
    }
    for (const key of ['billing', 'returns']) {
      assert.strictEqual(await studioAgent.getElementCount(autoAppliedEntry(key)), 0);
    }

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('does not offer to stage a result whose connector points to a removed element', async () => {
    await openResolver();

    await accept('archive', 'ours');
    await accept('returns', 'theirs');
    await accept('payment-to-returns', 'ours');
    await studioAgent.assertVisible('[data-test--landscape-merge-invalid]', TIMEOUT);
    assert.strictEqual(await isResolveAndStageEnabled(), false);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('stages a readable map with both sides’ changes once every conflict is resolved', async () => {
    await openResolver();

    await accept('archive', 'ours');
    assert.strictEqual(await isResolveAndStageEnabled(), false);
    await accept('returns', 'theirs');
    await accept('payment-to-returns', 'theirs');
    await studioAgent.waitUntil(isResolveAndStageEnabled, {
      timeout: TIMEOUT,
      timeoutMsg: 'Expected Resolve & Stage to be enabled',
    });

    await studioAgent.clickMergeToolbarButton('Resolve & Stage');
    await studioAgent.waitUntil(() => git('git diff --name-only --diff-filter=U').trim() === '', {
      timeout: TIMEOUT,
      timeoutMsg: `Expected ${MAP_PATH} to be staged`,
    });

    const staged = await parseLandscapeMap(git(`git show :${MAP_PATH}`));
    assert.ok(staged.ok, staged.ok ? '' : staged.errors.join('\n'));
    assert.strictEqual(element(staged.map, 'archive').label, 'Records');
    assert.strictEqual(element(staged.map, 'billing').label, 'Invoicing');
    assert.strictEqual(element(staged.map, 'memo').text, 'Remember the vault');
    assert.strictEqual(element(staged.map, 'draft').x, 400);
    assert.strictEqual(element(staged.map, 'returns'), undefined);
    assert.deepStrictEqual(
      staged.map.connectors.map((connector) => connector.id),
      ['pays-into-archive'],
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('shows the conflict state in the map editor', async () => {
    await studioAgent.openUriAsDocument(`file://${path.join(repoDir, MAP_PATH)}`);
    await studioAgent.navigation.assertActivePage('discover/landscapes');
    await studioAgent.assertVisible('[data-test--landscape-open-merge-resolver]', TIMEOUT);
    assert.strictEqual(await studioAgent.getElementCount('[data-test--landscape-canvas]'), 0);

    await studioAgent.clickOn('[data-test--landscape-open-merge-resolver]');
    await studioAgent.assertVisible(MERGE_OURS, TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
