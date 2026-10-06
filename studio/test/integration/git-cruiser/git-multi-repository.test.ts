import { execSync } from 'child_process';
import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

function createGitRepositoryFromFixture(fixtureName: string, parentDirectory: string): string {
  const repositoryDirectory = path.join(parentDirectory, fixtureName);
  fs.cpSync(path.join(FIXTURES_DIR, fixtureName), repositoryDirectory, { recursive: true });
  execSync('git init -b main', { cwd: repositoryDirectory });
  execSync('git config user.email "test@example.com" && git config user.name "Test"', { cwd: repositoryDirectory });
  execSync('git config commit.gpgsign false && git config tag.gpgsign false', { cwd: repositoryDirectory });
  execSync('git add -A', { cwd: repositoryDirectory });
  execSync('git commit -m "Initial commit"', { cwd: repositoryDirectory });
  return repositoryDirectory;
}

function readProblemCounts(viewData: any): { errors: number; warnings: number } {
  const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
  const problemsItem = allItems.find((item: any) => item.id === 'problems');
  assert.ok(problemsItem, 'the problems item should exist in the status bar');
  const [errors, warnings] = problemsItem.content
    .filter((part: any) => part.type === 'text')
    .map((part: any) => Number(part.label));
  return { errors, warnings };
}

describe('git-cruiser/multiple-repositories', () => {
  let studioAgent: StudioAgent;
  let workDirectory: string;
  let secondRepositoryDirectory: string;

  beforeAll(async () => {
    workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-forge-world-multi-repository-test-'));
    const firstRepositoryDirectory = createGitRepositoryFromFixture('test-solution-git-cruiser', workDirectory);
    secondRepositoryDirectory = createGitRepositoryFromFixture('test-solution-sanitizer', workDirectory);

    const solutionFilePath = path.join(workDirectory, 'two-repositories.bfwsln');
    fs.writeFileSync(
      solutionFilePath,
      JSON.stringify({
        folders: [{ path: firstRepositoryDirectory }, { path: secondRepositoryDirectory }],
        settings: {},
      }),
    );

    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.openDirectoryAsSolution(solutionFilePath);
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
      fs.rmSync(workDirectory, { recursive: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('show-in-git-pane: selects the repository that contains the file', async () => {
    const dmnPath = path.join(secondRepositoryDirectory, 'haunted-dmn.dmn');
    fs.writeFileSync(dmnPath, fs.readFileSync(dmnPath, 'utf-8') + '\n<!-- changed -->\n');

    await studioAgent.executeCommand('git.showInGitPane', [`file://${dmnPath}`]);
    await studioAgent.navigation.activatePage('design/source');

    await studioAgent.assertVisible(
      '[data-test--git-pane] [data-test--tree-entry-uri$="/haunted-dmn.dmn"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    await studioAgent.assertVisible('[data-test--change-row="model"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('problems-counter: counts only the focused document', async () => {
    const dmnUri = `file://${path.join(secondRepositoryDirectory, 'haunted-dmn.dmn')}`;
    await studioAgent.executeCommand('std.editor.focusOrOpenDocument', [dmnUri]);

    await studioAgent.waitUntil(
      async () => {
        const counts = readProblemCounts(await studioAgent.getStatusBarViewData());
        return counts.errors + counts.warnings > 0;
      },
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: 'The focused DMN should report problems' },
    );

    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.assertVisible('[data-test--source-overview]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.waitUntil(
      async () => {
        const counts = readProblemCounts(await studioAgent.getStatusBarViewData());
        return counts.errors === 0 && counts.warnings === 0;
      },
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: 'The Source Overview has no problems to count' },
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
