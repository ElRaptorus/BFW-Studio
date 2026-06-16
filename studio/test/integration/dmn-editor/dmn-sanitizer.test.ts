import * as fs from 'fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

describe('dmn/sanitizer', { timeout: 120_000 }, () => {
  let studioAgent: StudioAgentDmnExtension;

  beforeAll(async () => {
    fs.mkdirSync('tmp', { recursive: true });
    studioAgent = await createAndStartStudioAgentDmnExtension({ testName: 'setup', testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-sanitizer');
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
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('dmn/sanitizer/badge: should show sanitizer badge when opening a haunted DMN', async () => {
    await studioAgent.jumpToFileInSolution('haunted-dmn.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.pause(1000);
    await studioAgent.assertVisible('.sanitizer-badge', ASSERT_VISIBLE_TIMEOUT);
  });

  it('dmn/sanitizer/badge-severity: should show error-level badge for ghost elements', async () => {
    await studioAgent.jumpToFileInSolution('haunted-dmn.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.pause(1000);
    await studioAgent.assertVisible('.sanitizer-badge--error', ASSERT_VISIBLE_TIMEOUT);
  });

  it('dmn/sanitizer/inspector: should open sanitizer in inspector via command search', async () => {
    await studioAgent.jumpToFileInSolution('haunted-dmn.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.pause(500);

    await studioAgent.openViaCommandSearch('DMN: Show sanitizer report');
    await studioAgent.pause(1000);

    await studioAgent.assertVisible('.sanitizer-inspector', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('.sanitizer-category', ASSERT_VISIBLE_TIMEOUT);
  });

  it('dmn/sanitizer/fix-all: should show fix all command in command search', async () => {
    await studioAgent.jumpToFileInSolution('haunted-dmn.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.pause(500);

    await studioAgent.openViaCommandSearch('DMN: Fix all structural issues');
    await studioAgent.pause(500);

    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput(['Escape']);
  });

  it('dmn/sanitizer/no-badge: should not show badge for a clean DMN', async () => {
    await studioAgent.jumpToFileInSolution('clean.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.pause(1000);
    await studioAgent.assertNotVisible('.sanitizer-badge', ASSERT_VISIBLE_TIMEOUT);
  });
});
