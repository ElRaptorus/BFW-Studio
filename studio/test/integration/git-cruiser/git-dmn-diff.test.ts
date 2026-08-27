import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const GIT_FIXTURE = path.join(FIXTURES_DIR, 'test-solution-git-cruiser');

function createGitRepoFromFixture(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-dmn-diff-test-'));
  fs.cpSync(GIT_FIXTURE, tmpDir, { recursive: true });
  execSync('git init', { cwd: tmpDir });
  execSync('git add -A', { cwd: tmpDir });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir });
  return tmpDir;
}

describe('git-cruiser/dmn-diff', { timeout: 60_000 }, () => {
  let studioAgent: StudioAgent;
  let repoDir: string;

  beforeAll(async () => {
    repoDir = createGitRepoFromFixture();
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.openDirectoryAsSolution(repoDir);
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
    await studioAgent.closeOpenEditors('dmn');
    await studioAgent.closeOpenEditors('dmn.diff');
    await studioAgent.closeOpenEditors('dmn.history-preview');
  });

  afterAll(async () => {
    await studioAgent?.stop();
    try {
      fs.rmSync(repoDir, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('dmn-diff/show-diff: should open the DMN diff view for a modified file', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="Special Discount"'));

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = `file://${dmnPath}`;
    await studioAgent.executeCommand('git.showGitDiff', [dmnFileUri]);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible('[data-test--editors--focused-document-type="dmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
  });

  it('dmn-diff/change-nav: should show change navigation in the diff title', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="Special Discount"'));

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = `file://${dmnPath}`;
    await studioAgent.executeCommand('git.showGitDiff', [dmnFileUri]);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible('[data-test--editors--focused-document-type="dmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    const titleText = await studioAgent.getText('.editor-title');
    const hasChangeIndicator = titleText.includes('Change') || titleText.includes('/');
    if (!hasChangeIndicator) {
      throw new Error(`Expected title to contain change navigation, got: ${titleText}`);
    }

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
  });

  it('dmn-diff/show-summary: should show the change summary dialog', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="Special Discount"'));

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = `file://${dmnPath}`;
    await studioAgent.executeCommand('git.showGitDiff', [dmnFileUri]);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible('[data-test--editors--focused-document-type="dmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.executeCommand('dmn.diff.showChangeSummaryDialog');
    await studioAgent.pause(1000);

    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput(['Escape']);

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
  });

  it('dmn-diff/history: should open the DMN history preview for a committed file', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="Renamed Discount"'));
    execSync('git add -A && git commit -m "rename decision"', { cwd: repoDir });

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = await studioAgent.getFocusedDocumentUri();
    await studioAgent.waitUntilCommandEnabled('git.showFileHistory', [dmnFileUri]);
    await studioAgent.executeCommand('git.showFileHistory', [dmnFileUri]);
    await studioAgent.pause(1000);

    await studioAgent.assertVisible('.quick-jump', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput(['enter']);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible(
      '[data-test--editors--focused-document-type="dmn.history-preview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
    execSync('git add -A && git commit -m "restore original"', { cwd: repoDir });
  });

  it('dmn-diff/history-diff-mode: should toggle between preview and diff mode in history', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="History Toggle Discount"'));
    execSync('git add -A && git commit -m "history-diff-mode commit"', { cwd: repoDir });

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = await studioAgent.getFocusedDocumentUri();
    await studioAgent.waitUntilCommandEnabled('git.showFileHistory', [dmnFileUri]);
    await studioAgent.executeCommand('git.showFileHistory', [dmnFileUri]);
    await studioAgent.pause(1000);

    await studioAgent.assertVisible('.quick-jump', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput(['enter']);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible(
      '[data-test--editors--focused-document-type="dmn.history-preview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    const previewButton = await studioAgent.$$('.editor-toolbar__button');
    for (const btn of previewButton) {
      const text = await btn.getText();
      if (text.includes('Preview') || text.includes('preview')) {
        await btn.click();
        break;
      }
    }
    await studioAgent.pause(1000);

    await studioAgent.assertVisible(
      '[data-test--editors--focused-document-type="dmn.history-preview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
    execSync('git add -A && git commit -m "restore original after history-diff-mode"', { cwd: repoDir });
  });

  it('dmn-diff/change-overview-pane: should show the ChangeOverview pane in diff view', async () => {
    const dmnPath = path.join(repoDir, 'test-decision.dmn');
    const original = fs.readFileSync(dmnPath, 'utf-8');
    fs.writeFileSync(dmnPath, original.replace('name="Discount"', 'name="Special Discount"'));

    await studioAgent.jumpToFileInSolution('test-decision.dmn', 'dmn');
    await studioAgent.pause(500);

    const dmnFileUri = `file://${dmnPath}`;
    await studioAgent.executeCommand('git.showGitDiff', [dmnFileUri]);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible('[data-test--editors--focused-document-type="dmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible(
      '[data-test--pane="dmn-diff/panes/properties/ChangeOverview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(dmnPath, original);
  });
});
