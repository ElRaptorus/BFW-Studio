import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

const PLUGIN_LOAD_TIMEOUT = 30_000;

async function waitForPluginCommand(studioAgent: StudioAgentDmnExtension, commandId: string): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      return studioAgent
        .getTestDriver()
        .client!.execute((cmd: string) => (window as any).bifrost.commands.isRegistered(cmd), commandId);
    },
    { timeout: PLUGIN_LOAD_TIMEOUT, timeoutMsg: `Plugin command '${commandId}' was not registered in time` },
  );
}

async function executePluginCommand(
  studioAgent: StudioAgentDmnExtension,
  commandId: string,
  ...args: unknown[]
): Promise<any> {
  return studioAgent.executeCommand(commandId, args);
}

async function openDmnFileAndGetUri(studioAgent: StudioAgentDmnExtension, filename: string): Promise<string> {
  const fixtureDir = path.resolve(__dirname, '../../fixtures/test-solution-dmn');
  const filePath = path.join(fixtureDir, filename);
  const fileUri = `file://${filePath}`;

  await studioAgent.jumpToFileInSolution(filename, 'dmn');
  await studioAgent.waitForInteractiveDmnDocument();

  return fileUri;
}

describe('plugin/dmn-api', { timeout: 120_000 }, () => {
  describe('permission gating', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({ testName: 'dmn-api-perm', testFile: __filename });
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('denies dmn.setOverlays to plugin without dmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.dmn-no-perm.trySetOverlays');
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-no-perm.trySetOverlays');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies dmn.getElements to plugin without dmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.dmn-no-perm.tryGetElements');
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-no-perm.tryGetElements');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies dmn.onElementSelected to plugin without dmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.dmn-no-perm.trySubscribe');
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-no-perm.trySubscribe');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies dmn.getXml to plugin without dmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.dmn-no-perm.tryGetXml');
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-no-perm.tryGetXml');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });
  });

  describe('overlay lifecycle', () => {
    let studioAgent: StudioAgentDmnExtension;
    let dmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-api-overlays',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.dmn-overlay-demo.setOverlays');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      dmnUri = await openDmnFileAndGetUri(studioAgent, 'simple-decision.dmn');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('sets overlays on a DMN element', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.setOverlays', dmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const isSet = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.isOverlaysSet');
      assert.strictEqual(isSet, true);
    });

    it('clears all overlays for a URI', async () => {
      await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.setOverlays', dmnUri);

      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.clearOverlays', dmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const isSet = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.isOverlaysSet');
      assert.strictEqual(isSet, false);
    });

    it('returns error when setting overlays on non-existent URI', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.setOverlaysOnMissingUri');
      assert.ok(typeof result === 'string', 'Expected string');
      assert.ok(result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('returns error when subscribing to events on non-existent URI', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.subscribeOnMissingUri');
      assert.ok(typeof result === 'string', 'Expected string');
      assert.ok(result.startsWith('error:'), `Expected error, got: ${result}`);
    });
  });

  describe('overlay factory auto-render', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-api-factory',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getFactoryCallCount');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('overlay factory is invoked automatically when DMN file opens on DRD view', async () => {
      await openDmnFileAndGetUri(studioAgent, 'simple-decision.dmn');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const count = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getFactoryCallCount');
          return typeof count === 'number' && count > 0;
        },
        { timeout: 10_000, timeoutMsg: 'Overlay factory was never called after opening DMN file' },
      );

      const callCount = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getFactoryCallCount');
      assert.ok(callCount > 0, `Expected factory to be called at least once, got ${callCount}`);
    });
  });

  describe('view awareness', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-api-view-awareness',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getActiveView');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('getActiveView reports drd while on the DRD view', async () => {
      const dmnUri = await openDmnFileAndGetUri(studioAgent, 'kitchen-sink.dmn');

      const view = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getActiveView', dmnUri);
      assert.strictEqual(view?.viewType, 'drd', `Expected active view type to be 'drd', got: ${JSON.stringify(view)}`);
      assert.strictEqual(view?.isDrd, true, `Expected isDrd to be true, got: ${JSON.stringify(view)}`);
    });

    it('overlays are cleared from the DRD canvas when navigating away to a decision table', async () => {
      const dmnUri = await openDmnFileAndGetUri(studioAgent, 'kitchen-sink.dmn');

      const setResult = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.setOverlays', dmnUri);
      assert.strictEqual(setResult, 'ok');

      await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
      await studioAgent.assertBackToDrdButtonVisible();

      const overlayElements = await studioAgent.$$('.djs-overlay-container');
      assert.strictEqual(
        (await overlayElements.length) ?? 0,
        0,
        'Expected no DRD overlay containers while a non-DRD view is active',
      );

      await studioAgent.navigateBackToDrd();
      await studioAgent.assertBackToDrdButtonNotPresent();

      await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.clearOverlays', dmnUri);
    });

    it('subscribeViewChanged fires when switching between DRD and decision table', async () => {
      const dmnUri = await openDmnFileAndGetUri(studioAgent, 'kitchen-sink.dmn');

      const subscribeResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-overlay-demo.subscribeViewChanged',
        dmnUri,
      );
      assert.strictEqual(subscribeResult, 'ok');

      await studioAgent.drillDownIntoDecisionTable('Decision_Discount');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const lastViewChanged = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getLastViewChanged');
          return lastViewChanged != null;
        },
        { timeout: 10_000, timeoutMsg: 'onViewChanged never fired after drilling into decision table' },
      );

      await studioAgent.navigateBackToDrd();
    });
  });

  describe('element queries', () => {
    let studioAgent: StudioAgentDmnExtension;
    let dmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-api-queries',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getElements');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      dmnUri = await openDmnFileAndGetUri(studioAgent, 'simple-decision.dmn');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('getElements returns non-empty array of element snapshots', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getElements', dmnUri);
      assert.ok(Array.isArray(result), `Expected array, got: ${typeof result}`);
      assert.ok(result.length > 0, 'Expected at least one element');

      const firstElement = result[0];
      assert.ok('id' in firstElement, 'Element snapshot missing id');
      assert.ok('type' in firstElement, 'Element snapshot missing type');
    });

    it('getElement returns detail snapshot for existing element', async () => {
      const elements = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getElements', dmnUri);
      assert.ok(Array.isArray(elements) && elements.length > 0);

      const targetId = elements[0].id;
      const detail = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getElement', dmnUri, targetId);
      assert.ok(detail != null, 'Expected non-null detail snapshot');
      assert.strictEqual(detail.id, targetId);
      assert.ok('properties' in detail, 'Detail snapshot missing properties');
      assert.ok('incoming' in detail, 'Detail snapshot missing incoming');
      assert.ok('outgoing' in detail, 'Detail snapshot missing outgoing');
    });

    it('getElement returns null for non-existent element', async () => {
      const detail = await executePluginCommand(
        studioAgent,
        'plugin.dmn-overlay-demo.getElement',
        dmnUri,
        'NonExistentElement_xyz',
      );
      assert.strictEqual(detail, null);
    });

    it('getXml returns valid XML string', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getXml', dmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);
    });
  });

  // Order is pinned: these tests share the modeler's view, the pointer position and the
  // context-menu overlay. Hovering an element the pointer already rests on emits no new
  // mouseover, and a left-open context menu swallows the next interaction, so a shuffled
  // order makes every test but the first one fail.
  describe('element interaction events', { shuffle: false }, () => {
    let studioAgent: StudioAgentDmnExtension;
    let dmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-api-interaction-events',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.dmn-overlay-demo.subscribeHover');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      dmnUri = await openDmnFileAndGetUri(studioAgent, 'kitchen-sink.dmn');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGINS_DIR;
      delete process.env.BFR_SKIP_PERMISSION_DIALOG;
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
    });

    it('onElementHover fires when hovering a DRD element', async () => {
      const subscribeResult = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.subscribeHover', dmnUri);
      assert.strictEqual(subscribeResult, 'ok');

      await studioAgent.hoverOn('[data-element-id=Decision_Discount]');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const lastHovered = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getLastHovered');
          return lastHovered?.elementId === 'Decision_Discount';
        },
        { timeout: 10_000, timeoutMsg: 'onElementHover never fired for Decision_Discount' },
      );
    });

    it('onElementContextMenu fires when right-clicking a DRD element', async () => {
      const subscribeResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-overlay-demo.subscribeContextMenu',
        dmnUri,
      );
      assert.strictEqual(subscribeResult, 'ok');

      await studioAgent.rightClickOn('[data-element-id=Decision_Discount]');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const lastContextMenu = await executePluginCommand(studioAgent, 'plugin.dmn-overlay-demo.getLastContextMenu');
          return lastContextMenu?.elementId === 'Decision_Discount';
        },
        { timeout: 10_000, timeoutMsg: 'onElementContextMenu never fired for Decision_Discount' },
      );
    });

    // Runs last on purpose: the double click drills into the decision-table view, and returning
    // to the DRD re-creates its viewer, which drops subscriptions the other tests rely on.
    it('onElementDoubleClick fires when double-clicking a DRD element', async () => {
      const subscribeResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-overlay-demo.subscribeDoubleClick',
        dmnUri,
      );
      assert.strictEqual(subscribeResult, 'ok');

      await studioAgent.doubleClickOn('[data-element-id=Decision_Discount]');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const lastDoubleClicked = await executePluginCommand(
            studioAgent,
            'plugin.dmn-overlay-demo.getLastDoubleClicked',
          );
          return lastDoubleClicked?.elementId === 'Decision_Discount';
        },
        { timeout: 10_000, timeoutMsg: 'onElementDoubleClick never fired for Decision_Discount' },
      );

      // dmn-js opens the decision-table drill-down view on double click; return to the DRD so the
      // suite leaves the editor in its initial view.
      const activeView = await studioAgent.getActiveViewType();
      if (activeView != null && activeView !== 'drd') {
        await studioAgent.navigateBackToDrd();
      }
    });
  });
});
