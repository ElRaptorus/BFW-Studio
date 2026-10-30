import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import { Key } from 'webdriverio';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { LandscapeWorkspace } from '../bpmn-landscape/landscapeWorkspace';
import { createLandscapeWorkspace } from '../bpmn-landscape/landscapeWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const MAP_DOCUMENT_TYPE = 'bpmn-landscape-map';
const DIFF_DOCUMENT_TYPE = 'bpmn-landscape-map.diff';
const HISTORY_DOCUMENT_TYPE = 'bpmn-landscape-map.history-preview';
const DIFF_CANVASES = '.splitter-layout--bpmn-diff';
const CHANGE_OVERVIEW_PANE = '[data-test--pane="bpmn-landscape/panes/properties/ChangeOverview"]';
const RELATION_HINT =
  "Relation lines are not shown: calls, messages and signals are inferred from the solution's BPMN files at runtime and cannot be diffed reliably between versions.";

const box = (id: string, x: number, y: number) => ({
  id,
  parentId: null,
  x,
  y,
  width: 140,
  height: 60,
  style: null,
});
const processShape = (id: string, processId: string, x: number, y: number): LandscapeElement => ({
  ...box(id, x, y),
  type: 'process',
  processId,
  fileHint: `../${processId}.bpmn`,
  label: null,
  shape: 'box',
});
const placeholderShape = (id: string, label: string, x: number, y: number): LandscapeElement => ({
  ...box(id, x, y),
  type: 'placeholder',
  label,
  shape: 'box',
});
const noteShape = (id: string, text: string, x: number, y: number): LandscapeElement => ({
  ...box(id, x, y),
  type: 'note',
  text,
});

/** `order-process` calls `payment-process`, so the map editor draws a call relation between the two. */
function overviewMap(archiveLabel: string): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Overview'),
    elements: [
      processShape('order', 'order-process', 50, 50),
      processShape('payment', 'payment-process', 350, 50),
      placeholderShape('archive', archiveLabel, 650, 50),
      noteShape('memo', 'Remember the archive', 50, 250),
    ],
    connectors: [{ id: 'connector-1', sourceId: 'payment', targetId: 'archive', label: '', waypoints: [] }],
  };
}

/** Committed first. */
const INITIAL_MAP = overviewMap('Archive');
/** Committed second, so the map has a version before `HEAD`. */
const COMMITTED_MAP = overviewMap('Records');
/** The working copy of most tests: one item of each change kind against `HEAD`. */
const CHANGED_MAP: LandscapeMap = {
  ...COMMITTED_MAP,
  elements: [
    ...COMMITTED_MAP.elements
      .filter((element) => element.id !== 'memo')
      .map((element): LandscapeElement => {
        if (element.id === 'archive') {
          return { ...element, label: 'Records Vault' } as LandscapeElement;
        }
        return element.id === 'order' ? { ...element, y: 200 } : element;
      }),
    placeholderShape('billing', 'Billing', 950, 50),
  ],
};

