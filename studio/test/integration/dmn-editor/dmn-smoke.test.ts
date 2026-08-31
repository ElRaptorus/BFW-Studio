import * as fs from 'fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

describe('dmn/smoke', () => {
  let studioAgent: StudioAgentDmnExtension;

  beforeAll(async () => {
    fs.mkdirSync('tmp', { recursive: true });
    studioAgent = await createAndStartStudioAgentDmnExtension({ testName: 'setup', testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
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

  it('dmn/smoke/open: should open a ".dmn" file and render the DRD', async () => {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/smoke/view-switcher: should show the view switcher with multiple views', async () => {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.assertViewSwitcherVisible();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/smoke/export: should export the current document as SVG image', async () => {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...'svg'.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...'tmp/test-export-dmn.svg'.split(''), 'enter']);

    await studioAgent.assertFileWasCreatedAndIsNotEmpty('tmp/test-export-dmn.svg');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/smoke/export: should export the current document as DMN document copy', async () => {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...'dmn'.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...'tmp/test-export-dmn.dmn'.split(''), 'enter']);

    await studioAgent.assertFileWasCreatedAndIsNotEmpty('tmp/test-export-dmn.dmn');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/smoke/search: should find DMN elements via global search', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.typeInGoToSymbol('Discount');
    await studioAgent.waitUntil(
      async () => {
        const resultText = await studioAgent.getText('.quick-jump');
        return resultText.includes('Discount');
      },
      {
        timeout: ASSERT_VISIBLE_TIMEOUT,
        timeoutMsg: 'Expected Go to Symbol results to contain "Discount"',
      },
    );

    await studioAgent.sendKeyboardInput(['Escape']);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
