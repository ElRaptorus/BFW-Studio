import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const GIT_FIXTURE = path.join(FIXTURES_DIR, 'test-solution-git-cruiser');

const TEXT_DIFF_DOCUMENT = '[data-test--editors--focused-document-type="git.text-diff"]';

function createGitRepoFromFixture(): string {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-text-diff-test-'));
  fs.cpSync(GIT_FIXTURE, temporaryDirectory, { recursive: true });
  fs.writeFileSync(path.join(temporaryDirectory, 'settings.json'), '{\n  "retries": 1\n}\n');
  fs.writeFileSync(path.join(temporaryDirectory, 'obsolete.json'), '{\n  "unused": true\n}\n');
  fs.writeFileSync(path.join(temporaryDirectory, 'data.bin'), Buffer.from([0, 1, 2, 3, 0]));
  execSync('git init -q -b main', { cwd: temporaryDirectory });
  execSync('git config user.email "test@example.com" && git config user.name "Test"', { cwd: temporaryDirectory });
  execSync('git config commit.gpgsign false', { cwd: temporaryDirectory });
  execSync('git add -A && git commit -q -m "Initial commit"', { cwd: temporaryDirectory });
  return temporaryDirectory;
}

describe('git-cruiser/text-diff', () => {
  let studioAgent: StudioAgent;
  let repositoryDirectory: string;

  async function clickGitPaneRow(fileName: string): Promise<void> {
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
    await studioAgent.navigation.showLeftPane('design/source/git');
    await studioAgent.assertGitPaneVisible();

    const row = `[data-test--git-pane] [data-test--tree-entry-uri$="/${fileName}"]`;
    await studioAgent.assertVisible(row, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn(row);
    await studioAgent.assertVisible(TEXT_DIFF_DOCUMENT, ASSERT_VISIBLE_TIMEOUT);
  }

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
    await studioAgent.closeOpenEditors('git.text-diff');
    execSync('git checkout -q -- . && git clean -q -fd', { cwd: repositoryDirectory });
  });

  afterAll(async () => {
    await studioAgent?.stop();
    try {
      fs.rmSync(repositoryDirectory, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('text-diff/modified: a click on a changed JSON file opens the text diff', async () => {
    fs.writeFileSync(path.join(repositoryDirectory, 'settings.json'), '{\n  "retries": 3\n}\n');

    await clickGitPaneRow('settings.json');
    await studioAgent.assertVisible('[data-test--text-diff]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('text-diff/new-file: a click on a new file opens the text diff with an empty before side', async () => {
    fs.writeFileSync(path.join(repositoryDirectory, 'created.json'), '{\n  "created": true\n}\n');

    await clickGitPaneRow('created.json');
    await studioAgent.assertVisible('[data-test--text-diff]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('text-diff/deleted-file: a click on a deleted file opens the text diff with an empty after side', async () => {
    fs.rmSync(path.join(repositoryDirectory, 'obsolete.json'));

    await clickGitPaneRow('obsolete.json');
    await studioAgent.assertVisible('[data-test--text-diff]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('text-diff/binary: a binary file shows a notice instead of a diff', async () => {
    fs.writeFileSync(path.join(repositoryDirectory, 'data.bin'), Buffer.from([0, 9, 8, 7, 0]));

    await clickGitPaneRow('data.bin');
    await studioAgent.assertVisible('[data-test--text-diff-notice]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNotVisible('[data-test--text-diff]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
