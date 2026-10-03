import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Key } from 'webdriverio';

import type { StudioAgent, TestContext } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const FIXTURE = 'test-solution-deploy';
const PLAN_ROW = '[data-test--deploy-item]';
const label = (fileName: string) => `.treeview__label=${fileName}`;
const planRow = (fileName: string) => `${PLAN_ROW}[data-test--deploy-item$="/${fileName}"]`;

describe('studio/engine-deploy', () => {
  let studioAgent: StudioAgent;
  let currentContext: TestContext;

  beforeAll(async () => {
    currentContext = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgent(currentContext);
    // An absolute path keeps the solution URI equal to the URIs the model scan returns.
    await studioAgent.openDirectoryAsSolution(path.join(__dirname, '..', '..', 'fixtures', FIXTURE));
    await studioAgent.navigation.activatePage('deploy/plan');
  });

  beforeEach(({ task }) => {
    currentContext = { testName: task.name, testFile: __filename };
    studioAgent.updateTestContext(currentContext);
  });

  afterEach(({ task }) => {
    currentContext.state = task.result?.state === 'fail' ? 'failed' : 'passed';
    return studioAgent.recordErrors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('shows the Deploy category with the plan page and its explorer', async () => {
    await studioAgent.assertVisible('.workbench-header__category[data-category-id="deploy"]', TIMEOUT);
    await studioAgent.assertVisible('.workbench-header-container[data-page-id="deploy/plan"]', TIMEOUT);
    await studioAgent.assertPaneVisible('pane/left/deploy-explorer');
    await studioAgent.assertVisible('[data-test--deploy-button]', TIMEOUT);
  });

  it('lists every model file in File mode and only folders in Project mode', async () => {
    for (const fileName of [
      'order-process.bpmn',
      'payment-process.bpmn',
      'draft-process.bpmn',
      'unversioned-process.bpmn',
      'discount-rules.dmn',
    ]) {
      await studioAgent.assertVisible(label(fileName), TIMEOUT);
    }

    await studioAgent.clickOn('[data-test--deploy-explorer-mode="project"]');
    await studioAgent.assertNotVisible(
      '[data-test--tree="engine/deploy-explorer"] [data-test--tree-entry-type="file"]',
    );

    await studioAgent.clickOn('[data-test--deploy-explorer-mode="file"]');
    await studioAgent.assertVisible(label('order-process.bpmn'), TIMEOUT);
  });

  it('builds a plan: Enter adds without renaming, dependencies are added, Deploy is blocked offline', async () => {
    await studioAgent.clickOn(label('order-process.bpmn'));
    await studioAgent.sendKeyboardInput([Key.Enter], false);

    await studioAgent.assertVisible(planRow('order-process.bpmn'), TIMEOUT);
    await studioAgent.assertNotVisible('[data-test--dialog]');
    expect(existsSync(path.join(__dirname, '..', '..', 'fixtures', FIXTURE, 'order-process.bpmn'))).toBe(true);

    await studioAgent.clickOn('[data-test--deploy-add-missing-dependencies]');

    await studioAgent.assertVisible(planRow('payment-process.bpmn'), TIMEOUT);
    await studioAgent.assertVisible(planRow('discount-rules.dmn'), TIMEOUT);
    await studioAgent.assertNotVisible(planRow('draft-process.bpmn'));

    await studioAgent.assertVisible('[data-test--deploy-blocked-reason]', TIMEOUT);
    expect(await studioAgent.getText('[data-test--deploy-blocked-reason]')).toContain('No Engine is selected.');
    expect(await studioAgent.getAttribute('[data-test--deploy-button]', 'disabled')).toBeTruthy();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('F2 in the Design File Explorer still opens the rename dialog', async () => {
    await studioAgent.navigation.showLeftPane('pane/left/explorer');
    await studioAgent.clickOn(label('payment-process.bpmn'));
    await studioAgent.sendKeyboardInput([Key.F2], false);

    await studioAgent.assertVisible('[data-test--dialog]', TIMEOUT);
    await studioAgent.sendKeyboardInput([Key.Escape], false);
    await studioAgent.waitForNotVisible('[data-test--dialog]');
    await studioAgent.navigation.activatePage('deploy/plan');
  });
});
