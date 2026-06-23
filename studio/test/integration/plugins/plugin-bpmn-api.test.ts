import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

const PLUGIN_LOAD_TIMEOUT = 30_000;

async function waitForPluginCommand(studioAgent: StudioAgent, commandId: string): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      return studioAgent
        .getTestDriver()
        .client!.execute((cmd: string) => (window as any).bifrost.commands.isRegistered(cmd), commandId);
    },
    { timeout: PLUGIN_LOAD_TIMEOUT, timeoutMsg: `Plugin command '${commandId}' was not registered in time` },
  );
}

async function executePluginCommand(studioAgent: StudioAgent, commandId: string, ...args: unknown[]): Promise<any> {
  return studioAgent
    .getTestDriver()
    .client!.execute(
      (cmd: string, cmdArgs: unknown[]) => (window as any).bifrost.commands.executeCommand(cmd, cmdArgs),
      commandId,
      args,
    );
}

async function openBpmnFileAndGetUri(studioAgent: StudioAgent, filename: string): Promise<string> {
  const fixtureDir = path.resolve(__dirname, '../../fixtures/test-solution-bpmn');
  const filePath = path.join(fixtureDir, filename);
  const fileUri = `file://${filePath}`;

  await studioAgent.jumpToFileInSolution(filename, 'bpmn');

  await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

  return fileUri;
}

describe('plugin/bpmn-api', { timeout: 120_000 }, () => {
  describe('permission gating', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({ testName: 'bpmn-api-perm', testFile: __filename });
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

    it('denies bpmn.setOverlays to plugin without bpmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-no-perm.trySetOverlays');
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-no-perm.trySetOverlays');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies bpmn.getElements to plugin without bpmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-no-perm.tryGetElements');
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-no-perm.tryGetElements');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies bpmn.onElementSelected to plugin without bpmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-no-perm.trySubscribe');
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-no-perm.trySubscribe');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies bpmn.getXml to plugin without bpmn permission', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-no-perm.tryGetXml');
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-no-perm.tryGetXml');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });
  });

  describe('overlay lifecycle', () => {
    let studioAgent: StudioAgent;
    let bpmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({ testName: 'bpmn-api-overlays', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.setOverlays');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
      bpmnUri = await openBpmnFileAndGetUri(studioAgent, 'definition.bpmn');
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

    it('sets overlays on a BPMN element', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.setOverlays', bpmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const isSet = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.isOverlaysSet');
      assert.strictEqual(isSet, true);
    });

    it('clears all overlays for a URI', async () => {
      await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.setOverlays', bpmnUri);

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.clearOverlays', bpmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const isSet = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.isOverlaysSet');
      assert.strictEqual(isSet, false);
    });

    it('returns error when setting overlays on non-existent URI', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.setOverlaysOnMissingUri');
      assert.ok(typeof result === 'string', 'Expected string');
      assert.ok(result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('returns error when subscribing to events on non-existent URI', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.subscribeOnMissingUri');
      assert.ok(typeof result === 'string', 'Expected string');
      assert.ok(result.startsWith('error:'), `Expected error, got: ${result}`);
    });
  });

  describe('overlay factory auto-render', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({ testName: 'bpmn-api-factory', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getFactoryCallCount');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
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

    it('overlay factory is invoked automatically when BPMN file opens', async () => {
      await openBpmnFileAndGetUri(studioAgent, 'definition.bpmn');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const count = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getFactoryCallCount');
          return typeof count === 'number' && count > 0;
        },
        { timeout: 10_000, timeoutMsg: 'Overlay factory was never called after opening BPMN file' },
      );

      const callCount = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getFactoryCallCount');
      assert.ok(callCount > 0, `Expected factory to be called at least once, got ${callCount}`);
    });
  });

  describe('element queries', () => {
    let studioAgent: StudioAgent;
    let bpmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({ testName: 'bpmn-api-queries', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getElements');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
      bpmnUri = await openBpmnFileAndGetUri(studioAgent, 'definition.bpmn');
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
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getElements', bpmnUri);
      assert.ok(Array.isArray(result), `Expected array, got: ${typeof result}`);
      assert.ok(result.length > 0, 'Expected at least one element');

      const firstElement = result[0];
      assert.ok('id' in firstElement, 'Element snapshot missing id');
      assert.ok('type' in firstElement, 'Element snapshot missing type');
    });

    it('getElement returns detail snapshot for existing element', async () => {
      const elements = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getElements', bpmnUri);
      assert.ok(Array.isArray(elements) && elements.length > 0);

      const targetId = elements[0].id;
      const detail = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getElement', bpmnUri, targetId);
      assert.ok(detail != null, 'Expected non-null detail snapshot');
      assert.strictEqual(detail.id, targetId);
      assert.ok('properties' in detail, 'Detail snapshot missing properties');
      assert.ok('incoming' in detail, 'Detail snapshot missing incoming');
      assert.ok('outgoing' in detail, 'Detail snapshot missing outgoing');
    });

    it('getElement returns null for non-existent element', async () => {
      const detail = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-overlay-demo.getElement',
        bpmnUri,
        'NonExistentElement_xyz',
      );
      assert.strictEqual(detail, null);
    });

    it('getXml returns valid XML string', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-overlay-demo.getXml', bpmnUri);
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);
    });
  });
});
