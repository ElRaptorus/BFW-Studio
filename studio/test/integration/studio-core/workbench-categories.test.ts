import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent, TestContext } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = 30000;
const category = (id: string) => `.workbench-header__category[data-category-id="${id}"]`;
const activeCategory = (id: string) => `.workbench-header-container[data-category-id="${id}"]`;
const activePage = (id: string) => `.workbench-header-container[data-page-id="${id}"]`;
const pageButton = (id: string) => `.workbench-page-bar__page[data-page-id="${id}"]`;

describe('studio/workbench-categories', () => {
  let studioAgent: StudioAgent;
  let currentContext: TestContext;

  beforeAll(async () => {
    currentContext = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgent(currentContext);
  });

  beforeEach(({ task }) => {
    currentContext = { testName: task.name, testFile: __filename };
    studioAgent.updateTestContext(currentContext);
  });

  afterEach(({ task }) => {
    currentContext.state = task.result?.state === 'fail' ? 'failed' : 'passed';
    return studioAgent.recordErrors().then(() => studioAgent.closeOpenEditors());
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('header: shows Home, Design, Deploy, Debug and Control; Measure is hidden while empty', async () => {
    for (const id of ['home', 'design', 'deploy', 'debug', 'control']) {
      await studioAgent.assertVisible(category(id), TIMEOUT);
    }
    await studioAgent.assertNotVisible(category('measure'));
  });

  it('categories: activating a category shows its page bar and pages', async () => {
    await studioAgent.executeCommand('std.workbench.activateCategory', ['design']);
    await studioAgent.assertVisible(activeCategory('design'), TIMEOUT);
    await studioAgent.assertVisible(pageButton('design/workspace'), TIMEOUT);
    await studioAgent.assertVisible(pageButton('design/source'), TIMEOUT);

    await studioAgent.executeCommand('std.workbench.activateCategory', ['control']);
    await studioAgent.assertVisible(pageButton('control/settings'), TIMEOUT);
    await studioAgent.assertVisible(pageButton('control/about'), TIMEOUT);
  });

  it('categories: activating a hidden category does nothing', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.executeCommand('std.workbench.activateCategory', ['measure']);
    await studioAgent.assertVisible(activePage('design/workspace'), TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('routing: opening the about page switches to Control/About', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.openViaCommandSearch('about');
    await studioAgent.assertVisible(activePage('control/about'), TIMEOUT);
    await studioAgent.assertVisible('[data-test--editors--focused-document-type=aboutpage]', TIMEOUT);
  });

  it('panes: explorer belongs to Design/Workspace and is not shown on Control pages', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.assertVisible('.app-layout__panes-left', TIMEOUT);

    await studioAgent.executeCommand('std.workbench.activatePage', ['control/about']);
    await studioAgent.assertNotVisible('.app-layout__panes-left');

    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.assertVisible('.app-layout__panes-left', TIMEOUT);
  });

  it('routing: opening a .bpmn file from Home lands in Design/Workspace', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['home/welcome']);
    await studioAgent.assertVisible(activePage('home/welcome'), TIMEOUT);
    await studioAgent.openFile(studioAgent.getFixturesAbsoluteFileUri('test-solution-sanitizer/haunted-house.bpmn'));
    await studioAgent.assertVisible(activePage('design/workspace'), TIMEOUT);
    await studioAgent.assertVisible('[data-test--editors--focused-document-type=bpmn]', TIMEOUT);
  });

  it('defaults: pages open their default document and Home hides editor tabs', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['home/welcome']);
    await studioAgent.assertVisible('[data-test--editors--focused-document-type=startpage]', TIMEOUT);
    await studioAgent.assertNotVisible('.app-layout__panes-left');
    await studioAgent.assertNotVisible('.app-layout__panes-right');

    await studioAgent.executeCommand('std.workbench.activatePage', ['control/settings']);
    await studioAgent.assertVisible('[data-test--editors--focused-document-type=settings-gui]', TIMEOUT);
  });

  it('layout: the workbench does not overflow the window', async () => {
    for (const pageId of ['home/welcome', 'design/workspace', 'control/about', 'debug/engines']) {
      await studioAgent.executeCommand('std.workbench.activatePage', [pageId]);
      await studioAgent.assertVisible(activePage(pageId), TIMEOUT);
      const overflow = await studioAgent.executeInRenderer(
        'return document.documentElement.scrollHeight > document.documentElement.clientHeight;',
      );
      if (overflow) {
        throw new Error(`Page ${pageId} overflows the window vertically`);
      }
    }
  });
});
