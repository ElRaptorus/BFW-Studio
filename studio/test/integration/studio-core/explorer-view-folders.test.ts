import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const TEMPORARY_ROOT = path.join(__dirname, '..', '..', '..', 'tmp');
const DESIGNER_TREE = '[data-test--tree="std/file-explorer/design"]';
const MAP_XML =
  '<landscape:map xmlns:landscape="https://bifrostforge.world/schema/landscape" version="1" name="Overview" />\n';

describe('explorer view folders', () => {
  let studioAgent: StudioAgent;
  let workspace: string;
  let solutionFile: string;

  const uriOf = (relativePath: string): string => `file://${path.join(workspace, relativePath)}`;

  const landscapesView = (): unknown => JSON.parse(fs.readFileSync(solutionFile, 'utf8')).views?.landscapes;

  const notificationTexts = async (): Promise<string[]> =>
    (await studioAgent.executeInRenderer(
      'return bifrost.notifications.getAllNotifications().map((notification) => String(notification.options.content))',
    )) as string[];

  const dialogText = async (): Promise<string> => studioAgent.getText('[data-test--dialog]');

  beforeEach(async ({ task }) => {
    // Not `os.tmpdir()`: deleting moves to the trash, and the desktop trash refuses items on a tmpfs `/tmp`.
    fs.mkdirSync(TEMPORARY_ROOT, { recursive: true });
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(TEMPORARY_ROOT, 'bfw-view-folders-')));
    fs.mkdirSync(path.join(workspace, 'docs', 'landscapes'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'docs', 'landscapes', 'Overview.bfwmap'), MAP_XML);
    fs.writeFileSync(path.join(workspace, 'docs', 'notes.md'), '# Notes\n');
    solutionFile = path.join(workspace, 'ViewFolders.bfwsln');
    fs.writeFileSync(
      solutionFile,
      `${JSON.stringify({ folders: [{ path: workspace }], views: { landscapes: { path: 'docs/landscapes' } } }, null, 2)}\n`,
    );

    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openSolutionFile(solutionFile);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('the Designer shows the landscape folder read-only', async () => {
    const folderSelector = `${DESIGNER_TREE} [data-test--tree-entry-uri="${uriOf('docs/landscapes')}"]`;
    await studioAgent.clickOn(`${DESIGNER_TREE} [data-test--tree-entry-uri="${uriOf('docs')}"]`);
    await studioAgent.rightClickOn(folderSelector);
    await studioAgent.assertContextMenuVisible();
    for (const entry of ['rename', 'delete', 'new-file', 'new-directory']) {
      expect(
        await studioAgent.getElementCount(`[data-test--context-menu-id="std/file-explorer/directory/${entry}"]`),
      ).toBe(0);
    }
    await studioAgent.sendKeyboardInput(['Escape']);

    await studioAgent.executeCommand('std.solution.renameFileOrDirectory', [
      uriOf('docs/landscapes/Overview.bfwmap'),
      'design',
    ]);
    await studioAgent.waitUntil(
      async () => (await notificationTexts()).some((content) => content.includes('which is read-only here')),
      { timeout: TIMEOUT, timeoutMsg: 'Renaming a map in the Designer was not refused' },
    );
    expect(fs.existsSync(path.join(workspace, 'docs', 'landscapes', 'Overview.bfwmap'))).toBe(true);
  });

  it('deleting a parent of the landscape folder asks in a danger dialog and keeps the entry', async () => {
    await studioAgent.executeCommandWithoutBlocking('std.solution.deleteSelectedElementsInFileExplorer', [
      [uriOf('docs')],
      'design',
    ]);
    await studioAgent.waitUntilDialogActive();
    expect(await dialogText()).toContain('Delete the landscapes folder?');
    await studioAgent.submitActiveDialog('cancel');
    await studioAgent.pause(500);
    expect(fs.existsSync(path.join(workspace, 'docs', 'landscapes'))).toBe(true);

    await studioAgent.executeCommandWithoutBlocking('std.solution.deleteSelectedElementsInFileExplorer', [
      [uriOf('docs')],
      'design',
    ]);
    await studioAgent.waitUntilDialogActive();
    await studioAgent.submitActiveDialog('confirm');
    await studioAgent.waitUntil(async () => !fs.existsSync(path.join(workspace, 'docs')), {
      timeout: TIMEOUT,
      timeoutMsg: 'docs was not deleted',
    });
    expect(landscapesView()).toEqual({ path: 'docs/landscapes' });
  });

  it('renaming a parent of the landscape folder moves the declared path along', async () => {
    await studioAgent.executeCommandWithoutBlocking('std.solution.renameFileOrDirectory', [uriOf('docs'), 'design']);
    await studioAgent.waitUntilDialogActive();
    await studioAgent.submitActiveDialog('submit', { name: 'documentation' });
    await studioAgent.waitUntil(
      async () => (await dialogText().catch(() => '')).includes('Rename the landscapes folder?'),
      {
        timeout: TIMEOUT,
        timeoutMsg: 'The danger dialog did not open for the rename',
      },
    );
    await studioAgent.submitActiveDialog('confirm');

    await studioAgent.waitForJsonFileValue(solutionFile, 'views', { landscapes: { path: 'documentation/landscapes' } });
    expect(fs.existsSync(path.join(workspace, 'documentation', 'landscapes', 'Overview.bfwmap'))).toBe(true);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
