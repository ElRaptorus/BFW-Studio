import * as assert from 'node:assert';
import * as fs from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const SUBPROCESS_CONTEXT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSubprocessContext"]';
const DEFINITION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesDefinition"]';

describe('bpmn/drilldown', () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    const ctx = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgentBpmnExtension(ctx);
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
    await studioAgent.maximize();
  });

  beforeEach(async ({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    await studioAgent.jumpToFileInSolution('collapsed-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();
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

  it('bpmn/drilldown/command: should use commands to drill into and out of a subprocess', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    const isInSubprocessBefore = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocessBefore, true, 'Should be inside subprocess before drill-up');

    await studioAgent.drillUpFromSubprocess();

    const isInSubprocessAfter = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocessAfter, false, 'Should be back on root plane after drill-up');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/breadcrumbs: should show breadcrumb navigation only when drilling down into a subprocess', async () => {
    await studioAgent.assertBreadcrumbsNotVisible();

    const overlayCount = await studioAgent.getDrilldownOverlayCount();
    assert.ok(overlayCount > 0, `Expected at least one .bjs-drilldown overlay, found ${overlayCount}`);

    await studioAgent.clickDrilldownOverlay('SubProcess_Collapsed');

    await studioAgent.assertBreadcrumbsVisible(ASSERT_VISIBLE_TIMEOUT);

    const items = await studioAgent.$$('[data-test--bpmn-breadcrumb-bar] .bpmn-breadcrumb-bar__item');
    assert.ok((await items.length) >= 2, 'Expected at least 2 breadcrumb items');
    await items[0].click();

    const isInSubprocess = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocess, false, 'Should be back on root plane after clicking process breadcrumb');

    await studioAgent.assertBreadcrumbsNotVisible();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/panes: should switch property panes when drilling into or out of a subprocess', async () => {
    await studioAgent.assertVisible(DEFINITION_PANE, ASSERT_VISIBLE_TIMEOUT);

    const overlayCount = await studioAgent.getDrilldownOverlayCount();
    assert.ok(overlayCount > 0, `Expected at least one .bjs-drilldown overlay, found ${overlayCount}`);

    await studioAgent.clickDrilldownOverlay('SubProcess_Collapsed');

    await studioAgent.assertNotVisible(DEFINITION_PANE);

    await studioAgent.assertVisible(SUBPROCESS_CONTEXT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.drillUpFromSubprocess();

    await studioAgent.assertVisible(DEFINITION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/export: should export the drilled-down subprocess instead of the main diagram', async () => {
    const filename = 'tmp/test-export-bpmn-drilldown.svg';
    fs.rmSync(filename, { force: true });

    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...'svg'.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...filename.split(''), 'enter']);

    await studioAgent.waitUntil(
      async () => fs.existsSync(filename) && fs.readFileSync(filename, 'utf8').includes('</svg>'),
      {
        timeout: ASSERT_VISIBLE_TIMEOUT,
        timeoutMsg: `${filename} was not written`,
      },
    );
    const svg = fs.readFileSync(filename, 'utf8');
    assert.ok(svg.includes('data-element-id="Task_Inside"'), 'The export should contain the subprocess content');
    assert.ok(!svg.includes('data-element-id="StartEvent_1"'), 'The export should not contain the main diagram');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
