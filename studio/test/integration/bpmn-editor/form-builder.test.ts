import assert from 'node:assert';
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

  it('bpmn/form-builder: should show abort effect and skips validation only for submit', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-action="abort"]');
    await studioAgent.clickOn('[data-test--actions-editor-item]');
    await studioAgent.assertVisible('[data-test--action-inspector-effect="abort"]', ASSERT_VISIBLE_TIMEOUT);

    const abortChecked = await studioAgent.getAttribute('[data-test--action-inspector-effect="abort"]', 'checked');
    assert.equal(abortChecked, 'true');
    await studioAgent.assertNotVisible('[data-test--action-inspector-skips-validation]');

    await studioAgent.clickOn('[data-test--action-inspector-effect="submit"]');
    await studioAgent.assertVisible('[data-test--action-inspector-skips-validation]', ASSERT_VISIBLE_TIMEOUT);
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

  it('bpmn/form-builder: should add dropdown, toggle, and section header fields', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="dropdown"]');
    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="toggle"]');
    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="section_header"]');

    const canvasItems = await studioAgent.getTestDriver().client!.$$('[data-test--form-canvas-item]');
    assert.equal(canvasItems.length, 3);
  });

  it('bpmn/form-builder: should store field types, required flags and the pattern rule', async () => {
    await openBlankUserTaskFormSummary();

    await studioAgent.clickOn('[data-test--form-summary-create-button]');
    await studioAgent.assertVisible('[data-test--form-builder-tab-design]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="dropdown"]');
    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="toggle"]');
    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="section_header"]');
    await studioAgent.clickOn('[data-test--form-builder-toolbox-field="text"]');

    const canvasItems = await studioAgent.getTestDriver().client!.$$('[data-test--form-canvas-item]');
    assert.equal(canvasItems.length, 4);
    await canvasItems[3].click();
    await studioAgent.assertVisible('[data-test--field-inspector-pattern-input]', ASSERT_VISIBLE_TIMEOUT);
    // Set the value through the native setter so React's onChange fires; `^` and `$` are awkward to type.
    await studioAgent.executeInRenderer(
      `const input = document.querySelector('[data-test--field-inspector-pattern-input]');
       Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '^[a-z]+$');
       input.dispatchEvent(new Event('input', { bubbles: true }));`,
    );

    await studioAgent.waitUntil(
      async () => {
        const fields = await studioAgent.getUserTaskFormFieldDefinitions(FORM_BUILDER_FIXTURE, USER_TASK_ID);
        return fields.length === 4 && fields[3].validationRules != null;
      },
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: 'The pattern rule was not stored on the text field' },
    );

    const fields = await studioAgent.getUserTaskFormFieldDefinitions(FORM_BUILDER_FIXTURE, USER_TASK_ID);
    assert.deepEqual(
      fields.map((field) => field.type),
      ['dropdown', 'toggle', 'section_header', 'text'],
    );
    for (const field of fields) {
      assert.equal(typeof field.required, 'boolean');
    }
    assert.deepEqual(fields[3].validationRules, [{ type: 'pattern', value: '^[a-z]+$' }]);
  });
});
