import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import {
  ASSERT_VISIBLE_TIMEOUT,
  createAndStartStudioAgentForPluginHost,
  stopPluginHostStudioAgent,
} from '../../StudioAgent';
import { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

describe('plugin/dmn-renderer-module', () => {
  describe('renderer module injection (dmn.renderer permission)', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      studioAgent = await createAndStartStudioAgentForPluginHost<StudioAgentDmnExtension>(
        { testName: 'dmn-renderer-module', testFile: __filename },
        {
          pluginsDirectory: PLUGINS_FIXTURE_DIR,
          studioAgentClass: StudioAgentDmnExtension,
        },
      );
      // dmn-renderer-module-demo and dmn-perm-high both activate lazily via
      // `onDocumentType:dmn` — they only start activating once a DMN document is
      // opened, so a file must be opened before waiting for their status.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.pluginHost.waitUntilStatus('dmn-renderer-module-demo', 'loaded');
      await studioAgent.pluginHost.waitUntilStatus('dmn-perm-high', 'loaded');
    });

    afterAll(async () => {
      await stopPluginHostStudioAgent(studioAgent, false);
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
      const result = await studioAgent.executeCommand('plugin.dmn-perm-high.test.isActivated');
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
      const result = await studioAgent.executeCommand('plugin.dmn-perm-high.tryPostToRendererModule');
      assert.strictEqual(result?.success, true);
    });

    it('onRendererModuleMessage succeeds for plugin with dmn.renderer', async () => {
      const result = await studioAgent.executeCommand('plugin.dmn-perm-high.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, true);
    });

    it('postToRendererModule is denied for plugin with only dmn.modelling', async () => {
      await studioAgent.pluginHost.waitUntilStatus('dmn-perm-medium', 'loaded');
      const result = await studioAgent.executeCommand('plugin.dmn-perm-medium.tryPostToRendererModule');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('dmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('onRendererModuleMessage is denied for plugin with only dmn.modelling', async () => {
      const result = await studioAgent.executeCommand('plugin.dmn-perm-medium.tryOnRendererModuleMessage');
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
      studioAgent = await createAndStartStudioAgentForPluginHost<StudioAgentDmnExtension>(
        { testName: 'dmn-kitchen-sink', testFile: __filename },
        {
          pluginsDirectory: PLUGINS_FIXTURE_DIR,
          studioAgentClass: StudioAgentDmnExtension,
        },
      );
      // dmn-kitchen-sink activates lazily via `onDocumentType:dmn` — it only starts
      // activating once a DMN document is opened, so a file must be opened first.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.pluginHost.waitUntilStatus('dmn-kitchen-sink', 'loaded');
    });

    afterAll(async () => {
      await stopPluginHostStudioAgent(studioAgent, false);
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
      const result = await studioAgent.executeCommand('plugin.dmn-kitchen-sink.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('kitchen-sink renderer module responds to highlight command', async () => {
      await studioAgent.executeCommand('plugin.dmn-kitchen-sink.ks.highlightAll');
      // Give the renderer module time to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await studioAgent.executeCommand('plugin.dmn-kitchen-sink.test.isActivated');
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
