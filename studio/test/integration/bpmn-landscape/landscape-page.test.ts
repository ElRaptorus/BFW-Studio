import * as fs from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { StudioAgent, TestContext } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { LandscapeWorkspace } from './landscapeWorkspace';
import { createLandscapeWorkspace } from './landscapeWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const PANE_ID = 'discover/landscapes/landscapes';
const TREE = '[data-test--tree="bpmn-landscape/processes"]';
const FILTER = '[data-test--landscape-process-filter]';

describe('bpmn-landscape/landscape-page', () => {
  let studioAgent: StudioAgent;
  let currentContext: TestContext;
  let landscapeWorkspace: LandscapeWorkspace;

  const treeLabels = async (): Promise<string[]> =>
    (await studioAgent.executeInRenderer(
      `return [...document.querySelectorAll('${TREE} .treeview__label')].map((label) => label.textContent)`,
    )) as string[];

  const waitForTreeLabels = async (expected: string[]): Promise<void> => {
    await studioAgent.waitUntil(async () => JSON.stringify(await treeLabels()) === JSON.stringify(expected), {
      timeout: TIMEOUT,
      timeoutMsg: `The Processes pane did not show ${JSON.stringify(expected)}`,
    });
  };

  beforeAll(async () => {
    currentContext = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgent(currentContext);
    landscapeWorkspace = createLandscapeWorkspace('bfw-landscape-page-');
    await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
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
    if (landscapeWorkspace != null) {
      fs.rmSync(landscapeWorkspace.workspace, { recursive: true, force: true });
    }
  });

  it('shows the Discover category with the Landscapes page, its Maps explorer and its Processes pane', async () => {
    await studioAgent.assertVisible('.workbench-header__category[data-category-id="discover"]', TIMEOUT);
    await studioAgent.navigation.showLeftPane(PANE_ID);
    await studioAgent.navigation.assertLeftPaneIsActive(PANE_ID);
    await studioAgent.assertVisible('[data-test--landscape-new-map]', TIMEOUT);
    await studioAgent.assertVisible('[data-test--tree="bpmn-landscape/processes"]', TIMEOUT);
  });

  it('lists the BPMN files collapsed; expanding a file shows its processes', async () => {
    await studioAgent.navigation.showLeftPane(PANE_ID);
    await waitForTreeLabels([
      'draft-process.bpmn',
      'order-process.bpmn',
      'payment-process.bpmn',
      'unversioned-process.bpmn',
    ]);

    await studioAgent.clickOn('.treeview__label=order-process.bpmn');

    await studioAgent.assertVisible('.treeview__label=Order Process', TIMEOUT);
    expect(await treeLabels()).toContain('Order Process');
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('the filter keeps matching processes and expands their files', async () => {
    await studioAgent.navigation.showLeftPane(PANE_ID);
    await studioAgent.clickOn(FILTER);
    await studioAgent.sendKeyboardInput([...'payment'.split('')], false);

    await waitForTreeLabels(['payment-process.bpmn', 'Payment Process']);

    await studioAgent.clearTextInput(FILTER);
    await waitForTreeLabels([
      'draft-process.bpmn',
      'order-process.bpmn',
      'payment-process.bpmn',
      'unversioned-process.bpmn',
    ]);
  });
});
