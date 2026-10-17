import * as fs from 'fs';
import * as assert from 'node:assert';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TREE_ID = 'std/file-explorer/open-solution';
const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const TEMPORARY_DIRECTORY_NAME = 'explorer-multi-selection-temporary';
const TEMPORARY_DIRECTORY = path.join(FIXTURES_DIR, TEMPORARY_DIRECTORY_NAME);
const FIRST_PROJECT = path.join(TEMPORARY_DIRECTORY, 'first');
const SECOND_PROJECT = path.join(TEMPORARY_DIRECTORY, 'second');
const SOLUTION_FILENAME = path.join(TEMPORARY_DIRECTORY_NAME, 'multi-selection.bfwsln');
const PROCESS_XML = fs.readFileSync(path.join(FIXTURES_DIR, 'test-solution-multi-a', 'process_a1.bpmn'), 'utf8');

function fileUri(projectDirectory: string, filename: string): string {
  return `file://${path.join(projectDirectory, filename)}`;
}

function createTemporarySolution(): void {
  for (const projectDirectory of [FIRST_PROJECT, SECOND_PROJECT]) {
    fs.mkdirSync(projectDirectory, { recursive: true });
  }
  for (const filename of ['a.bpmn', 'b.bpmn', 'c.bpmn']) {
    fs.writeFileSync(path.join(FIRST_PROJECT, filename), PROCESS_XML);
  }
  fs.writeFileSync(path.join(SECOND_PROJECT, 'd.bpmn'), PROCESS_XML);
  fs.writeFileSync(
    path.join(FIXTURES_DIR, SOLUTION_FILENAME),
    JSON.stringify({ folders: [{ path: FIRST_PROJECT }, { path: SECOND_PROJECT }], settings: {} }, null, 2) + '\n',
  );
}

/** Dispatches a click with modifier keys on the tree entry for `uri`; the tree reads the modifiers from the event. */
async function clickEntry(
  studioAgent: StudioAgent,
  uri: string,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean } = {},
): Promise<void> {
  const selector = `[data-test--tree="${TREE_ID}"] [data-test--tree-entry-uri="${uri}"]`;
  await studioAgent.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
  await studioAgent.executeInRenderer(
    `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click', ${JSON.stringify({ bubbles: true, ...modifiers })}))`,
  );
}

async function getSelectedUris(studioAgent: StudioAgent): Promise<string[]> {
  const uris = (await studioAgent.executeInRenderer(
    `return bifrost.views.getById(${JSON.stringify(TREE_ID)}).getSelectedMetadata().map((metadata) => metadata.uri)`,
  )) as string[];
  return [...uris].sort();
}

describe('explorer multi-selection', () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    createTemporarySolution();
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openSolutionFileFromFixtures(SOLUTION_FILENAME);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    fs.rmSync(TEMPORARY_DIRECTORY, { recursive: true, force: true });
  });

  it('Ctrl+Click and Shift+Click select without opening a document', async () => {
    await clickEntry(studioAgent, fileUri(FIRST_PROJECT, 'a.bpmn'), { ctrlKey: true });
    await clickEntry(studioAgent, fileUri(FIRST_PROJECT, 'c.bpmn'), { shiftKey: true });
    await studioAgent.pause(500);

    assert.deepStrictEqual(await getSelectedUris(studioAgent), [
      fileUri(FIRST_PROJECT, 'a.bpmn'),
      fileUri(FIRST_PROJECT, 'b.bpmn'),
      fileUri(FIRST_PROJECT, 'c.bpmn'),
    ]);

    await clickEntry(studioAgent, fileUri(FIRST_PROJECT, 'b.bpmn'), { ctrlKey: true });
    await studioAgent.pause(500);

    assert.deepStrictEqual(await getSelectedUris(studioAgent), [
      fileUri(FIRST_PROJECT, 'a.bpmn'),
      fileUri(FIRST_PROJECT, 'c.bpmn'),
    ]);
    assert.strictEqual(await studioAgent.getFocusedDocumentUri(), '', 'No document should have been opened');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('Delete skips a selected project root and deletes only the selected files', async () => {
    const projectRootSelector = `[data-test--tree="${TREE_ID}"] [data-test--tree-entry-type="project"]`;
    await studioAgent.assertVisible(projectRootSelector, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.executeInRenderer(
      `document.querySelector(${JSON.stringify(projectRootSelector)}).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))`,
    );
    await clickEntry(studioAgent, fileUri(SECOND_PROJECT, 'd.bpmn'), { ctrlKey: true });

    await studioAgent.executeCommandWithoutBlocking('std.solution.deleteSelectedElementsInFileExplorer');
    await studioAgent.waitUntilDialogActive();
    await studioAgent.submitActiveDialog('yes');
    await studioAgent.waitUntil(async () => !fs.existsSync(path.join(SECOND_PROJECT, 'd.bpmn')), {
      timeout: 5_000,
      timeoutMsg: 'd.bpmn was not deleted',
    });

    assert.ok(fs.existsSync(path.join(FIRST_PROJECT, 'a.bpmn')), 'The first project root must stay on disk');
    assert.ok(fs.existsSync(SECOND_PROJECT), 'The second project root must stay on disk');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('Rename is disabled while several items or a project root are selected', async () => {
    await clickEntry(studioAgent, fileUri(FIRST_PROJECT, 'a.bpmn'), { ctrlKey: true });
    assert.strictEqual(await studioAgent.isCommandEnabled('std.solution.renameFileOrDirectory'), true);

    // F2 and Enter run the command through the keybinding mediator, which ignores disabled commands.
    await clickEntry(studioAgent, fileUri(FIRST_PROJECT, 'b.bpmn'), { ctrlKey: true });
    assert.strictEqual(await studioAgent.isCommandEnabled('std.solution.renameFileOrDirectory'), false);

    const projectRootSelector = `[data-test--tree="${TREE_ID}"] [data-test--tree-entry-type="project"]`;
    await studioAgent.executeInRenderer(
      `document.querySelector(${JSON.stringify(projectRootSelector)}).dispatchEvent(new MouseEvent('click', { bubbles: true }))`,
    );
    assert.strictEqual(await studioAgent.isCommandEnabled('std.solution.renameFileOrDirectory'), false);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
