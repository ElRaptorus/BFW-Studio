import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const CREATE_NEW_DOCUMENT = OsSpecificKeystroke('cmd-n', 'ctrl-n');

const USER_TASK_FORM_SUMMARY_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesUserTaskFormSummary"]';

describe('bpmn/form-builder', { timeout: 120_000 }, () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
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

  it('bpmn/form-builder: should open Form Builder from summary pane Create Form button', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should add a text field from toolbox and show it on canvas', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-item]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should select a field and show inspector properties', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-item]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-canvas-item]');
    await studioAgent.assertVisible('[data-test--field-inspector-label-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--field-inspector-type-select]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should add a form action preset', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--actions-editor-add-button]');
    await studioAgent.assertVisible('[data-test--actions-editor-item]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should switch to preview and render FormRenderer', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-item]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-tab-preview]');
    await studioAgent.assertVisible('[data-test--form-renderer-action-button]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should persist fields across close and reopen', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-item]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.closeOpenEditors();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      'UserTask_1',
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-edit-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);
  });
});
