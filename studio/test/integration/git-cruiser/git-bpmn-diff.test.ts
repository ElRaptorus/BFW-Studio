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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-bpmn-diff-test-'));
  fs.cpSync(GIT_FIXTURE, tmpDir, { recursive: true });
  execSync('git init', { cwd: tmpDir });
  execSync('git add -A', { cwd: tmpDir });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir });
  return tmpDir;
}

describe('git-cruiser/bpmn-diff', () => {
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
    await studioAgent.closeOpenEditors('bpmn');
    await studioAgent.closeOpenEditors('bpmn.diff');
    await studioAgent.closeOpenEditors('bpmn.history-preview');
  });

  afterAll(async () => {
    await studioAgent?.stop();
    try {
      fs.rmSync(repoDir, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('bpmn-diff/show-diff: should open the BPMN diff view for a modified file', async () => {
    const bpmnPath = path.join(repoDir, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, original.replace('name="Test Process"', 'name="Modified Process"'));

    await studioAgent.jumpToFileInSolution('test-process.bpmn');
    await studioAgent.pause(500);

    const bpmnFileUri = `file://${bpmnPath}`;
    await studioAgent.executeCommand('git.showGitDiff', [bpmnFileUri]);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn.diff"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(bpmnPath, original);
  });

  it('bpmn-diff/history: should open the BPMN history preview for a committed file', async () => {
    const bpmnPath = path.join(repoDir, 'test-process.bpmn');
    const original = fs.readFileSync(bpmnPath, 'utf-8');
    fs.writeFileSync(bpmnPath, original.replace('name="Test Process"', 'name="Renamed Process"'));
    execSync('git add -A && git commit -m "rename process"', { cwd: repoDir });

    await studioAgent.jumpToFileInSolution('test-process.bpmn');
    await studioAgent.pause(500);

    const bpmnFileUri = await studioAgent.getFocusedDocumentUri();
    await studioAgent.waitUntilCommandEnabled('git.showFileHistory', [bpmnFileUri]);
    await studioAgent.executeCommand('git.showFileHistory', [bpmnFileUri]);
    await studioAgent.pause(1000);

    await studioAgent.assertVisible('.quick-jump', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput(['enter']);
    await studioAgent.pause(2000);

    await studioAgent.assertVisible(
      '[data-test--editors--focused-document-type="bpmn.history-preview"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();

    fs.writeFileSync(bpmnPath, original);
    execSync('git add -A && git commit -m "restore original"', { cwd: repoDir });
  });
});
