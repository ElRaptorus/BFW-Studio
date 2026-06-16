import * as assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

describe('solution', { timeout: 30_000 }, () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
  });

  it('solution/explorer: should open a directory as solution', async () => {
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('solution/explorer: should toggle hidden files', async () => {
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

    const itemCountBefore = await studioAgent.getElementCount(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry',
    );

    await studioAgent.openViaCommandSearch('toggle hidden files');

    await studioAgent.waitForSolutionEntryCountChanged(itemCountBefore);

    const itemCountAfter = await studioAgent.getElementCount(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry',
    );

    assert.ok(itemCountAfter > itemCountBefore);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('solution/explorer: should open first document via click', async () => {
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

    await studioAgent.clickOn('[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--depth-0');
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('solution/quick-jump: should open document via quick jump', async () => {
    await studioAgent.openFixturesDirectoryAsSolutionAndJumpToFile('test-solution-simple', 'call_activity_test.bpmn');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('solution/search: should open document via search', async () => {
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

    await studioAgent.leftMenuBar.togglePane('pane/left/search');
    await studioAgent.assertPaneVisible('pane/left/search');

    await studioAgent.sendKeyboardInput([...'Start Event'.split(''), 'enter']);

    await studioAgent.clickOn('.treeview__entry--depth-1');
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('solution/navigator: should correctly navigate back and forth between open documents', async () => {
    const FIXTURE_NAME = 'test-solution-navigator';
    const fixtureUri = studioAgent.getFixturesFileUri(FIXTURE_NAME, '001.bpmn');
    await studioAgent.openFixturesDirectoryAsSolution(FIXTURE_NAME);

    await studioAgent.openViaQuickJump('001.bpmn');
    await studioAgent.pause(500);
    await studioAgent.openViaQuickJump('002.bpmn');
    await studioAgent.pause(500);
    await studioAgent.openViaQuickJump('003.bpmn');
    await studioAgent.pause(500);

    await studioAgent.navigateBack();
    await studioAgent.pause(500);

    await studioAgent.openViaCommandSearch('Settings (JSON)');
    await studioAgent.pause(500);

    await studioAgent.navigateBack();
    await studioAgent.pause(500);
    await studioAgent.navigateBack();
    await studioAgent.pause(500);

    await studioAgent.assertDocumentIsFocused(fixtureUri);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
