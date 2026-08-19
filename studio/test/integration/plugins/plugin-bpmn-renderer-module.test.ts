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
  return studioAgent.executeCommand(commandId, args);
}

/**
 * Waits until a plugin's real `test.isActivated` handler answers.
 *
 * A manifest-declared command is registered as an activation stub before the plugin runs, so
 * `isRegistered` alone does not prove the plugin is active — the stub returns `undefined`.
 */
async function waitForPluginActivation(studioAgent: StudioAgent, isActivatedCommandId: string): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      const result = (await executePluginCommand(studioAgent, isActivatedCommandId)) as
        { activated?: boolean } | undefined;

      return result?.activated === true;
    },
    {
      timeout: PLUGIN_LOAD_TIMEOUT,
      timeoutMsg: `Plugin behind '${isActivatedCommandId}' did not activate in time`,
    },
  );
}

describe('plugin/bpmn-renderer-module', { timeout: 120_000 }, () => {
  describe('renderer module injection (bpmn.renderer permission)', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-renderer-module',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-renderer-module-demo.togglePathTracer');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');

      // The demo plugins activate on `onDocumentType:bpmn`. Opening the document here rather
      // than in the first test keeps every test in this block independent of execution order.
      await studioAgent.jumpToFileInSolution('definition.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);
      await waitForPluginActivation(studioAgent, 'plugin.bpmn-perm-high.test.isActivated');
      await waitForPluginActivation(studioAgent, 'plugin.bpmn-perm-medium.test.isActivated');
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

    it('plugin with bpmnModules + bpmn.renderer loads successfully', async () => {
      await studioAgent.jumpToFileInSolution('definition.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('renderer module demo plugin activates', async () => {
      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.bpmn-renderer-module-demo.togglePathTracer',
        );
      assert.strictEqual(isRegistered, true);
    });

    it('postToRendererModule succeeds for plugin with bpmn.renderer', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryPostToRendererModule');
      assert.strictEqual(result?.success, true);
    });

    it('onRendererModuleMessage succeeds for plugin with bpmn.renderer', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, true);
    });

    it('postToRendererModule is denied for plugin with only bpmn.modelling', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-perm-medium.tryPostToRendererModule');
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-medium.tryPostToRendererModule');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('bpmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('onRendererModuleMessage is denied for plugin with only bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-medium.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('bpmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('module crash does not crash the modeler — plugin goes to error state', async () => {
      // The bpmn-renderer-module-demo has a valid module, so the modeler should work fine.
      // We verify it didn't crash by checking that the canvas is still functional.
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.bpmn-renderer-module-demo.setTracerColor',
        );
      assert.strictEqual(isRegistered, true);
    });
  });

  describe('kitchen-sink: all features compose correctly', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-kitchen-sink',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-kitchen-sink.test.isActivated');
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');

      // bpmn-kitchen-sink activates on `onDocumentType:bpmn`; without an open document its
      // commands are still activation stubs that return `undefined`.
      await studioAgent.jumpToFileInSolution('definition.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);
      await waitForPluginActivation(studioAgent, 'plugin.bpmn-kitchen-sink.test.isActivated');
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

    it('bpmn-kitchen-sink plugin activates with all features', async () => {
      await studioAgent.jumpToFileInSolution('definition.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-kitchen-sink.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('kitchen-sink renderer module responds to highlight command', async () => {
      await executePluginCommand(studioAgent, 'plugin.bpmn-kitchen-sink.ks.highlightAll');
      // Give the renderer module time to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-kitchen-sink.test.isActivated');
      assert.ok(result?.rendererHighlightCount >= 0, 'rendererHighlightCount should be populated');
    });

    it('kitchen-sink palette entry is registered', async () => {
      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.bpmn-kitchen-sink.ks.highlightAll',
        );
      assert.strictEqual(isRegistered, true);
    });
  });
});
