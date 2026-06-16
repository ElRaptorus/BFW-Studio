import * as fs from 'fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const CREATE_NEW_DOCUMENT = OsSpecificKeystroke('cmd-n', 'ctrl-n');

describe('bpmn/smoke', { timeout: 120_000 }, () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    fs.mkdirSync('tmp', { recursive: true });
    studioAgent = await createAndStartStudioAgentBpmnExtension({ testName: 'setup', testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
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
    await studioAgent.closeOpenEditors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('bpmn/smoke/export: should export the current document as PNG image', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`png`.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`tmp/test-export-bpmn.png`.split(''), 'enter']);

    await studioAgent.assertFileWasCreatedAndIsNotEmpty('tmp/test-export-bpmn.png');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/smoke/export: should export the current document as SVG image', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`svg`.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`tmp/test-export-bpmn.svg`.split(''), 'enter']);

    await studioAgent.assertFileWasCreatedAndIsNotEmpty('tmp/test-export-bpmn.svg');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/smoke/export: should export the current document as BPMN document', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`bpmn`.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.sendKeyboardInput([...`tmp/test-export-bpmn.bpmn`.split(''), 'enter']);

    await studioAgent.assertFileWasCreatedAndIsNotEmpty('tmp/test-export-bpmn.bpmn');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/smoke/contextmenu: should show contextmenu for a call activity', async () => {
    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('CallActivity_1');
    await studioAgent.rightClickBpmnElementById('CallActivity_1');

    await studioAgent.assertContextMenuVisible(2000);

    await studioAgent.assertNoErrorsPresent();
  });

  it('bpmn/smoke/contextmenu: should show contextmenu for a call activity without open solution', async () => {
    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('CallActivity_1');
    await studioAgent.rightClickBpmnElementById('CallActivity_1');

    await studioAgent.assertContextMenuVisible(2000);

    await studioAgent.assertNoErrorsPresent();
  });
});
