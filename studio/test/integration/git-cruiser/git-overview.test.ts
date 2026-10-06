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
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-overview-test-'));
  fs.cpSync(GIT_FIXTURE, temporaryDirectory, { recursive: true });
  execSync('git init -b main', { cwd: temporaryDirectory });
  execSync('git config user.email "test@example.com" && git config user.name "Test"', { cwd: temporaryDirectory });
  execSync('git config commit.gpgsign false && git config tag.gpgsign false', { cwd: temporaryDirectory });
  execSync('git add -A', { cwd: temporaryDirectory });
  execSync('git commit -m "Initial commit"', { cwd: temporaryDirectory });
  return temporaryDirectory;
}

// the tests share one repository in a random order, so the current process name is not known
function renameProcess(bpmnXml: string, newName: string): string {
  return bpmnXml.replace(/(<bpmn:process\s[^>]*name=")[^"]*"/, `$1${newName}"`);
}

// an earlier test may have left a diff tab focused on the Source page
async function focusOverview(studioAgent: StudioAgent): Promise<void> {
  await studioAgent.navigation.activatePage('design/source');
  await studioAgent.executeCommand('git.overview.open');
}

async function openOverviewHistory(studioAgent: StudioAgent): Promise<void> {
  await focusOverview(studioAgent);
  await studioAgent.clickOn('[data-test--overview-mode-history]');
  await studioAgent.clickOn('[data-test--overview-refresh]');
  await studioAgent.assertVisible('[data-test--history]', ASSERT_VISIBLE_TIMEOUT);
}

describe('git-cruiser/overview', () => {
  let studioAgent: StudioAgent;
  let repositoryDirectory: string;

  beforeAll(async () => {
    repositoryDirectory = createGitRepoFromFixture();
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.openDirectoryAsSolution(repositoryDirectory);
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
      fs.rmSync(repositoryDirectory, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('overview/tabs: should keep changes, comparison and history in separate tabs', async () => {
    await focusOverview(studioAgent);
    await studioAgent.assertVisible('[data-test--source-overview]', ASSERT_VISIBLE_TIMEOUT);

    // the mode of the document is restored from the previous session
    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');

    // a clean branch says so instead of showing an empty list
    await studioAgent.assertVisible('[data-test--no-changes]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--overview-mode-history]');
    await studioAgent.assertVisible('[data-test--history]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNotVisible('[data-test--no-changes]');

    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    await studioAgent.assertNotVisible('[data-test--history]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('overview/changes: should show a changed model as a row and list the commits', async () => {
    const bpmnPath = path.join(repositoryDirectory, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, renameProcess(original, 'Changed Process'));

    await focusOverview(studioAgent);
    // the tab of the overview is kept between tests
    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    await studioAgent.assertVisible('[data-test--change-row="model"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--overview-mode-history]');
    await studioAgent.assertVisible('[data-test--commit]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    fs.writeFileSync(bpmnPath, original);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('overview/comparison: should compare a branch with its base', async () => {
    execSync('git checkout -b feature', { cwd: repositoryDirectory });
    const bpmnPath = path.join(repositoryDirectory, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, renameProcess(original, 'Feature Process'));
    execSync('git add -A && git commit -m "feature change"', { cwd: repositoryDirectory });

    await focusOverview(studioAgent);
    await studioAgent.clickOn('[data-test--overview-mode-comparison]');
    await studioAgent.assertVisible('[data-test--change-row="model"]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--comparison-hint]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--change-row="model"]');
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();

    execSync('git checkout main', { cwd: repositoryDirectory });
  });

  it('git-pane/row-click-and-title: a click opens the diff and the wand suggests a title', async () => {
    const bpmnPath = path.join(repositoryDirectory, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, renameProcess(original, 'Wand Process'));

    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
    await studioAgent.navigation.showLeftPane('design/source/git');
    await studioAgent.assertGitPaneVisible();

    const row = '[data-test--git-pane] [data-test--tree-entry-uri$="/test-process.bpmn"]';
    await studioAgent.assertVisible(row, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn(row);
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.stageFileViaApi('test-process.bpmn');
    await studioAgent.pause(1000);
    await studioAgent.navigation.showLeftPane('design/source/git');
    await studioAgent.clickOn('[data-test--git-suggest-title]');
    await studioAgent.pause(1000);

    const title = await studioAgent.getValue('[data-test--git-pane-commit] input');
    assert.ok(String(title).startsWith('Wand Process: '), `Expected a title for "Wand Process", got: ${title}`);

    await studioAgent.assertNoErrorsPresentAndIdle();

    execSync('git reset -q', { cwd: repositoryDirectory });
    fs.writeFileSync(bpmnPath, original);
  });

  it('overview/history-search: finds commits by message, ignoring case', async () => {
    execSync('git commit --allow-empty -m "Zeta marker commit"', { cwd: repositoryDirectory });

    await openOverviewHistory(studioAgent);

    await studioAgent.clickOn('[data-test--history-search]');
    await studioAgent.sendKeyboardInput('ZETA'.split(''));
    await studioAgent.pause(1000);
    const filtered = String(await studioAgent.getText('[data-test--history]'));
    assert.ok(filtered.includes('Zeta marker commit'), `Expected the matching commit, got: ${filtered}`);
    assert.ok(!filtered.includes('Initial commit'), `Expected the other commits to be hidden, got: ${filtered}`);

    await studioAgent.clearTextInput('[data-test--history-search]');
    await studioAgent.sendKeyboardInput('nosuchtextanywhere'.split(''));
    await studioAgent.assertVisible('[data-test--history-no-match]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('[data-test--history-search]');
    await studioAgent.pause(1000);
    // the tests share one repository in a random order, so the oldest commit may be beyond the first page
    await studioAgent.assertNotVisible('[data-test--history-no-match]');
    const everything = String(await studioAgent.getText('[data-test--history]'));
    assert.ok(everything.includes('Zeta marker commit'), `Expected the commits again, got: ${everything}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
  it('overview/history-details: shows merges, tags and commits that are not pushed', async () => {
    const upstreamDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-overview-upstream-'));
    try {
      execSync('git init -q --bare -b main', { cwd: upstreamDirectory });
      execSync(`git remote add origin "${upstreamDirectory}"`, { cwd: repositoryDirectory });
      execSync(
        'git checkout -q -b topic && git commit -q --allow-empty -m "Topic work" && git checkout -q main && ' +
          'git merge -q --no-ff topic -m "Merge branch \'topic\'" && git tag v1.0 && git push -q -u origin main && ' +
          'git commit -q --allow-empty -m "Local only commit"',
        { cwd: repositoryDirectory },
      );

      await studioAgent.openViaCommandSearch('Git: Refresh Status');
      await studioAgent.pause(1000);
      await openOverviewHistory(studioAgent);

      const history = String(await studioAgent.getText('[data-test--history]'));
      assert.ok(history.includes('Merged topic'), `Expected the merged branch, got: ${history}`);
      assert.ok(history.includes('v1.0'), `Expected the tag, got: ${history}`);
      await studioAgent.assertVisible('.source-overview__commit-marker--merge', ASSERT_VISIBLE_TIMEOUT);
      assert.strictEqual(await studioAgent.getElementCount('.source-overview__tag--unpushed'), 1);

      await studioAgent.assertNoErrorsPresentAndIdle();
    } finally {
      fs.rmSync(upstreamDirectory, { recursive: true, force: true });
    }
  });

  it('overview/commit-files: lists the files of a commit and opens their diff and preview', async () => {
    const bpmnPath = path.join(repositoryDirectory, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, renameProcess(original, 'Committed Process'));
    execSync('git add -A && git commit -q -m "Rename in commit"', { cwd: repositoryDirectory });

    await openOverviewHistory(studioAgent);
    await studioAgent.clickOn('[data-test--commit-row]');
    await studioAgent.assertVisible(
      '[data-test--commit-files] [data-test--change-row="model"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--commit-files] [data-test--change-row-preview]');
    await studioAgent.assertVisible(
      '[data-test--editors--focused-document-type="bpmn.history-preview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.assertVisible('[data-test--commit-files]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('[data-test--commit-files] [data-test--change-row="model"]');
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    // the first commit has no parent; its files are still listed
    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.clickOn('[data-test--history-search]');
    await studioAgent.sendKeyboardInput('Initial'.split(''));
    await studioAgent.pause(1000);
    await studioAgent.clickOn('[data-test--commit-row]');
    await studioAgent.assertVisible('[data-test--commit-files] [data-test--change-row]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('[data-test--history-search]');
    await studioAgent.pause(1000);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('overview/help-text: opens the help text to the side', async () => {
    await studioAgent.navigation.activatePage('design/source');
    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.clickOn('[data-test--overview-help]');
    await studioAgent.assertVisible('.help-page', ASSERT_VISIBLE_TIMEOUT);

    const helpText = String(await studioAgent.getText('.help-page'));
    assert.ok(helpText.includes('Current Branch'), `Expected the Source Overview help, got: ${helpText}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('overview/detached-head: still shows the history', async () => {
    execSync('git checkout -q --detach', { cwd: repositoryDirectory });
    try {
      await studioAgent.openViaCommandSearch('Git: Refresh Status');
      await studioAgent.pause(1000);
      await openOverviewHistory(studioAgent);
      await studioAgent.assertVisible('[data-test--commit]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    } finally {
      execSync('git checkout -q main', { cwd: repositoryDirectory });
    }
  });

  it('overview/load-more: appends the next page and then stops offering more', async () => {
    execSync('for i in $(seq 1 105); do git commit -q --allow-empty -m "Bulk commit $i"; done', {
      cwd: repositoryDirectory,
    });
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
    await openOverviewHistory(studioAgent);

    await studioAgent.assertVisible('[data-test--history-load-more]', ASSERT_VISIBLE_TIMEOUT);
    assert.strictEqual(await studioAgent.getElementCount('[data-test--commit]'), 100);

    await studioAgent.clickOn('[data-test--history-load-more]');
    await studioAgent.pause(1500);
    assert.ok((await studioAgent.getElementCount('[data-test--commit]')) > 100, 'Expected the next page to be added');
    await studioAgent.assertNotVisible('[data-test--history-load-more]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
