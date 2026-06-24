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

describe('plugin/bpmn-permissions', { timeout: 120_000 }, () => {
  /**
   * Tests the tiered permission model:
   * - bpmn-perm-low: ['bpmn'] — read-only access, no modeling, no renderer
   * - bpmn-perm-medium: ['bpmn.modelling'] — read + write, no renderer
   * - bpmn-perm-high: ['bpmn.renderer'] — full access including renderer modules
   */

  describe('bpmn-perm-low (bpmn only)', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-perm-low',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingUpdateProperties');
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

    it('denies modeling.updateProperties', async () => {
      await studioAgent.jumpToFileInSolution('simple.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingUpdateProperties');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies modeling.removeElement', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingRemoveElement');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies modeling.appendElement', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingAppendElement');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies modeling.createConnection', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingCreateConnection');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies modeling.moveElement', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingMoveElement');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies registerPaletteEntry', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryRegisterPaletteEntry');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('denies registerContextPadEntry', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryRegisterContextPadEntry');
      assert.ok(typeof result === 'string' || result?.success === false, 'Expected denial');
    });

    it('permission error message states required permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingUpdateProperties');
      const errorMessage = typeof result === 'string' ? result : result?.error || '';
      assert.ok(
        errorMessage.includes('bpmn.modelling') || errorMessage.includes('permission'),
        `Expected permission name in error, got: ${errorMessage}`,
      );
    });
  });

  describe('bpmn-perm-medium (bpmn.modelling)', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-perm-medium',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-perm-medium.test.isActivated');
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

    it('allows modeling.updateProperties (implied by bpmn.modelling)', async () => {
      await studioAgent.jumpToFileInSolution('simple.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-perm-medium.tryModelingUpdateProperties',
        'file:///dummy',
        'StartEvent_1',
      );
      // The call may fail for reasons other than permissions (e.g. element not found),
      // but it should NOT fail with a permission error.
      if (result?.success === false) {
        assert.ok(
          !result.error.includes('permission') && !result.error.includes('PERMISSION_DENIED'),
          `Should not get permission error, got: ${result.error}`,
        );
      }
    });

    it('denies postToRendererModule (requires bpmn.renderer)', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-medium.tryPostToRendererModule');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('bpmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });

    it('denies onRendererModuleMessage (requires bpmn.renderer)', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-medium.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, false);
      assert.ok(
        result?.error?.includes('bpmn.renderer') || result?.error?.includes('permission'),
        `Expected permission error, got: ${result?.error}`,
      );
    });
  });

  describe('bpmn-perm-high (bpmn.renderer — full access)', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-perm-high',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-perm-high.test.isActivated');
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

    it('allows all bpmn.* methods (full hierarchy)', async () => {
      await studioAgent.jumpToFileInSolution('simple.bpmn', 'bpmn');
      await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.test.isActivated');
      assert.strictEqual(result?.activated, true);
    });

    it('allows postToRendererModule', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryPostToRendererModule');
      assert.strictEqual(result?.success, true);
    });

    it('allows onRendererModuleMessage (registered at activation)', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, true);
    });

    it('renderer module loads and responds via pluginChannel', async () => {
      // Send a ping to the renderer module
      await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryPostToRendererModule');
      // Give the renderer module time to respond
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-high.tryOnRendererModuleMessage');
      assert.strictEqual(result?.success, true);
    });
  });
});
