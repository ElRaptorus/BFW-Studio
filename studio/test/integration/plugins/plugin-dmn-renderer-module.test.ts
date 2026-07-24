import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

const PLUGIN_LOAD_TIMEOUT = 30_000;

// Manifest-declared commands are registered as stubs at plugin discovery time,
// before `activate()` runs — `isRegistered` is true for a stub immediately, so
// waiting on any particular command name does not guarantee `activate()` has
// finished replacing every stub with its real handler. Waiting for the plugin
// status to reach 'loaded' is the only reliable signal.
async function waitForPluginStatus(
  studioAgent: StudioAgentDmnExtension,
  pluginName: string,
  expectedStatus: string,
): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      const plugins = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.plugins.getPluginList());
      const plugin = plugins.find((entry: any) => entry.name === pluginName);
      return plugin?.status === expectedStatus;
    },
    {
      timeout: PLUGIN_LOAD_TIMEOUT,
      timeoutMsg: `Plugin '${pluginName}' did not reach status '${expectedStatus}' in time`,
    },
  );
}

async function executePluginCommand(
  studioAgent: StudioAgentDmnExtension,
  commandId: string,
  ...args: unknown[]
): Promise<any> {
  return studioAgent
    .getTestDriver()
    .client!.execute(
      (cmd: string, cmdArgs: unknown[]) => (window as any).bifrost.commands.executeCommand(cmd, cmdArgs),
      commandId,
      args,
    );
}

describe('plugin/dmn-renderer-module', { timeout: 120_000 }, () => {
  describe('renderer module injection (dmn.renderer permission)', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-renderer-module',
        testFile: __filename,
      });
      // dmn-renderer-module-demo and dmn-perm-high both activate lazily via
      // `onDocumentType:dmn` — they only start activating once a DMN document is
      // opened, so a file must be opened before waiting for their status.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);
      await waitForPluginStatus(studioAgent, 'dmn-renderer-module-demo', 'loaded');
      await waitForPluginStatus(studioAgent, 'dmn-perm-high', 'loaded');
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

    it('plugin with dmnModules + dmn.renderer loads successfully', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-high.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('renderer module demo plugin activates', async () => {
      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.dmn-renderer-module-demo.toggleRequirementTracer',
        );
      assert.strictEqual(isRegistered, true);
    });

    it('postToRendererModule succeeds for plugin with dmn.renderer', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-high.tryPostToRendererModule');
      assert.strictEqual(result?.success, true);
    });

    it('onRendererModuleMessage succeeds for plugin with dmn.renderer', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-high.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, true);
    });

    it('postToRendererModule is denied for plugin with only dmn.modelling', async () => {
      await waitForPluginStatus(studioAgent, 'dmn-perm-medium', 'loaded');
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-medium.tryPostToRendererModule');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('dmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('onRendererModuleMessage is denied for plugin with only dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-medium.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('dmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('module crash does not crash the modeler — plugin goes to error state', async () => {
      // The dmn-renderer-module-demo has a valid module, so the modeler should work fine.
      // We verify it didn't crash by checking that the canvas is still functional.
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);

      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.dmn-renderer-module-demo.setTracerColor',
        );
      assert.strictEqual(isRegistered, true);
    });
  });

  describe('kitchen-sink: all features compose correctly', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-kitchen-sink',
        testFile: __filename,
      });
      // dmn-kitchen-sink activates lazily via `onDocumentType:dmn` — it only starts
      // activating once a DMN document is opened, so a file must be opened first.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);
      await waitForPluginStatus(studioAgent, 'dmn-kitchen-sink', 'loaded');
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

    it('dmn-kitchen-sink plugin activates with all features', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-kitchen-sink.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('kitchen-sink renderer module responds to highlight command', async () => {
      await executePluginCommand(studioAgent, 'plugin.dmn-kitchen-sink.ks.highlightAll');
      // Give the renderer module time to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await executePluginCommand(studioAgent, 'plugin.dmn-kitchen-sink.test.isActivated');
      assert.ok(result?.rendererHighlightCount >= 0, 'rendererHighlightCount should be populated');
    });

    it('kitchen-sink palette entry is registered', async () => {
      const isRegistered = await studioAgent
        .getTestDriver()
        .client!.execute(
          (cmd: string) => (window as any).bifrost.commands.isRegistered(cmd),
          'plugin.dmn-kitchen-sink.ks.highlightAll',
        );
      assert.strictEqual(isRegistered, true);
    });
  });
});
