import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgent, TestContext } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = 30000;
const category = (id: string) => `.workbench-header__category[data-category-id="${id}"]`;
const activeCategory = (id: string) => `.workbench-header-container[data-category-id="${id}"]`;
const activePage = (id: string) => `.workbench-header-container[data-page-id="${id}"]`;
const pageButton = (id: string) => `.workbench-page-bar__page[data-page-id="${id}"]`;
const groupEntry = (groupId: string) => `.workbench-page-bar__page[data-test--pane-group-tab="${groupId}"]`;
const labelMode = (mode: string) => `.workbench-page-bar__pages[data-page-bar-labels="${mode}"]`;
const WIDE_PAGE_BAR_WIDTH = '1600px';
const NARROW_PAGE_BAR_WIDTH = '200px';

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

  it('header: shows Home, Discover, Design, Deploy, Debug and Control in this order', async () => {
    const order = ['home', 'discover', 'design', 'deploy', 'debug', 'control'];
    for (const id of order) {
      await studioAgent.assertVisible(category(id), TIMEOUT);
    }
    const shownOrder = await studioAgent.executeInRenderer(
      `return [...document.querySelectorAll('.workbench-header__category')].map((element) => element.dataset.categoryId);`,
    );
    assert.deepStrictEqual(shownOrder, order);
  });

  it('categories: activating a category shows its page bar and pages', async () => {
    await studioAgent.executeCommand('std.workbench.activateCategory', ['design']);
    await studioAgent.assertVisible(activeCategory('design'), TIMEOUT);
    await studioAgent.assertVisible(groupEntry('explorer'), TIMEOUT);
    await studioAgent.assertVisible(groupEntry('search'), TIMEOUT);
    await studioAgent.assertVisible(pageButton('design/source'), TIMEOUT);
    await studioAgent.assertNotVisible('.app-layout__panes-left .pane-group-tab-bar--text');

    await studioAgent.executeCommand('std.workbench.activateCategory', ['control']);
    await studioAgent.assertVisible(pageButton('control/settings'), TIMEOUT);
    await studioAgent.assertVisible(pageButton('control/about'), TIMEOUT);
  });

  it('page bar: a left group entry switches from Source to its group and reopens a hidden left area', async () => {
    await studioAgent.executeCommand('std.workbench.showPanels');
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/source']);
    await studioAgent.assertVisible(activePage('design/source'), TIMEOUT);

    await studioAgent.switchToPaneGroup('search');
    await studioAgent.navigation.assertLeftPaneIsActive('design/workspace/search');

    await studioAgent.executeCommand('std.workbench.toggleSidebar');
    await studioAgent.assertNotVisible('.app-layout__panes-left');
    await studioAgent.switchToPaneGroup('explorer');
    await studioAgent.assertVisible('.app-layout__panes-left', TIMEOUT);
    await studioAgent.navigation.assertLeftPaneIsActive('design/workspace/explorer');
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

  it('routing: opening a solution file from Home lands in Discover/Landscapes', async () => {
    await studioAgent.executeCommand('std.workbench.activatePage', ['home/welcome']);
    await studioAgent.assertVisible(activePage('home/welcome'), TIMEOUT);
    const solutionDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bfw-categories-'));
    const solutionFile = path.join(solutionDirectory, 'routing.bfwsln');
    const folder = path.join(__dirname, '..', '..', 'fixtures', 'test-solution-simple');
    fs.writeFileSync(solutionFile, JSON.stringify({ folders: [{ path: folder }], settings: {} }));
    try {
      await studioAgent.executeCommand('std.solution.openDirectory', [`file://${solutionFile}`]);
      await studioAgent.assertVisible(activePage('discover/landscapes'), TIMEOUT);
    } finally {
      await studioAgent.executeCommand('std.solution.closeSolution');
      fs.rmSync(solutionDirectory, { recursive: true, force: true });
    }
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

  describe('page bar labels', () => {
    // WebDriver window resizing is unreliable under Electron; the page bar reacts to its own width
    const setPageBarWidth = (width: string) =>
      studioAgent.executeInRenderer(`document.querySelector('.workbench-page-bar__pages').style.width = '${width}';`);

    afterEach(async () => {
      await studioAgent.setSetting('workbench.pageBar.labels', 'auto');
      await setPageBarWidth('');
    });

    it('never: hides labels, shows tooltips and search stays usable', async () => {
      await studioAgent.setSetting('workbench.pageBar.labels', 'never');
      await studioAgent.navigation.activatePage('design/workspace');
      await studioAgent.assertVisible(labelMode('never'), TIMEOUT);
      const labelDisplays = (await studioAgent.executeInRenderer(
        `return [...document.querySelectorAll('.workbench-page-bar__label')].map((label) => getComputedStyle(label).display);`,
      )) as string[];
      assert.ok(labelDisplays.length > 0, 'The page bar should render label elements');
      assert.deepStrictEqual(new Set(labelDisplays), new Set(['none']));
      await studioAgent.assertVisible(groupEntry('search'), TIMEOUT);
      assert.strictEqual(await studioAgent.getAttribute(groupEntry('search'), 'aria-label'), 'Search');
      assert.strictEqual(await studioAgent.getAttribute(groupEntry('search'), 'data-bs-title'), 'Search');
      await studioAgent.clickOn(groupEntry('search'));
      await studioAgent.navigation.assertLeftPaneIsActive('design/workspace/search');
    });

    it('always: keeps labels in a narrow page bar without collapsing', async () => {
      await studioAgent.setSetting('workbench.pageBar.labels', 'always');
      await studioAgent.navigation.activatePage('design/workspace');
      await studioAgent.assertVisible(labelMode('always'), TIMEOUT);
      await setPageBarWidth(NARROW_PAGE_BAR_WIDTH);
      await studioAgent.assertNotVisible('.workbench-page-bar__pages--collapsed');
      const labelDisplay = await studioAgent.executeInRenderer(
        `return getComputedStyle(document.querySelector('.workbench-page-bar__label')).display;`,
      );
      assert.notStrictEqual(labelDisplay, 'none');
    });

    it('auto: collapses when the page bar is narrow and shows tooltips only then', async () => {
      await studioAgent.setSetting('workbench.pageBar.labels', 'auto');
      await studioAgent.navigation.activatePage('design/workspace');
      await studioAgent.assertVisible(labelMode('auto'), TIMEOUT);
      await setPageBarWidth(WIDE_PAGE_BAR_WIDTH);
      await studioAgent.waitForNotVisible('.workbench-page-bar__pages--collapsed');
      assert.strictEqual(await studioAgent.getAttribute(groupEntry('search'), 'data-bs-title'), null);
      await setPageBarWidth(NARROW_PAGE_BAR_WIDTH);
      await studioAgent.assertVisible('.workbench-page-bar__pages--collapsed', TIMEOUT);
      assert.strictEqual(await studioAgent.getAttribute(groupEntry('search'), 'data-bs-title'), 'Search');
      await setPageBarWidth(WIDE_PAGE_BAR_WIDTH);
      await studioAgent.waitForNotVisible('.workbench-page-bar__pages--collapsed');
    });
  });
});
