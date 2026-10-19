import * as fs from 'fs';
import assert from 'node:assert';
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

  it('dmn/smoke/export: should export the DRD as PNG image', async () => {
    const filename = 'tmp/test-export-dmn.png';
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.rmSync(filename, { force: true });

    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...'png'.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...filename.split(''), 'enter']);

    await studioAgent.waitUntil(
      async () => fs.existsSync(filename) && fs.readFileSync(filename).subarray(0, 8).equals(pngSignature),
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `${filename} is not a PNG image` },
    );
    await studioAgent.waitUntil(async () => (await studioAgent.$$('[data-test--dialog]').length) === 0, {
      timeout: ASSERT_VISIBLE_TIMEOUT,
      timeoutMsg: 'The export hint dialog did not close after the export',
    });

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
