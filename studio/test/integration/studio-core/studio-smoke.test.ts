import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { TestContext } from '../../StudioAgent';
import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const SHOW_QUICK_JUMP_COMMANDS = OsSpecificKeystroke('cmd-shift-j', 'ctrl-shift-j');
const FOCUS_SEARCH = OsSpecificKeystroke('cmd-shift-f', 'ctrl-shift-f');
const OPEN_NEW_WINDOW = OsSpecificKeystroke('cmd-shift-n', 'ctrl-shift-n');

const PROPERTY_PANEL_TOGGLE = '[data-test--menubar--button-for-command="std.workbench.togglePropertyPanel"]';
const SIDEBAR_TOGGLE = '[data-test--menubar--button-for-command="std.workbench.toggleSidebar"]';

const ASSERT_VISIBLE_TIMEOUT = 30000;

describe('studio/smoke', () => {
  let studioAgent: StudioAgent;
  let currentContext: TestContext;

  beforeAll(async () => {
    currentContext = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgent(currentContext);
    await studioAgent.executeCommand('std.workbench.showPanels');
    await studioAgent.assertVisible('.app-layout__panes-left', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('.app-layout__panes-right', ASSERT_VISIBLE_TIMEOUT);
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

  it('smoke/aboutpage: should open about page', async () => {
    await studioAgent.openViaCommandSearch('about');
    await studioAgent.assertNoErrorsPresentAndIdle();
    await studioAgent.assertVisible('[data-test--editors--focused-document-type=aboutpage]', ASSERT_VISIBLE_TIMEOUT);
  });

  it('smoke/pane-content: should switch between different panes via left menubar', async () => {
    await studioAgent.sendKeyboardInput([FOCUS_SEARCH]);
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/search');

    await studioAgent.leftMenuBar.togglePane('pane/left/explorer');
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/explorer');

    await studioAgent.assertNoErrorsPresentAndIdle();

    await studioAgent.sendKeyboardInput([FOCUS_SEARCH]);
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/search');

    await studioAgent.sendKeyboardInput('how to deploy'.split('').concat(['space', '?', '?']));

    await studioAgent.openViaCommandSearch('start');

    await studioAgent.assertVisible('[data-test--editors--focused-document-type=startpage]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/command-search: should expose basic functions through the command search', async () => {
    await studioAgent.openViaCommandSearch('start');
    await studioAgent.openViaCommandSearch('help');

    await studioAgent.sendKeyboardInput([SHOW_QUICK_JUMP_COMMANDS, ...'editor'.split(''), 'down', 'down', 'enter']);
    await studioAgent.pause(500);

    await studioAgent.openViaCommandSearch('theme', false);
    await studioAgent.pause(500);
    await studioAgent.sendKeyboardInput(['enter']);
    await studioAgent.pause(500);

    await studioAgent.assertVisible('[data-test--workbench--theme=light]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/themes: should propagate theme changes across windows', async () => {
    const testDriver = studioAgent.getTestDriver();

    await studioAgent.maximize();

    await studioAgent.sendKeyboardInput([OPEN_NEW_WINDOW]);

    await (testDriver.client as any).windowByIndex(1);
    await studioAgent.awaitReadyness();

    await studioAgent.openViaCommandSearch('theme', false);

    await studioAgent.sendKeyboardInput(['enter']);

    await studioAgent.assertVisible('[data-test--workbench--theme=light]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();

    await (testDriver.client as any).windowByIndex(0);

    await studioAgent.assertVisible('[data-test--workbench--theme=light]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/editor: should split editors', async () => {
    await studioAgent.openViaCommandSearch('start');
    await studioAgent.openViaCommandSearch('Settings (JSON)');

    await studioAgent.rightClickOn('[data-test--editor-tab-label="Settings (JSON)"]');
    await studioAgent.assertContextMenuVisible();
    await studioAgent.clickOn('[data-test--context-menu-id="std/editor/editor-tab/split-to-the-right"]');

    await studioAgent.assertVisible('[data-editor-id="Editor1"]');
    await studioAgent.assertVisible('[data-editor-id="Editor2"]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/workbench: should toggle the property pane from the right-side pane toggle button', async () => {
    await studioAgent.assertVisible(PROPERTY_PANEL_TOGGLE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnMenubarButtonForCommand('std.workbench.togglePropertyPanel');
    await studioAgent.pause(500);

    await studioAgent.assertNotVisible('.app-layout__panes-right');
    await studioAgent.assertVisible(PROPERTY_PANEL_TOGGLE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnMenubarButtonForCommand('std.workbench.togglePropertyPanel');
    await studioAgent.assertVisible('.app-layout__panes-right', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('smoke/workbench: should toggle the sidebar from the left-side pane toggle button', async () => {
    await studioAgent.leftMenuBar.togglePane('pane/left/explorer');
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/explorer');

    await studioAgent.assertVisible(SIDEBAR_TOGGLE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnMenubarButtonForCommand('std.workbench.toggleSidebar');
    await studioAgent.pause(500);

    await studioAgent.assertNotVisible('.app-layout__panes-left');
    await studioAgent.assertVisible(SIDEBAR_TOGGLE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnMenubarButtonForCommand('std.workbench.toggleSidebar');
    await studioAgent.assertVisible('.app-layout__panes-left', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/explorer');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