describe('git-cruiser/landscape-diff', () => {
  let studioAgent: StudioAgent;
  let landscapeWorkspace: LandscapeWorkspace;

  const mapPath = (): string => path.join(landscapeWorkspace.landscapeFolder, 'Overview.bfwmap');
  const mapUri = (): string => `file://${mapPath()}`;
  const writeMap = (map: LandscapeMap): void => fs.writeFileSync(mapPath(), serializeLandscapeMap(map));
  const git = (command: string): void => {
    execSync(command, { cwd: landscapeWorkspace.workspace });
  };

  const waitForCount = async (selector: string, isExpected: (count: number) => boolean, what: string) => {
    await studioAgent.waitUntil(async () => isExpected(await studioAgent.getElementCount(selector)), {
      timeout: TIMEOUT,
      timeoutMsg: `Expected ${what} ('${selector}')`,
    });
  };

  const openMap = async (): Promise<void> => {
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
    await studioAgent.openUriAsDocument(mapUri());
    await studioAgent.navigation.assertActivePage('discover/landscapes');
    await studioAgent.assertVisible('[data-test--landscape-canvas]', TIMEOUT);
  };

  const openDiffOfWorkingCopy = async (): Promise<void> => {
    writeMap(CHANGED_MAP);
    await openMap();
    await studioAgent.clickOn('[data-test--landscape-show-changes]');
    await studioAgent.assertVisible(`[data-test--editors--focused-document-type="${DIFF_DOCUMENT_TYPE}"]`, TIMEOUT);
    await waitForCount(`${DIFF_CANVASES} .highlight-overlay`, (count) => count > 0, 'the change markers');
  };

  /** `versionIndex` 0 is the latest commit of the map, 1 the one before. */
  const openHistoryPreview = async (versionIndex: number): Promise<void> => {
    await openMap();
    await studioAgent.waitUntilCommandEnabled('git.showFileHistory', [mapUri()]);
    await studioAgent.clickOn('[data-test--landscape-history]');
    await studioAgent.assertVisible('.quick-jump', TIMEOUT);
    await studioAgent.sendKeyboardInput([...Array<string>(versionIndex).fill(Key.ArrowDown), 'enter'], false);
    await studioAgent.assertVisible(`[data-test--editors--focused-document-type="${HISTORY_DOCUMENT_TYPE}"]`, TIMEOUT);
  };

  beforeAll(async () => {
    landscapeWorkspace = createLandscapeWorkspace('bifrost-forge-world-landscape-diff-test-');
    writeMap(INITIAL_MAP);
    git('git init -q -b main');
    git('git config user.email "test@example.com" && git config user.name "Test"');
    git('git config commit.gpgsign false && git config tag.gpgsign false');
    git('git add -A && git commit -q -m "Initial map"');
    writeMap(COMMITTED_MAP);
    git('git add -A && git commit -q -m "Rename the archive"');

    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    await studioAgent.pause(1000);
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
    if (await studioAgent.isDialogActive()) {
      await studioAgent.closeActiveDialog();
    }
    await studioAgent.recordErrors();
    await studioAgent.closeAllNotifications();
    await studioAgent.closeOpenEditors(DIFF_DOCUMENT_TYPE);
    await studioAgent.closeOpenEditors(HISTORY_DOCUMENT_TYPE);
    await studioAgent.closeOpenEditors(MAP_DOCUMENT_TYPE);
    git('git checkout -q -- .');
  });

  afterAll(async () => {
    await studioAgent?.stop();
    try {
      fs.rmSync(landscapeWorkspace.workspace, { recursive: true, force: true });
    } catch {
      // cleanup is best-effort
    }
  });

  it('landscape-diff/show-diff: Show Changes opens the visual map diff with markers', async () => {
    await openDiffOfWorkingCopy();
    await studioAgent.navigation.assertActivePage('design/source');

    await waitForCount('.bpmn-diff__after .highlight-overlay--added', (count) => count === 1, 'one added item');
    await waitForCount('.bpmn-diff__before .highlight-overlay--deleted', (count) => count === 1, 'one removed item');
    await waitForCount('.bpmn-diff__before .highlight-overlay--updated', (count) => count === 1, 'one modified item');
    await waitForCount('.bpmn-diff__after .highlight-overlay--updated', (count) => count === 1, 'one modified item');
    await waitForCount('.bpmn-diff__after .highlight-overlay--moved', (count) => count === 1, 'one moved item');
    // Read-only canvases.
    assert.strictEqual(await studioAgent.getElementCount(`${DIFF_CANVASES} .djs-palette`), 0);
    assert.strictEqual(await studioAgent.getElementCount(`${DIFF_CANVASES} .djs-context-pad`), 0);

    await studioAgent.assertVisible(CHANGE_OVERVIEW_PANE, TIMEOUT);
    await studioAgent.clickOn(`${CHANGE_OVERVIEW_PANE} [data-test--landscape-change-entry="billing"]`);
    await studioAgent.waitUntil(async () => /Change \d+ \//.test(String(await studioAgent.getText('.editor-title'))), {
      timeout: TIMEOUT,
      timeoutMsg: 'Expected the clicked change to be the current one in the title',
    });

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/view-switch: switches between the visual and the XML view', async () => {
    await openDiffOfWorkingCopy();

    await studioAgent.clickOn('[data-test--diff-view-xml]');
    await studioAgent.assertVisible('.diff-xml-view .cm-mergeView', TIMEOUT);
    await studioAgent.assertNotVisible(`${DIFF_CANVASES}:not(.diff-view--hidden)`);

    await studioAgent.clickOn('[data-test--diff-view-visual]');
    await studioAgent.assertVisible(`${DIFF_CANVASES}:not(.diff-view--hidden)`, TIMEOUT);
    await studioAgent.assertNotVisible('.diff-xml-view');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/show-summary: the summary dialog lists the changes', async () => {
    await openDiffOfWorkingCopy();

    await studioAgent.waitUntilCommandEnabled('bpmn.landscape.diff.showChangeSummaryDialog');
    await studioAgent.clickOn('[data-test--landscape-diff-summary]');
    await studioAgent.waitUntilDialogActive();
    const summary = String(await studioAgent.getText('[data-test--dialog]'));
    assert.ok(summary.includes('Billing'), `Expected the added placeholder in the summary, got: ${summary}`);
    assert.ok(summary.includes('Records Vault'), `Expected the renamed placeholder in the summary, got: ${summary}`);
    await studioAgent.closeActiveDialog();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/relation-hint: the diff explains the missing relation lines and draws none', async () => {
    writeMap(CHANGED_MAP);
    await openMap();
    await waitForCount(
      '[data-test--landscape-canvas] .landscape-relation',
      (count) => count > 0,
      'the call relation in the map editor',
    );

    await studioAgent.clickOn('[data-test--landscape-show-changes]');
    await studioAgent.assertVisible('[data-test--landscape-diff-relation-hint]', TIMEOUT);
    assert.strictEqual(String(await studioAgent.getText('[data-test--landscape-diff-relation-hint]')), RELATION_HINT);
    await waitForCount(`${DIFF_CANVASES} .landscape-process`, (count) => count === 4, 'both processes on both sides');
    assert.strictEqual(await studioAgent.getElementCount(`${DIFF_CANVASES} .landscape-relation`), 0);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/history: the map History button opens the landscape history preview', async () => {
    await openHistoryPreview(0);

    await studioAgent.navigation.assertActivePage('design/source');
    const bpmnHistoryPreview = '[data-test--editors--focused-document-type="bpmn.history-preview"]';
    assert.strictEqual(await studioAgent.getElementCount(bpmnHistoryPreview), 0);
    await studioAgent.assertVisible('[data-test--landscape-history-relation-hint]', TIMEOUT);
    await studioAgent.assertVisible(CHANGE_OVERVIEW_PANE, TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/history-diff-mode: toggles between preview and diff mode', async () => {
    await openHistoryPreview(1);

    await studioAgent.assertVisible(DIFF_CANVASES, TIMEOUT);
    await waitForCount(`${DIFF_CANVASES} .highlight-overlay--updated`, (count) => count === 2, 'the renamed archive');

    await studioAgent.clickOn('[data-test--landscape-history-mode-preview]');
    await studioAgent.assertVisible('[data-test--landscape-history-preview] .landscape-placeholder', TIMEOUT);
    await studioAgent.assertNotVisible(DIFF_CANVASES);
    await studioAgent.assertVisible('[data-test--landscape-history-relation-hint]', TIMEOUT);

    await studioAgent.clickOn('[data-test--landscape-history-mode-diff]');
    await studioAgent.assertVisible(DIFF_CANVASES, TIMEOUT);
    await studioAgent.assertNotVisible('[data-test--landscape-history-preview]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/history-restore: Restore writes the historical version and opens the map', async () => {
    await openHistoryPreview(1);

    await studioAgent.clickOn('[data-test--landscape-history-restore]');
    await studioAgent.waitUntilDialogActive();
    await studioAgent.submitActiveDialog('restore');

    await studioAgent.waitUntil(
      async () => {
        const result = await parseLandscapeMap(fs.readFileSync(mapPath(), 'utf8'));
        const archive = result.ok ? result.map.elements.find((element) => element.id === 'archive') : undefined;
        return archive?.type === 'placeholder' && archive.label === 'Archive';
      },
      { timeout: TIMEOUT, timeoutMsg: 'Expected the initial version of the map on disk' },
    );
    await studioAgent.assertVisible(`[data-test--editors--focused-document-type="${MAP_DOCUMENT_TYPE}"]`, TIMEOUT);

    await studioAgent.closeAllNotifications();
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('landscape-diff/overview-row: the Source Overview row shows the digest and Preview opens the history preview', async () => {
    writeMap(CHANGED_MAP);
    await studioAgent.openViaCommandSearch('Git: Refresh Status');
    await studioAgent.pause(1000);
    await studioAgent.navigation.activatePage('design/source');
    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    await studioAgent.clickOn('[data-test--overview-refresh]');

    const row = '[data-test--change-row="model"]';
    await studioAgent.assertVisible(row, TIMEOUT);
    await studioAgent.waitUntil(
      async () => {
        const text = String(await studioAgent.getText(row));
        return text.includes('Overview') && text.includes('1 added') && text.includes('Billing');
      },
      { timeout: TIMEOUT, timeoutMsg: 'Expected the map digest in the change row' },
    );

    await studioAgent.clickOn('[data-test--overview-mode-history]');
    await studioAgent.clickOn('[data-test--overview-refresh]');
    await studioAgent.assertVisible('[data-test--history]', TIMEOUT);
    await studioAgent.clickOn('[data-test--commit-row]');
    await studioAgent.clickOn('[data-test--commit-files] [data-test--change-row-preview]');
    await studioAgent.assertVisible(`[data-test--editors--focused-document-type="${HISTORY_DOCUMENT_TYPE}"]`, TIMEOUT);

    await studioAgent.executeCommand('git.overview.open');
    await studioAgent.clickOn('[data-test--overview-mode-uncommitted]');
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
