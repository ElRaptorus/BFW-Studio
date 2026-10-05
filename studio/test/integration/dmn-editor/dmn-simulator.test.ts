import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const PANEL = '.dmn-sim-panel';
const INPUT = '.dmn-sim-input';
const PLAY_BUTTON = '.dmn-sim-play';
const VALUE_BADGE = '.dmn-sim-badge--value';
const ERROR_NOTIFICATION = '[data--test--unexpected-notifications]';
const MATCHED_ROW = '.dmn-sim-rule-matched';
const PALETTE_ENTRY_ACTIVE = '.dmn-sim-palette-entry--active';
const PANEL_RUN_AGAIN = '.dmn-sim-panel__actions button[aria-label="Run again"]';
const IMPORTED_REQUIREMENTS_PANE = 'dmn/panes/properties/PropertiesImportedRequirements';
const SHARED_NAMESPACE = 'https://bifrostforge.world/test/shared';
const IMPORTED_ROW = `[data-test--dmn-imported-requirement="decision:${SHARED_NAMESPACE}#Decision_SharedDouble"]`;
const PANEL_RESET = '.dmn-sim-panel__actions button[aria-label="Reset"]';
const PANEL_SHOW_DETAILS = '.dmn-sim-panel__actions button[aria-label="Show details"]';
const PANEL_DRAWER_STEPS = '.dmn-sim-panel__drawer .dmn-sim-panel__steps';
describe('dmn/simulator', () => {
  let studioAgent: StudioAgentDmnExtension;

  beforeAll(async () => {
    studioAgent = await createAndStartStudioAgentDmnExtension({ testName: 'setup', testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
    await studioAgent.maximize();
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
    await studioAgent.closeOpenEditors('dmn');
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  async function openSimpleDecisionWithSimulator(): Promise<void> {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.executeCommand('dmn.simulator.toggle');
    await studioAgent.assertVisible(PANEL, ASSERT_VISIBLE_TIMEOUT);
  }

  async function runWithAge(age: string): Promise<void> {
    await studioAgent.assertVisible(INPUT, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn(INPUT);
    await studioAgent.waitUntilDialogActive();
    await studioAgent.submitActiveDialog('apply', { value: age });
    await studioAgent.clickOn(PLAY_BUTTON);
  }

  it('dmn/simulator: should evaluate a decision and show the value badge', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('12');

    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should report an invalid input as an error notification', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('nonexistentName');

    await studioAgent.assertVisible(ERROR_NOTIFICATION, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.closeAllNotifications();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should highlight the matched rule in the decision table', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('12');
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.assertVisible(MATCHED_ROW, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should keep overlays, badge and palette state after drilling into a table and back', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('12');
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.navigateBackToDrd();

    await studioAgent.assertVisible(INPUT, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible(PLAY_BUTTON, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible(PALETTE_ENTRY_ACTIVE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should run again and reset the result', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('12');
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn(PANEL_RUN_AGAIN);
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn(PANEL_RESET);
    await studioAgent.waitForNotVisible(VALUE_BADGE);
    await studioAgent.assertVisible(INPUT, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should open the details drawer with the steps', async () => {
    await openSimpleDecisionWithSimulator();
    await runWithAge('12');
    await studioAgent.assertVisible(VALUE_BADGE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn(PANEL_SHOW_DETAILS);
    await studioAgent.assertVisible(PANEL_DRAWER_STEPS, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/imports: should add, remove and undo an imported requirement', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_FinalPrice');
    await studioAgent.waitForPaneVisible(IMPORTED_REQUIREMENTS_PANE);

    await studioAgent.clickOn('#dmn-imported-requirement-element .react-select__control');
    await studioAgent.sendKeyboardInput([...'Decision_SharedDouble'.split('')]);
    await studioAgent.commitSuggestionCreateOption('#dmn-imported-requirement-element', 'Decision_SharedDouble');
    await studioAgent.clickOn('[data-test--dmn-imported-requirement-add]');
    await studioAgent.assertVisible(IMPORTED_ROW, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn(`${IMPORTED_ROW} [data-test--dmn-imported-requirement-remove]`);
    await studioAgent.waitForNotVisible(IMPORTED_ROW);

    await studioAgent.executeCommand('std.editor.undoInFocusedEditorDocument');
    await studioAgent.assertVisible(IMPORTED_ROW, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.closeContextPad();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/simulator: should close the panel when toggled off', async () => {
    await openSimpleDecisionWithSimulator();
    await studioAgent.executeCommand('dmn.simulator.toggle');
    await studioAgent.waitForNotVisible(PANEL);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/imports: should offer a jump link for an import that resolves in the solution', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();
    await studioAgent.clickOnDrdCanvas();
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.waitForPaneVisible('dmn/panes/properties/PropertiesImports');

    await studioAgent.assertVisible('[data-test--jump-to-symbol-in-solution]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
