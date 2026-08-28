import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const USER_TASK_ID = 'UserTask_1';
const FORM_BUILDER_FIXTURE = 'form-builder.bpmn';

const USER_TASK_FORM_SUMMARY_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesUserTaskFormSummary"]';

describe('bpmn/form-builder', () => {
  let studioAgent: StudioAgentBpmnExtension;

  async function openBlankUserTaskFormSummary(): Promise<void> {
    await studioAgent.jumpToFileInSolution(FORM_BUILDER_FIXTURE);
    await studioAgent.waitForInteractiveBpmnDocument();
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      USER_TASK_ID,
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
  }

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

  it('bpmn/form-builder: should add a text field from the toolbox and show it on canvas', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="text"]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-canvas-item]');
    await studioAgent.assertVisible('[data-test--field-inspector-label-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--field-inspector-type-select]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should add a form action preset', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-action="confirm"]');
    await studioAgent.assertVisible('[data-test--actions-editor-item]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should switch to preview and render FormRenderer', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="text"]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-tab-preview]');
    await studioAgent.assertVisible('[data-test--form-renderer-action-button]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('bpmn/form-builder: should persist fields across close and reopen', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="text"]');
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.executeCommand('std.editor.closeFocusedDocument');
    await studioAgent.waitForInteractiveBpmnDocument();
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      USER_TASK_ID,
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--form-summary-edit-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--form-canvas-item]', ASSERT_VISIBLE_TIMEOUT);
  });
});
