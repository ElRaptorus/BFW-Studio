import { createEmptyLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { LandscapeWorkspace } from './landscapeWorkspace';
import { createLandscapeWorkspace } from './landscapeWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const MAPS_PANE = 'discover/landscapes/maps';
const PROCESSES_PANE = '[data-test--pane="discover/landscapes/landscapes"]';
const MAPS_TREE = '[data-test--tree="std/file-explorer/landscapes"]';
const hint = (state: string): string => `[data-test--landscape-folder-hint="${state}"]`;

describe('bpmn-landscape/landscape-folder', () => {
  let studioAgent: StudioAgent;
  let landscapeWorkspace: LandscapeWorkspace;

  const writeMap = (relativePath: string): void => {
    const mapPath = path.join(landscapeWorkspace.landscapeFolder, relativePath);
    fs.mkdirSync(path.dirname(mapPath), { recursive: true });
    fs.writeFileSync(mapPath, serializeLandscapeMap(createEmptyLandscapeMap(path.basename(mapPath, '.bfwmap'))));
  };

  const notificationTexts = async (): Promise<string[]> =>
    (await studioAgent.executeInRenderer(
      'return bifrost.notifications.getAllNotifications().map((notification) => String(notification.options.content))',
    )) as string[];

  const waitForNotification = async (text: string): Promise<void> => {
    await studioAgent.waitUntil(async () => (await notificationTexts()).some((content) => content.includes(text)), {
      timeout: TIMEOUT,
      timeoutMsg: `No notification contained "${text}"`,
    });
  };

  const start = async (testName: string): Promise<void> => {
    studioAgent = await createAndStartStudioAgent({ testName, testFile: __filename });
  };

  const openSolutionAndShowMaps = async (): Promise<void> => {
    await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    await studioAgent.navigation.showLeftPane(MAPS_PANE);
  };

  beforeEach(async ({ task }) => {
    landscapeWorkspace = createLandscapeWorkspace('bfw-landscape-folder-', {
      declareLandscapeFolder: !task.name.includes('without a landscape folder'),
    });
    await start(task.name);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    fs.rmSync(landscapeWorkspace.workspace, { recursive: true, force: true });
  });

  it('a folder opened as a solution asks to be saved as a solution first', async () => {
    await studioAgent.openDirectoryAsSolution(landscapeWorkspace.workspace);
    await studioAgent.navigation.showLeftPane(MAPS_PANE);

    await studioAgent.assertVisible(hint('unsaved'), TIMEOUT);
    await studioAgent.assertVisible('button=Convert to Solution…', TIMEOUT);
    expect(await studioAgent.getElementCount(hint('unsaved'))).toBe(1);
    expect(await studioAgent.getElementCount(PROCESSES_PANE)).toBe(0);
  });

  it('closing the solution closes its open maps', async () => {
    writeMap('Overview.bfwmap');
    await openSolutionAndShowMaps();
    await studioAgent.assertVisible(PROCESSES_PANE, TIMEOUT);
    const mapUri = `file://${path.join(landscapeWorkspace.landscapeFolder, 'Overview.bfwmap')}`;
    await studioAgent.executeCommandWithoutBlocking('std.editor.focusOrOpenDocument', [mapUri]);
    await studioAgent.waitUntil(async () => (await studioAgent.getFocusedDocumentUri()) === mapUri, {
      timeout: TIMEOUT,
      timeoutMsg: 'The map did not open',
    });

    await studioAgent.closeSolutionViaApi();

    await studioAgent.waitUntil(async () => (await studioAgent.getFocusedDocumentUri()) === '', {
      timeout: TIMEOUT,
      timeoutMsg: 'The map stayed open after the solution was closed',
    });
    await studioAgent.assertVisible(hint('no-solution'), TIMEOUT);
    expect(await studioAgent.getElementCount(PROCESSES_PANE)).toBe(0);
  });

  it('a solution without a landscape folder sets it up next to the solution file', async () => {
    await openSolutionAndShowMaps();
    await studioAgent.assertVisible(hint('no-folder'), TIMEOUT);

    await studioAgent.clickOn('button=Set Up Landscape Folder');

    await studioAgent.waitForJsonFileValue(landscapeWorkspace.solutionFile, 'views', {
      landscapes: { path: 'landscapes' },
    });
    expect(fs.existsSync(landscapeWorkspace.landscapeFolder)).toBe(true);
    await studioAgent.assertVisible('button=New Landscape Map', TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('a landscape folder holding a root folder of the solution is refused', async () => {
    await openSolutionAndShowMaps();
    await studioAgent.executeInRenderer(
      `bifrost.dialog.showOpenDirectory = async () => [${JSON.stringify(landscapeWorkspace.workspace)}]`,
    );

    await studioAgent.executeCommandWithoutBlocking('bpmn.landscape.chooseLandscapeFolder', []);

    await waitForNotification('holds a root folder of the solution');
    await studioAgent.waitForJsonFileValue(landscapeWorkspace.solutionFile, 'views', {
      landscapes: { path: 'landscapes' },
    });
  });

  it('a missing landscape folder can be created', async () => {
    fs.rmSync(landscapeWorkspace.landscapeFolder, { recursive: true });
    await openSolutionAndShowMaps();

    await studioAgent.assertVisible('p=The landscape folder landscapes does not exist.', TIMEOUT);
    await studioAgent.clickOn('button=Create Folder');

    await studioAgent.waitUntil(async () => fs.existsSync(landscapeWorkspace.landscapeFolder), {
      timeout: TIMEOUT,
      timeoutMsg: 'The landscape folder was not created',
    });
    await studioAgent.assertVisible('button=New Landscape Map', TIMEOUT);
  });

  it('a map outside the landscape folder is refused', async () => {
    const outsidePath = path.join(landscapeWorkspace.workspace, 'Outside.bfwmap');
    fs.writeFileSync(outsidePath, serializeLandscapeMap(createEmptyLandscapeMap('Outside')));
    await openSolutionAndShowMaps();

    await studioAgent.executeCommandWithoutBlocking('std.editor.focusOrOpenDocument', [`file://${outsidePath}`]);

    await waitForNotification(
      'Landscape maps open only from the landscape folder of the open solution (landscapes). Move this map there or open its solution.',
    );
    expect(await studioAgent.getFocusedDocumentUri()).toBe('');
  });

  it('the Maps explorer lists the maps and offers no structural entries', async () => {
    writeMap('Overview.bfwmap');
    writeMap('archive/Old.bfwmap');
    fs.mkdirSync(path.join(landscapeWorkspace.landscapeFolder, 'empty'));
    await openSolutionAndShowMaps();

    await studioAgent.assertVisible(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/Overview.bfwmap"]`, TIMEOUT);
    await studioAgent.assertVisible(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`, TIMEOUT);
    expect(await studioAgent.getElementCount(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/empty"]`)).toBe(0);
    await studioAgent.assertVisible('[data-test--landscape-new-map]', TIMEOUT);

    await studioAgent.rightClickOn(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`);
    await studioAgent.assertContextMenuVisible();
    await studioAgent.assertVisible(
      '[data-test--context-menu-id="std/file-explorer/directory/new-landscape-map"]',
      TIMEOUT,
    );
    for (const entry of ['new-file', 'new-directory', 'rename', 'delete', 'hide-by-name']) {
      expect(
        await studioAgent.getElementCount(`[data-test--context-menu-id="std/file-explorer/directory/${entry}"]`),
      ).toBe(0);
    }
  });

  it('"New Landscape Map..." saves into the clicked folder', async () => {
    writeMap('archive/Old.bfwmap');
    await openSolutionAndShowMaps();
    await studioAgent.executeInRenderer(
      'bifrost.dialog.showSaveFile = async (options) => options.defaultPath.replace("New Landscape", "Fresh")',
    );

    await studioAgent.rightClickOn(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`);
    await studioAgent.clickOn('[data-test--context-menu-id="std/file-explorer/directory/new-landscape-map"]');

    const expectedPath = path.join(landscapeWorkspace.landscapeFolder, 'archive', 'Fresh.bfwmap');
    await studioAgent.waitUntil(async () => (await studioAgent.getFocusedDocumentUri()) === `file://${expectedPath}`, {
      timeout: TIMEOUT,
      timeoutMsg: 'The new map did not open from the archive folder',
    });
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
