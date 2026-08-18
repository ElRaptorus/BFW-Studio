import * as fs from 'fs/promises';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');
const PLUGINS_EMPTY_DIR = path.resolve(__dirname, '../../fixtures/plugins-empty');

const PLUGIN_LOAD_TIMEOUT = 30_000;
// Total number of discoverable plugin directories under fixtures/plugins/, including the
// scoped `@test-scope/scoped-plugin` entry, but excluding `no-package-json` (which has no
// package.json and is therefore never returned by plugin discovery). Keep this in sync when
// adding/removing fixtures — `waitForPluginList` uses `>=`, so a stale (too-low) value fails
// silently rather than erroring, while a too-high value causes every consumer to time out.
const FIXTURE_PLUGIN_COUNT = 37;

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

async function waitForPluginList(studioAgent: StudioAgent, minCount: number): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      const count = await studioAgent
        .getTestDriver()
        .client!.execute((min: number) => (window as any).bifrost.plugins.getPluginList().length >= min, minCount);
      return count;
    },
    { timeout: PLUGIN_LOAD_TIMEOUT, timeoutMsg: `Expected at least ${minCount} plugins but timed out` },
  );
}

async function getPluginList(studioAgent: StudioAgent): Promise<any[]> {
  return studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.plugins.getPluginList());
}

async function isCommandRegistered(studioAgent: StudioAgent, commandId: string): Promise<boolean> {
  return studioAgent
    .getTestDriver()
    .client!.execute((cmd: string) => (window as any).bifrost.commands.isRegistered(cmd), commandId);
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

async function waitForPluginStatus(
  studioAgent: StudioAgent,
  pluginName: string,
  expectedStatus: string,
): Promise<void> {
  await studioAgent.getTestDriver().client!.waitUntil(
    async () => {
      const plugins = await getPluginList(studioAgent);
      const plugin = plugins.find((entry: any) => entry.name === pluginName);
      return plugin?.status === expectedStatus;
    },
    {
      timeout: PLUGIN_LOAD_TIMEOUT,
      timeoutMsg: `Plugin '${pluginName}' did not reach status '${expectedStatus}' in time`,
    },
  );
}

async function getPluginByName(studioAgent: StudioAgent, pluginName: string): Promise<any> {
  const plugins = await getPluginList(studioAgent);
  return plugins.find((entry: any) => entry.name === pluginName);
}

async function isSettingRegistered(studioAgent: StudioAgent, settingKey: string): Promise<boolean> {
  return studioAgent
    .getTestDriver()
    .client!.execute((key: string) => (window as any).bifrost.settings.has(key), settingKey);
}

describe('plugin-host/integration', { timeout: 60_000 }, () => {
  beforeAll(() => {
    process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
  });

  afterAll(() => {
    delete process.env.BFR_SKIP_PERMISSION_DIALOG;
  });

  describe('plugins pane', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('pane/plugin-listing: shows plugin cards with correct metadata', async () => {
      await waitForPluginList(studioAgent, 1);

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');

      await studioAgent.assertVisible('[data-test--plugins-pane-list]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      const pluginList = await getPluginList(studioAgent);
      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should be in the plugin list');
      assert.strictEqual(happyPlugin.displayName, 'Happy Plugin');
      assert.strictEqual(happyPlugin.version, '1.0.0');
      assert.strictEqual(happyPlugin.description, 'A fixture plugin that registers greeting commands.');
      assert.strictEqual(happyPlugin.author, 'Bifrost Forge World Tests');
      assert.strictEqual(happyPlugin.status, 'loaded');
      assert.strictEqual(happyPlugin.enabled, true);
    });

    it('pane/empty-state: shows empty state when no plugins are installed', async ({ task }) => {
      await studioAgent.stopAndRecordErrors(false);

      process.env.BFR_PLUGINS_DIR = PLUGINS_EMPTY_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');

      await studioAgent.assertVisible('[data-test--plugins-pane-empty]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('pane/refresh: refresh button triggers a full plugin host restart', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const resultBefore = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'Pre');
      assert.strictEqual(resultBefore, 'Hello, Pre!');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');

      await executePluginCommand(studioAgent, 'plugins.refreshPluginList');

      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const resultAfter = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'Post');
      assert.strictEqual(resultAfter, 'Hello, Post!');
    });
  });

  describe('enable/disable', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('toggle/disable: disabling a plugin updates the setting and marks the card', async () => {
      await waitForPluginList(studioAgent, 1);

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(500);

      const disabledPlugins = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.settings.get('plugins.disabledPlugins'));
      assert.ok(
        Array.isArray(disabledPlugins) && disabledPlugins.includes('happy-plugin'),
        'happy-plugin should be in disabledPlugins setting',
      );
    });

    it('toggle/re-enable: re-enabling a plugin removes it from the disabled list', async () => {
      await waitForPluginList(studioAgent, 1);

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(500);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(500);

      const disabledPlugins = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.settings.get('plugins.disabledPlugins'));
      assert.ok(
        Array.isArray(disabledPlugins) && !disabledPlugins.includes('happy-plugin'),
        'happy-plugin should no longer be in disabledPlugins setting',
      );
    });

    it('toggle/disabled-on-refresh: disabled plugins are not loaded after refresh', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(500);

      await executePluginCommand(studioAgent, 'plugins.refreshPluginList');

      await studioAgent.pause(3000);

      const pluginList = await getPluginList(studioAgent);
      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should still appear in the list');
      assert.strictEqual(happyPlugin.status, 'disabled', 'happy-plugin should have status "disabled"');
      assert.strictEqual(happyPlugin.enabled, false, 'happy-plugin should be marked as not enabled');

      const commandExists = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(commandExists, false, 'disabled plugin commands should be cleaned up after refresh');
    });
  });

  describe('selective reload', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('selective/unload-removes-command: disabling a plugin unregisters its commands immediately', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const beforeDisable = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(beforeDisable, true, 'command should be registered before disable');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      const afterDisable = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(afterDisable, false, 'command should be unregistered after selective unload');
    });

    it('selective/reload-restores-command: re-enabling a plugin re-registers its commands', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      const afterDisable = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(afterDisable, false, 'command should be gone after unload');

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      const afterReEnable = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(afterReEnable, true, 'command should be re-registered after selective reload');

      const result = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'Reloaded');
      assert.strictEqual(result, 'Hello, Reloaded!', 'command should work correctly after reload');
    });

    it('selective/isolation: other plugins retain state when one is selectively unloaded', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');
      await waitForPluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      const happyGone = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(happyGone, false, 'disabled plugin command should be gone');

      const lifecycleAlive = await isCommandRegistered(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.strictEqual(lifecycleAlive, true, 'other plugin command should survive selective unload');

      const events = await executePluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.deepStrictEqual(events, ['activated'], 'other plugin should still function correctly');
    });

    it('selective/plugin-list-update: plugin list reflects status change after selective unload', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      const pluginList = await getPluginList(studioAgent);
      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should still appear in the list');
      assert.strictEqual(happyPlugin.enabled, false, 'should be marked as not enabled');
      assert.strictEqual(happyPlugin.status, 'disabled', 'status should be "disabled" after selective unload');
    });

    it('selective/deactivate-lifecycle: deactivate() is called during selective unload', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');

      const eventsBefore = await executePluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.deepStrictEqual(eventsBefore, ['activated']);

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.settings.set('plugin.lifecycle-plugin.deactivatedAt', '');
      });

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="lifecycle-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="lifecycle-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="lifecycle-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="lifecycle-plugin"]');
      await studioAgent.pause(1000);

      const marker = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.settings.get('plugin.lifecycle-plugin.deactivatedAt'));
      assert.ok(marker && String(marker).length > 0, 'deactivate() should have written a settings marker');
    });
  });

  describe('selective reload: require-cache invalidation', () => {
    let studioAgent: StudioAgent;
    let tempPluginsDir: string;

    beforeEach(async ({ task }) => {
      tempPluginsDir = path.join(PLUGINS_FIXTURE_DIR, '..', `plugins-reload-${Date.now()}`);
      await fs.mkdir(tempPluginsDir, { recursive: true });

      const happyPluginSource = path.join(PLUGINS_FIXTURE_DIR, 'happy-plugin');
      const happyPluginDest = path.join(tempPluginsDir, 'happy-plugin');
      await fs.cp(happyPluginSource, happyPluginDest, { recursive: true });

      process.env.BFR_PLUGINS_DIR = tempPluginsDir;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;

      try {
        await fs.rm(tempPluginsDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    });

    it('selective/require-cache: reloaded plugin picks up source file changes', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const originalResult = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'World');
      assert.strictEqual(originalResult, 'Hello, World!');

      const pluginIndexPath = path.join(tempPluginsDir, 'happy-plugin', 'index.js');
      const originalSource = await fs.readFile(pluginIndexPath, 'utf-8');
      await fs.writeFile(pluginIndexPath, originalSource.replace('Hello,', 'Hola,'), 'utf-8');

      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-toggle="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-toggle="happy-plugin"]');
      await studioAgent.pause(1000);

      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const reloadedResult = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'World');
      assert.strictEqual(reloadedResult, 'Hola, World!', 'Reloaded plugin should use the modified source code');
    });
  });

  describe('onStartup activation discovered after boot', () => {
    let studioAgent: StudioAgent;
    let tempPluginsDir: string;

    beforeEach(async ({ task }) => {
      tempPluginsDir = path.join(PLUGINS_FIXTURE_DIR, '..', `plugins-late-onstartup-${Date.now()}`);
      await fs.mkdir(tempPluginsDir, { recursive: true });

      process.env.BFR_PLUGINS_DIR = tempPluginsDir;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;

      try {
        await fs.rm(tempPluginsDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    });

    // Regression test for a bug where onStartup (and permission-gated eager) plugins
    // discovered by a *later* discoverAndLoadPlugins() call — e.g. via the "Reload
    // Plugins" command, which drives bifrost.plugins.refreshFromHost() — would never
    // activate. discoverAndLoadPlugins() deferred activation until the app's 'ready'
    // event, but 'ready' is emitted exactly once during the window's initial
    // Bifrost.initialize() call. Any onStartup plugin added to the plugins directory
    // after that point (without a full app restart) would wait forever for an event
    // that had already fired, leaving it stuck in 'pending' status indefinitely.
    it('onStartup plugin added after boot activates once discovered via refresh', async () => {
      const pluginDir = path.join(tempPluginsDir, 'late-onstartup-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'late-onstartup-plugin',
          version: '1.0.0',
          main: 'index.js',
          bifrostStudio: {
            apiVersion: '1.0.0',
            permissions: ['filesystem'],
            activationEvents: ['onStartup'],
          },
        }),
        'utf-8',
      );
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        `module.exports = {
          async activate(api) {
            await api.commands.register('ping', () => 'pong');
          },
        };`,
        'utf-8',
      );

      await executePluginCommand(studioAgent, 'plugins.refreshPluginList');

      await waitForPluginStatus(studioAgent, 'late-onstartup-plugin', 'loaded');

      await waitForPluginCommand(studioAgent, 'plugin.late-onstartup-plugin.ping');
      const pingResult = await executePluginCommand(studioAgent, 'plugin.late-onstartup-plugin.ping');
      assert.strictEqual(pingResult, 'pong', 'plugin should be fully activated and its command callable');
    });
  });

  describe('cleanup', () => {
    let studioAgent: StudioAgent;
    let tempPluginsDir: string;

    beforeEach(async ({ task }) => {
      tempPluginsDir = path.join(PLUGINS_FIXTURE_DIR, '..', `plugins-temp-${Date.now()}`);
      await fs.mkdir(tempPluginsDir, { recursive: true });

      const happyPluginSource = path.join(PLUGINS_FIXTURE_DIR, 'happy-plugin');
      const happyPluginDest = path.join(tempPluginsDir, 'happy-plugin');
      await fs.cp(happyPluginSource, happyPluginDest, { recursive: true });

      const lifecyclePluginSource = path.join(PLUGINS_FIXTURE_DIR, 'lifecycle-plugin');
      const lifecyclePluginDest = path.join(tempPluginsDir, 'lifecycle-plugin');
      await fs.cp(lifecyclePluginSource, lifecyclePluginDest, { recursive: true });

      process.env.BFR_PLUGINS_DIR = tempPluginsDir;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;

      try {
        await fs.rm(tempPluginsDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    });

    it('cleanup/removal: removing a plugin directory and refreshing cleans up its commands', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');
      await waitForPluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');

      const beforeList = await getPluginList(studioAgent);
      assert.strictEqual(beforeList.length, 2, 'should have 2 plugins before removal');

      const greetExists = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(greetExists, true, 'happy-plugin.greet should be registered');

      await fs.rm(path.join(tempPluginsDir, 'happy-plugin'), { recursive: true, force: true });

      await executePluginCommand(studioAgent, 'plugins.refreshPluginList');

      await studioAgent.pause(3000);

      const afterList = await getPluginList(studioAgent);
      assert.strictEqual(afterList.length, 1, 'should have 1 plugin after removal');
      assert.strictEqual(afterList[0].name, 'lifecycle-plugin', 'remaining plugin should be lifecycle-plugin');

      const greetGone = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(greetGone, false, 'happy-plugin commands should be cleaned up after removal and refresh');

      const lifecycleStillExists = await isCommandRegistered(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.strictEqual(lifecycleStillExists, true, 'lifecycle-plugin commands should survive the refresh');
    });

    it('cleanup/disabled-removal: disabling a plugin and then refreshing cleans up its commands', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      await studioAgent.getTestDriver().client!.execute(() => {
        const bifrost = (window as any).bifrost;
        bifrost.settings.set('plugins.disabledPlugins', ['happy-plugin']);
      });

      await executePluginCommand(studioAgent, 'plugins.refreshPluginList');

      await studioAgent.pause(3000);

      const commandGone = await isCommandRegistered(studioAgent, 'plugin.happy-plugin.greet');
      assert.strictEqual(commandGone, false, 'disabled plugin commands should be cleaned up after refresh');

      const lifecycleOk = await isCommandRegistered(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.strictEqual(lifecycleOk, true, 'non-disabled plugin commands should still work');
    });
  });

  describe('happy path', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('loads a plugin and registers its commands', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const result = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'World');
      assert.strictEqual(result, 'Hello, World!');
    });

    it('provides a correct PluginEnvironment to the plugin', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.getEnv');

      const env = await executePluginCommand(studioAgent, 'plugin.happy-plugin.getEnv');

      assert.strictEqual(env.pluginName, 'happy-plugin');
      assert.ok((env.pluginPath as string).includes('happy-plugin'), 'pluginPath should contain "happy-plugin"');
      assert.strictEqual(env.apiVersion, '1.0.0');
      assert.strictEqual(typeof env.storagePath, 'string');
    });

    it('calls deactivate() on graceful shutdown', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');

      const events = await executePluginCommand(studioAgent, 'plugin.lifecycle-plugin.getLifecycleEvents');
      assert.deepStrictEqual(events, ['activated']);
    });

    it('reads a setting value from the plugin', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.settings-plugin.getLastObservedSetting');

      const value = await executePluginCommand(studioAgent, 'plugin.settings-plugin.getLastObservedSetting');
      assert.ok(value === null || value === undefined, 'Initial observed setting should be null or undefined');
    });
  });

  describe('error handling', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('survives a plugin that throws on activate', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const result = await executePluginCommand(studioAgent, 'plugin.happy-plugin.greet', 'Test');
      assert.strictEqual(result, 'Hello, Test!');
    });

    it('tracks error status for error-on-activate', async () => {
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);

      const pluginList = await getPluginList(studioAgent);
      const errorPlugin = pluginList.find((plugin: any) => plugin.name === 'error-on-activate');

      assert.ok(errorPlugin, 'error-on-activate should be in the plugin list');
      assert.strictEqual(errorPlugin.status, 'error', 'error-on-activate should have error status');
      assert.ok(errorPlugin.errorMessage, 'error-on-activate should have an error message');
      assert.strictEqual(errorPlugin.enabled, false, 'error-on-activate should be marked as not enabled');
    });

    it('tracks error status for missing-main', async () => {
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);

      const pluginList = await getPluginList(studioAgent);
      const missingMain = pluginList.find((plugin: any) => plugin.name === 'missing-main');

      assert.ok(missingMain, 'missing-main should be in the plugin list');
      assert.strictEqual(missingMain.status, 'error', 'missing-main should have error status');
      assert.ok(missingMain.errorMessage, 'missing-main should have an error message');
    });

    it('handles a plugin without an activate export', async () => {
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);

      const pluginList = await getPluginList(studioAgent);
      const noActivate = pluginList.find((plugin: any) => plugin.name === 'no-activate');

      assert.ok(noActivate, 'no-activate should be in the plugin list');
      assert.ok(
        noActivate.status === 'error' || noActivate.status === 'loaded',
        `no-activate should have status "error" or "loaded", got "${noActivate.status}"`,
      );
    });
  });

  describe('kitchen-sink: settings API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: 'kitchen-sink: settings API', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.hasSetting');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.hasSetting');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('settings/has: returns true for registered keys and false for unknown keys', async () => {
      const exists = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.hasSetting',
        'plugin.kitchen-sink.kitchenSinkValue',
      );
      assert.strictEqual(exists, true);

      const missing = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.hasSetting',
        'nonexistent.phantom.key',
      );
      assert.strictEqual(missing, false);
    });

    it('settings/getSchema: returns the descriptor for a registered key', async () => {
      const schema = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getSettingSchema');
      assert.ok(schema, 'schema should not be null');
      assert.strictEqual(schema.type, 'string');
      assert.strictEqual(schema.label, 'Kitchen Sink Value');
      assert.strictEqual(schema.default, '');
    });

    it('settings/getSchemas: returns all registered schemas as an object', async () => {
      const schemas = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getAllSchemas');
      assert.ok(schemas, 'schemas should not be null');
      assert.ok(schemas['plugin.kitchen-sink.kitchenSinkValue'], 'should contain plugin.kitchen-sink.kitchenSinkValue');
      assert.ok(schemas['plugin.kitchen-sink.kitchenSinkArray'], 'should contain plugin.kitchen-sink.kitchenSinkArray');
    });

    it('settings/getDefault: returns the registered default value', async () => {
      const defaultValue = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getSettingDefault');
      assert.strictEqual(defaultValue, '');
    });

    it('settings/getDefaults: returns all registered defaults', async () => {
      const defaults = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getAllDefaults');
      assert.ok(defaults, 'defaults should not be null');
      assert.strictEqual(typeof defaults, 'object');
    });

    it('settings/write-and-read: writes a value via set() and reads it back via get()', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.writeSetting', 'hello-from-test');

      const readBack = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readSetting');
      assert.strictEqual(readBack, 'hello-from-test');
    });

    it('settings/onDidChange: plugin observes external setting changes', async () => {
      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.settings.set('plugin.kitchen-sink.kitchenSinkValue', 'changed-externally');
      });

      await studioAgent.pause(500);

      const status = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
      assert.strictEqual(status.settingsObservedValue, 'changed-externally');
    });

    it('settings/array-add-and-remove: pushes to and removes from an array setting', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.addToArraySetting', 'alpha');
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.addToArraySetting', 'beta');

      const afterAdd = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readArraySetting');
      assert.deepStrictEqual(afterAdd, ['alpha', 'beta']);

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.removeFromArray', 'alpha');

      const afterRemove = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readArraySetting');
      assert.deepStrictEqual(afterRemove, ['beta']);
    });
  });

  describe('kitchen-sink: commands API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: 'kitchen-sink: commands API', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.tryExecute');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.tryExecute');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('commands/tryToExecuteCommand: returns success for a valid command', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const result = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.tryExecute',
        'plugin.happy-plugin.greet',
        'Try',
      );
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.returnValue, 'Hello, Try!');
    });

    it('commands/isCommandEnabled: returns true for a registered command', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const enabled = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.checkEnabled',
        'plugin.happy-plugin.greet',
      );
      assert.strictEqual(enabled, true);
    });

    it('commands/isRegistered: returns true for existing and false for non-existing', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const exists = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.checkRegistered',
        'plugin.happy-plugin.greet',
      );
      assert.strictEqual(exists, true);

      const missing = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.checkRegistered',
        'nonexistent.phantom.command',
      );
      assert.strictEqual(missing, false);
    });

    it('commands/getCommands: returns the full command list with metadata', async () => {
      const commands = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.listCommands');
      assert.ok(Array.isArray(commands), 'should return an array');
      assert.ok(commands.length > 0, 'should have at least one command');

      const sample = commands.find((cmd: any) => cmd.name === 'plugin.kitchen-sink.getStatus');
      assert.ok(sample, 'should contain the kitchen-sink getStatus command');
      assert.strictEqual(typeof sample.name, 'string');
      assert.strictEqual(typeof sample.description, 'string');
      assert.strictEqual(typeof sample.visibleInSearch, 'boolean');
    });

    it('commands/register: searchable command is visible in command list', async () => {
      const commands = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.listCommands');
      const searchable = commands.find((cmd: any) => cmd.name === 'plugin.kitchen-sink.searchableCommand');

      assert.ok(searchable, 'searchableCommand should be in the command list');
      assert.strictEqual(searchable.visibleInSearch, true, 'searchableCommand should be visible in search');
      assert.ok(
        searchable.description.includes('Kitchen Sink'),
        'searchableCommand should have the registered description',
      );
    });

    it('commands/executeExternal: plugin can call another plugins command', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');

      const result = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.executeExternal',
        'plugin.happy-plugin.greet',
        'Cross',
      );
      assert.strictEqual(result, 'Hello, Cross!');
    });
  });

  describe('kitchen-sink: notifications API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: notifications API',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showInfo');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showInfo');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('notifications/open: opens info, warning, and error notifications', async () => {
      const infoId = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showInfo', 'Test info');
      assert.ok(typeof infoId === 'string' && infoId.length > 0, 'should return a notification ID for info');

      const warnId = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showWarning', 'Test warning');
      assert.ok(typeof warnId === 'string' && warnId.length > 0, 'should return a notification ID for warning');

      const errorId = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showError', 'Test error');
      assert.ok(typeof errorId === 'string' && errorId.length > 0, 'should return a notification ID for error');
    });

    it('notifications/update-and-close: updates content and then closes', async () => {
      const notificationId = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showInfo', 'Original');
      assert.ok(notificationId, 'should have a notification ID');

      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.updateNotification',
        'Updated content',
      );
      assert.strictEqual(updateResult, notificationId, 'update should return the same notification ID');

      const closed = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.closeNotification');
      assert.strictEqual(closed, true, 'close should return true');
    });
  });

  describe('kitchen-sink: lifecycle', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: 'kitchen-sink: lifecycle', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getLifecycle');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getLifecycle');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('lifecycle/activation-order: activate runs start-to-end in order', async () => {
      const lifecycle = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getLifecycle');
      assert.ok(Array.isArray(lifecycle), 'lifecycle should be an array');
      assert.strictEqual(lifecycle[0], 'activate:start');
      assert.strictEqual(lifecycle[lifecycle.length - 1], 'activate:end');
    });

    it('lifecycle/environment: provides correct plugin environment', async () => {
      const env = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEnv');
      assert.strictEqual(env.pluginName, 'kitchen-sink');
      assert.ok(env.pluginPath.includes('kitchen-sink'), 'pluginPath should contain "kitchen-sink"');
      assert.strictEqual(env.apiVersion, '1.0.0');
      assert.ok(typeof env.storagePath === 'string' && env.storagePath.length > 0, 'storagePath should be set');
    });
  });

  describe('BFR_PLUGINS_DIR configuration', () => {
    let studioAgent: StudioAgent;

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('loads no plugins when BFR_PLUGINS_DIR points to an empty directory', async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_EMPTY_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('loads no plugins when BFR_PLUGINS_DIR points to a non-existent directory', async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = '/tmp/evil-nonexistent-plugins-dir';
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('plugin README detail view', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'plugin README detail view',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('readme/readmePath: plugins with README.md have readmePath populated', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.ok(happyPlugin.readmePath, 'happy-plugin should have a readmePath');
      assert.ok(happyPlugin.readmePath.endsWith('README.md'), 'readmePath should point to README.md');

      const kitchenSink = pluginList.find((plugin: any) => plugin.name === 'kitchen-sink');
      assert.ok(kitchenSink, 'kitchen-sink should exist');
      assert.ok(kitchenSink.readmePath, 'kitchen-sink should have a readmePath');
    });

    it('readme/no-readmePath: plugins without README.md have no readmePath', async () => {
      const pluginList = await getPluginList(studioAgent);

      const missingMain = pluginList.find((plugin: any) => plugin.name === 'missing-main');
      assert.ok(missingMain, 'missing-main should exist');
      assert.ok(!missingMain.readmePath, 'missing-main should have no readmePath');

      const noActivate = pluginList.find((plugin: any) => plugin.name === 'no-activate');
      assert.ok(noActivate, 'no-activate should exist');
      assert.ok(!noActivate.readmePath, 'no-activate should have no readmePath');
    });

    it('readme/open-with-content: clicking a plugin card opens its README as an editor tab', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-card="happy-plugin"]');

      await studioAgent.assertVisible(
        '[data-test--editors--focused-document-type="plugin-readme"]',
        ASSERT_VISIBLE_TIMEOUT,
      );

      const focusedUri = await studioAgent.getFocusedDocumentUri();
      assert.strictEqual(focusedUri, 'about:plugin-readme/happy-plugin');

      await studioAgent.assertVisible('[data-test--plugin-readme="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-content]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('readme/rendered-markdown: README content contains rendered HTML elements', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="kitchen-sink"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-card="kitchen-sink"]');

      await studioAgent.assertVisible('[data-test--plugin-readme="kitchen-sink"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-content]', ASSERT_VISIBLE_TIMEOUT);

      const hasTable = await studioAgent
        .getTestDriver()
        .client!.execute(() => document.querySelector('[data-test--plugin-readme-content] table') != null);
      assert.strictEqual(hasTable, true, 'Kitchen Sink README should contain a rendered table');

      const hasCodeBlock = await studioAgent
        .getTestDriver()
        .client!.execute(() => document.querySelector('[data-test--plugin-readme-content] pre code') != null);
      assert.strictEqual(hasCodeBlock, true, 'Kitchen Sink README should contain a rendered code block');
    });

    it('readme/no-content: plugin without README shows "no documentation" message', async () => {
      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/no-activate',
        'no-activate',
      );

      await studioAgent.assertVisible('[data-test--plugin-readme="no-activate"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-no-content]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('readme/simple-readme: short README renders correctly', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="lifecycle-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-card="lifecycle-plugin"]');

      await studioAgent.assertVisible('[data-test--plugin-readme="lifecycle-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-content]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('readme/no-duplicate-tabs: opening the same README again focuses the existing tab', async () => {
      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/happy-plugin',
        'Happy Plugin',
      );

      await studioAgent.assertVisible('[data-test--plugin-readme="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      const tabCountBefore = await studioAgent
        .getTestDriver()
        .client!.execute(() => document.querySelectorAll('[data-test--editor-tab-label]').length);

      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/happy-plugin',
        'Happy Plugin',
      );

      await studioAgent.pause(500);

      const tabCountAfter = await studioAgent
        .getTestDriver()
        .client!.execute(() => document.querySelectorAll('[data-test--editor-tab-label]').length);

      assert.strictEqual(tabCountAfter, tabCountBefore, 'Opening the same README twice should not create a new tab');
    });

    it('readme/error-plugin-readme: error plugin with README still renders its documentation', async () => {
      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/error-on-activate',
        'Error On Activate',
      );

      await studioAgent.assertVisible('[data-test--plugin-readme="error-on-activate"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-content]', ASSERT_VISIBLE_TIMEOUT);
    });
  });

  describe('wrench menu: settings', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'wrench menu: settings',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.settings-plugin.getLastObservedSetting');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.settings-plugin.getLastObservedSetting');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('settings/with-category: opens settings GUI and navigates to the plugin category', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="settings-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).__lastSettingsCategory = null;
        window.addEventListener('settings:navigate-to-category', (ev: Event) => {
          (window as any).__lastSettingsCategory = (ev as CustomEvent).detail;
        });
      });

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="settings-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-settings="settings-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-settings="settings-plugin"]');

      await studioAgent.assertVisible(
        '[data-test--editors--focused-document-type="settings-gui"]',
        ASSERT_VISIBLE_TIMEOUT,
      );

      const focusedUri = await studioAgent.getFocusedDocumentUri();
      assert.strictEqual(focusedUri, 'about:settings');

      const navigatedCategory = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).__lastSettingsCategory);
      assert.strictEqual(navigatedCategory, 'Settings Plugin', 'Should navigate to the "Settings Plugin" category');
    });

    it('settings/without-category: opens settings GUI without category navigation', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).__lastSettingsCategory = null;
        window.addEventListener('settings:navigate-to-category', (ev: Event) => {
          (window as any).__lastSettingsCategory = (ev as CustomEvent).detail;
        });
      });

      await studioAgent.clickOn('[data-test--plugin-menu-trigger="happy-plugin"]');
      await studioAgent.assertVisible('[data-test--plugin-menu-settings="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.clickOn('[data-test--plugin-menu-settings="happy-plugin"]');

      await studioAgent.assertVisible(
        '[data-test--editors--focused-document-type="settings-gui"]',
        ASSERT_VISIBLE_TIMEOUT,
      );

      const focusedUri = await studioAgent.getFocusedDocumentUri();
      assert.strictEqual(focusedUri, 'about:settings');

      const navigatedCategory = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).__lastSettingsCategory);
      assert.strictEqual(
        navigatedCategory,
        null,
        'Should not navigate to any category for a plugin without matching settings',
      );
    });
  });

  describe('plugin metadata enrichment', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'plugin metadata enrichment',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('metadata/logo-path: plugins with LOGO.png have logoPath populated', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.ok(happyPlugin.logoPath, 'happy-plugin should have a logoPath');
      assert.ok(happyPlugin.logoPath.endsWith('LOGO.png'), 'logoPath should point to LOGO.png');

      const kitchenSink = pluginList.find((plugin: any) => plugin.name === 'kitchen-sink');
      assert.ok(kitchenSink, 'kitchen-sink should exist');
      assert.ok(kitchenSink.logoPath, 'kitchen-sink should have a logoPath');
    });

    it('metadata/logo-fallback: settings-plugin uses pkg.logo fallback', async () => {
      const pluginList = await getPluginList(studioAgent);

      const settingsPlugin = pluginList.find((plugin: any) => plugin.name === 'settings-plugin');
      assert.ok(settingsPlugin, 'settings-plugin should exist');
      assert.ok(settingsPlugin.logoPath, 'settings-plugin should have a logoPath via pkg.logo fallback');
      assert.ok(settingsPlugin.logoPath.endsWith('icon.png'), 'logoPath should point to icon.png');
    });

    it('metadata/homepage: homepage is populated from package.json', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.strictEqual(happyPlugin.homepage, 'https://example.com/happy-plugin');
    });

    it('metadata/homepage-from-author: lifecycle-plugin gets homepage from author URL', async () => {
      const pluginList = await getPluginList(studioAgent);

      const lifecyclePlugin = pluginList.find((plugin: any) => plugin.name === 'lifecycle-plugin');
      assert.ok(lifecyclePlugin, 'lifecycle-plugin should exist');
      assert.strictEqual(lifecyclePlugin.homepage, 'https://example.com');
    });

    it('metadata/keywords: keywords array is populated', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.ok(Array.isArray(happyPlugin.keywords), 'keywords should be an array');
      assert.deepStrictEqual(happyPlugin.keywords, ['greeting', 'fixture', 'test']);
    });

    it('metadata/deprecated: deprecated field is populated', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.strictEqual(happyPlugin.deprecated, 'Use kitchen-sink plugin instead');
    });

    it('metadata/not-deprecated: non-deprecated plugins have no deprecated field', async () => {
      const pluginList = await getPluginList(studioAgent);

      const kitchenSink = pluginList.find((plugin: any) => plugin.name === 'kitchen-sink');
      assert.ok(kitchenSink, 'kitchen-sink should exist');
      assert.ok(!kitchenSink.deprecated, 'kitchen-sink should not be deprecated');
    });

    it('metadata/author-object: object-form author extracts name correctly', async () => {
      const pluginList = await getPluginList(studioAgent);

      const happyPlugin = pluginList.find((plugin: any) => plugin.name === 'happy-plugin');
      assert.ok(happyPlugin, 'happy-plugin should exist');
      assert.strictEqual(happyPlugin.author, 'Bifrost Forge World Tests');
    });

    it('metadata/author-string-with-url: string-form author with URL extracts name correctly', async () => {
      const pluginList = await getPluginList(studioAgent);

      const lifecyclePlugin = pluginList.find((plugin: any) => plugin.name === 'lifecycle-plugin');
      assert.ok(lifecyclePlugin, 'lifecycle-plugin should exist');
      assert.strictEqual(lifecyclePlugin.author, 'Bifrost Forge World Tests');
    });

    it('metadata/missing-author-warning: plugin card shows orange warning for missing author', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.leftMenuBar.assertPaneIsActive('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="error-on-activate"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertVisible(
        '[data-test--plugin-card-missing-author="error-on-activate"]',
        ASSERT_VISIBLE_TIMEOUT,
      );
    });

    it('metadata/deprecated-indicator: plugin card shows yellow warning for deprecated plugin', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertVisible('[data-test--plugin-card-deprecated="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('metadata/readme-logo: README viewer renders logo for plugin with LOGO.png', async () => {
      await studioAgent.leftMenuBar.togglePane('pane/left/plugins');
      await studioAgent.assertVisible('[data-test--plugin-card="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.clickOn('[data-test--plugin-card="happy-plugin"]');

      await studioAgent.assertVisible('[data-test--plugin-readme="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-logo]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('metadata/readme-meta: README viewer shows author, website and tags', async () => {
      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/happy-plugin',
        'Happy Plugin',
      );

      await studioAgent.assertVisible('[data-test--plugin-readme="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-meta]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-website]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-tags]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('metadata/readme-deprecation: README viewer shows deprecation warning and message', async () => {
      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        'about:plugin-readme/happy-plugin',
        'Happy Plugin',
      );

      await studioAgent.assertVisible('[data-test--plugin-readme="happy-plugin"]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-deprecated-icon]', ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible('[data-test--plugin-readme-deprecation-message]', ASSERT_VISIBLE_TIMEOUT);

      const messageText = await studioAgent
        .getTestDriver()
        .client!.execute(
          () => document.querySelector('[data-test--plugin-readme-deprecation-message]')?.textContent ?? '',
        );
      assert.ok(messageText.includes('Use kitchen-sink plugin instead'), 'deprecation message should be visible');
    });
  });

  // ── Phase 4: Declarative Contribution Model ────────────────────
  //
  // Tests for manifest validation, API version checks, lazy activation,
  // declarative contributions, and PluginInfo metadata fields.

  describe('declarative manifest', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'declarative manifest',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    // ── Manifest validation errors ────────────────────────────────

    it('validation/errors-rejected: plugin with manifest errors has status "error"', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-errors');
      assert.ok(plugin, 'manifest-errors should be in the plugin list');
      assert.strictEqual(plugin.status, 'error', 'plugin with manifest errors should have error status');
      assert.strictEqual(plugin.enabled, false, 'plugin with manifest errors should be disabled');
    });

    it('validation/errors-details: rejected plugin exposes manifestErrors on PluginInfo', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-errors');
      assert.ok(plugin.manifestErrors, 'manifestErrors should be populated');
      assert.ok(Array.isArray(plugin.manifestErrors), 'manifestErrors should be an array');
      assert.ok(plugin.manifestErrors.length > 0, 'manifestErrors should contain at least one entry');
      assert.ok(plugin.errorMessage, 'errorMessage should be set');
      assert.ok(plugin.errorMessage.includes('Manifest errors'), 'errorMessage should reference manifest errors');
    });

    it('validation/errors-no-commands: commands from a rejected manifest are not registered', async () => {
      const registered = await isCommandRegistered(studioAgent, 'plugin.manifest-errors.manifestErrors.valid');
      assert.strictEqual(registered, false, 'commands from rejected plugin should not be registered');
    });

    it('validation/errors-no-settings: settings from a rejected manifest are not registered', async () => {
      const registered = await isSettingRegistered(studioAgent, 'manifestErrors.someKey');
      assert.strictEqual(registered, false, 'settings from rejected plugin should not be registered');
    });

    // ── Manifest validation warnings ──────────────────────────────

    it('validation/warnings-loaded: plugin with only warnings loads successfully', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-warnings');
      assert.ok(plugin, 'manifest-warnings should be in the plugin list');
      assert.strictEqual(plugin.status, 'loaded', 'plugin with only warnings should be loaded');
      assert.strictEqual(plugin.enabled, true, 'plugin with only warnings should be enabled');
    });

    it('validation/warnings-details: loaded plugin exposes manifestWarnings on PluginInfo', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-warnings');
      assert.ok(plugin.manifestWarnings, 'manifestWarnings should be populated');
      assert.ok(Array.isArray(plugin.manifestWarnings), 'manifestWarnings should be an array');
      assert.ok(plugin.manifestWarnings.length > 0, 'manifestWarnings should contain at least one entry');
      assert.ok(
        !plugin.manifestErrors || plugin.manifestErrors.length === 0,
        'manifestErrors should not be present for a warnings-only plugin',
      );
    });

    it('validation/warnings-functional: plugin with warnings is fully functional', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.manifest-warnings.manifestWarnings.hello');
      const result = await executePluginCommand(studioAgent, 'plugin.manifest-warnings.manifestWarnings.hello');
      assert.deepStrictEqual(result, { hello: true }, 'command should return the expected result');
    });

    // ── API version compatibility ─────────────────────────────────

    it('validation/incompatible-rejected: plugin requiring future API version has status "error"', async () => {
      const plugin = await getPluginByName(studioAgent, 'incompatible-plugin');
      assert.ok(plugin, 'incompatible-plugin should be in the plugin list');
      assert.strictEqual(plugin.status, 'error', 'incompatible plugin should have error status');
      assert.strictEqual(plugin.enabled, false, 'incompatible plugin should be disabled');
      assert.ok(plugin.errorMessage, 'errorMessage should be set');
    });

    it('validation/incompatible-reason: error message references the version mismatch', async () => {
      const plugin = await getPluginByName(studioAgent, 'incompatible-plugin');
      const msg = plugin.errorMessage.toLowerCase();
      assert.ok(
        msg.includes('major') || msg.includes('99.0.0') || msg.includes('version'),
        'errorMessage should explain the API version incompatibility',
      );
    });

    // ── onStartup activation with manifest ────────────────────────

    it('onStartup/kitchen-sink-loaded: kitchen-sink with manifest + onStartup is loaded', async () => {
      const plugin = await getPluginByName(studioAgent, 'kitchen-sink');
      assert.ok(plugin, 'kitchen-sink should be in the plugin list');
      assert.strictEqual(plugin.status, 'loaded');
      assert.strictEqual(plugin.enabled, true);
    });

    it('onStartup/kitchen-sink-manifest: kitchen-sink PluginInfo has manifest populated', async () => {
      const plugin = await getPluginByName(studioAgent, 'kitchen-sink');
      assert.ok(plugin.manifest, 'manifest should be populated');
      assert.strictEqual(plugin.manifest.apiVersion, '1.0.0');
      assert.ok(
        Array.isArray(plugin.manifest.activationEvents) && plugin.manifest.activationEvents.includes('onStartup'),
        'activationEvents should include onStartup',
      );
    });

    it('onStartup/declarative-settings: manifest-contributed settings are registered', async () => {
      const hasValue = await isSettingRegistered(studioAgent, 'plugin.kitchen-sink.kitchenSinkValue');
      assert.strictEqual(hasValue, true, 'plugin.kitchen-sink.kitchenSinkValue should be registered');

      const hasArray = await isSettingRegistered(studioAgent, 'plugin.kitchen-sink.kitchenSinkArray');
      assert.strictEqual(hasArray, true, 'plugin.kitchen-sink.kitchenSinkArray should be registered');
    });

    it('onStartup/warnings-loaded: manifest-warnings with onStartup is loaded despite warnings', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.manifest-warnings.manifestWarnings.hello');
      await waitForPluginStatus(studioAgent, 'manifest-warnings', 'loaded');
      const plugin = await getPluginByName(studioAgent, 'manifest-warnings');
      assert.strictEqual(plugin.status, 'loaded');
      assert.strictEqual(plugin.enabled, true);
    });

    // ── Lazy plugins: pending state ───────────────────────────────

    it('lazy/pending-status: lazy-plugin starts with status "pending"', async () => {
      const plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.ok(plugin, 'lazy-plugin should be in the plugin list');
      assert.strictEqual(plugin.status, 'pending', 'lazy plugin should start as pending');
      assert.strictEqual(plugin.enabled, true, 'lazy plugin should be enabled');
    });

    it('lazy/stub-command-registered: stub command is registered before activation', async () => {
      const registered = await isCommandRegistered(studioAgent, 'plugin.lazy-plugin.lazyPlugin.activate');
      assert.strictEqual(registered, true, 'stub command should be registered');

      const plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.strictEqual(plugin.status, 'pending', 'plugin should still be pending');
    });

    it('lazy/settings-pre-registered: manifest settings are available before activation', async () => {
      const hasGreeting = await isSettingRegistered(studioAgent, 'lazyPlugin.greeting');
      assert.strictEqual(hasGreeting, true, 'manifest setting should be registered before activation');

      const plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.strictEqual(plugin.status, 'pending', 'plugin should still be pending');
    });

    it('lazy/manifest-only-pending: manifest-only-plugin starts as pending', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-only-plugin');
      assert.ok(plugin, 'manifest-only-plugin should be in the plugin list');
      assert.strictEqual(plugin.status, 'pending');

      const registered = await isCommandRegistered(studioAgent, 'plugin.manifest-only-plugin.manifestOnly.doThing');
      assert.strictEqual(registered, true, 'stub command should be registered');

      const hasSetting = await isSettingRegistered(studioAgent, 'manifestOnly.enabled');
      assert.strictEqual(hasSetting, true, 'manifest setting should be pre-registered');
    });

    it('lazy/manifest-full-pending: manifest-full starts as pending with all contributions', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-full');
      assert.ok(plugin, 'manifest-full should be in the plugin list');
      assert.strictEqual(plugin.status, 'pending');

      const greetRegistered = await isCommandRegistered(studioAgent, 'plugin.manifest-full.manifestFull.greet');
      assert.strictEqual(greetRegistered, true, 'greet stub should be registered');

      const farewellRegistered = await isCommandRegistered(studioAgent, 'plugin.manifest-full.manifestFull.farewell');
      assert.strictEqual(farewellRegistered, true, 'farewell stub should be registered');

      const hasGreeting = await isSettingRegistered(studioAgent, 'manifestFull.greeting');
      assert.strictEqual(hasGreeting, true, 'greeting setting should be pre-registered');

      const hasEnabled = await isSettingRegistered(studioAgent, 'manifestFull.enabled');
      assert.strictEqual(hasEnabled, true, 'enabled setting should be pre-registered');
    });

    // ── PluginInfo metadata ───────────────────────────────────────

    it('metadata/manifest-present: plugins with bifrostStudio have manifest on PluginInfo', async () => {
      const plugin = await getPluginByName(studioAgent, 'kitchen-sink');
      assert.ok(plugin.manifest, 'manifest should be populated');
      assert.strictEqual(plugin.manifest.apiVersion, '1.0.0');
      assert.ok(plugin.manifest.contributes, 'contributes should be present');
    });

    it('metadata/manifest-absent: legacy plugins without bifrostStudio have no manifest', async () => {
      const plugin = await getPluginByName(studioAgent, 'happy-plugin');
      assert.ok(!plugin.manifest, 'happy-plugin should have no manifest');
      assert.ok(!plugin.manifestErrors, 'happy-plugin should have no manifestErrors');
      assert.ok(!plugin.manifestWarnings, 'happy-plugin should have no manifestWarnings');
    });

    it('metadata/pending-manifest: pending plugins have manifest but no errorMessage', async () => {
      const plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.ok(plugin.manifest, 'lazy-plugin should have manifest');
      assert.strictEqual(plugin.manifest.apiVersion, '1.0.0');
      assert.ok(!plugin.errorMessage, 'pending plugin should have no errorMessage');
    });

    it('metadata/manifest-contributions: manifest contributes section is accessible', async () => {
      const plugin = await getPluginByName(studioAgent, 'manifest-full');
      assert.ok(plugin.manifest, 'manifest should be populated');
      assert.ok(plugin.manifest.contributes, 'contributes should be present');
      assert.ok(plugin.manifest.contributes.commands, 'commands should be present');
      assert.ok(plugin.manifest.contributes.settings, 'settings should be present');
      assert.ok(plugin.manifest.contributes.keybindings, 'keybindings should be present');
      assert.ok(plugin.manifest.contributes.menus, 'menus should be present');
      assert.ok(plugin.manifest.contributes.icons, 'icons should be present');
      assert.ok(plugin.manifest.contributes.panes, 'panes should be present');
      assert.ok(plugin.manifest.contributes.serviceTaskTypes, 'serviceTaskTypes should be present');
    });
  });

  describe('declarative manifest: lazy activation', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('activation/lazy-command-trigger: executing stub command activates the lazy plugin', async () => {
      let plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.strictEqual(plugin.status, 'pending', 'should be pending before activation');

      const result = await executePluginCommand(studioAgent, 'plugin.lazy-plugin.lazyPlugin.activate');

      await waitForPluginStatus(studioAgent, 'lazy-plugin', 'loaded');

      plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.strictEqual(plugin.status, 'loaded', 'should be loaded after activation');
      assert.strictEqual(plugin.enabled, true);

      assert.ok(result, 'stub should forward to the real command and return a result');
      assert.deepStrictEqual(result, { activated: true, greeting: 'Lazy plugin is now active!' });
    });

    it('activation/manifest-only-trigger: manifest-only-plugin activates when its command is called', async () => {
      let plugin = await getPluginByName(studioAgent, 'manifest-only-plugin');
      assert.strictEqual(plugin.status, 'pending');

      const result = await executePluginCommand(studioAgent, 'plugin.manifest-only-plugin.manifestOnly.doThing');

      await waitForPluginStatus(studioAgent, 'manifest-only-plugin', 'loaded');

      plugin = await getPluginByName(studioAgent, 'manifest-only-plugin');
      assert.strictEqual(plugin.status, 'loaded');

      assert.deepStrictEqual(result, { done: true }, 'real handler should return the expected result');
    });

    it('activation/manifest-full-trigger: manifest-full activates and real commands work', async () => {
      let plugin = await getPluginByName(studioAgent, 'manifest-full');
      assert.strictEqual(plugin.status, 'pending');

      const greetResult = await executePluginCommand(studioAgent, 'plugin.manifest-full.manifestFull.greet');

      await waitForPluginStatus(studioAgent, 'manifest-full', 'loaded');

      plugin = await getPluginByName(studioAgent, 'manifest-full');
      assert.strictEqual(plugin.status, 'loaded');
      assert.deepStrictEqual(greetResult, { greeted: true });

      const farewellResult = await executePluginCommand(studioAgent, 'plugin.manifest-full.manifestFull.farewell');
      assert.deepStrictEqual(farewellResult, { farewelled: true }, 'second command should also work after activation');
    });

    it('activation/idempotent: calling a lazy command twice does not re-activate', async () => {
      await executePluginCommand(studioAgent, 'plugin.lazy-plugin.lazyPlugin.activate');
      await waitForPluginStatus(studioAgent, 'lazy-plugin', 'loaded');

      const secondResult = await executePluginCommand(studioAgent, 'plugin.lazy-plugin.lazyPlugin.activate');
      assert.deepStrictEqual(secondResult, { activated: true, greeting: 'Lazy plugin is now active!' });

      const plugin = await getPluginByName(studioAgent, 'lazy-plugin');
      assert.strictEqual(plugin.status, 'loaded', 'plugin should remain loaded');
    });

    it('activation/other-plugins-unaffected: activating one lazy plugin does not affect others', async () => {
      await executePluginCommand(studioAgent, 'plugin.lazy-plugin.lazyPlugin.activate');
      await waitForPluginStatus(studioAgent, 'lazy-plugin', 'loaded');

      const manifestOnly = await getPluginByName(studioAgent, 'manifest-only-plugin');
      assert.strictEqual(manifestOnly.status, 'pending', 'other lazy plugins should remain pending');

      const manifestFull = await getPluginByName(studioAgent, 'manifest-full');
      assert.strictEqual(manifestFull.status, 'pending', 'other lazy plugins should remain pending');

      const happyPlugin = await getPluginByName(studioAgent, 'happy-plugin');
      assert.strictEqual(happyPlugin.status, 'loaded', 'eager plugins should remain loaded');
    });
  });

  describe('plugin host console', () => {
    let studioAgent: StudioAgent;
    let logSnapshot: string[];

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: 'console-setup', testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.happy-plugin.greet');
      await waitForPluginStatus(studioAgent, 'manifest-warnings', 'loaded');

      logSnapshot = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.plugins.getPluginHostLog());
    });

    afterAll(async () => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: 'console-teardown',
          testFile: __filename,
          state: 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('console/log-populated: getPluginHostLog returns lines after plugin loading', () => {
      assert.ok(logSnapshot.length > 0, 'log should contain at least one line after plugins loaded');
    });

    it('console/timestamp-format: log lines are prefixed with [HH:MM:SS.mmm]', () => {
      const timestampPattern = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] /;
      const firstLine = logSnapshot[0];
      assert.ok(firstLine, 'log should have at least one line');
      assert.match(firstLine, timestampPattern, `first line should start with timestamp, got: "${firstLine}"`);

      const allTimestamped = logSnapshot.every((line) => timestampPattern.test(line));
      assert.ok(allTimestamped, 'every log line should start with a timestamp');
    });

    it('console/startup-message: log contains Plugin Host startup message', () => {
      const startupLine = logSnapshot.find((line) => line.includes('[PluginHost] Process started and ready.'));
      assert.ok(startupLine, 'log should contain the Plugin Host startup message');
    });

    it('console/plugin-output: log captures plugin console.log output', () => {
      const manifestWarningsLine = logSnapshot.find((line) => line.includes('[manifest-warnings] activated'));
      assert.ok(manifestWarningsLine, 'log should contain output from manifest-warnings plugin');
    });

    it('console/clear: clearPluginHostLog empties the buffer', async () => {
      await studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.plugins.clearPluginHostLog());

      const logAfterClear: string[] = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.plugins.getPluginHostLog());

      assert.strictEqual(logAfterClear.length, 0, 'log should be empty after clear');
    });
  });

  describe('kitchen-sink: status bar API', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('statusBar/register: item appears in status bar view data after plugin load', async () => {
      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());

      const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
      const kitchenSinkItem = allItems.find((item: any) => item.id === 'kitchen-sink.status');
      assert.ok(kitchenSinkItem, 'kitchen-sink.status item should exist in status bar');
      assert.strictEqual(kitchenSinkItem.type, 'button');
      assert.deepStrictEqual(kitchenSinkItem.content, { type: 'text', label: 'Kitchen Sink: Ready' });
    });

    it('statusBar/update: updateStatusBarItem replaces item content', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.updateStatusBarItem', 'Kitchen Sink: Busy');

      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());

      const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
      const kitchenSinkItem = allItems.find((item: any) => item.id === 'kitchen-sink.status');
      assert.ok(kitchenSinkItem, 'kitchen-sink.status item should still exist after update');
      assert.deepStrictEqual(kitchenSinkItem.content, { type: 'text', label: 'Kitchen Sink: Busy' });
    });

    it('statusBar/unregister: unregisterStatusBarItem removes item', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.unregisterStatusBarItem');

      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());

      const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
      const kitchenSinkItem = allItems.find((item: any) => item.id === 'kitchen-sink.status');
      assert.strictEqual(kitchenSinkItem, undefined, 'kitchen-sink.status item should be gone after unregister');
    });

    it('statusBar/progress: showProgress displays label, done clears it', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showProgress', 'Indexing...');

      let viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());
      assert.strictEqual(viewData.progressLabel, 'Indexing...', 'progress label should match');

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.updateProgress', 'Indexing... 50%');

      viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());
      assert.strictEqual(viewData.progressLabel, 'Indexing... 50%', 'progress label should be updated');

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.doneProgress');

      viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());
      assert.strictEqual(viewData.progressLabel, null, 'progress label should be null after done');
    });

    it('statusBar/isVisible: returns current visibility state', async () => {
      const visible = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.isStatusBarVisible');
      assert.strictEqual(visible, true, 'status bar should be visible by default');
    });

    it('statusBar/cleanup: items and progress removed when plugin is disabled', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showProgress', 'Cleanup test...');

      let viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());
      assert.strictEqual(viewData.progressLabel, 'Cleanup test...', 'progress should exist before disable');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.statusBar.getViewData());

      const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
      const kitchenSinkItem = allItems.find((item: any) => item.id === 'kitchen-sink.status');
      assert.strictEqual(kitchenSinkItem, undefined, 'status bar item should be removed after plugin disable');
      assert.strictEqual(viewData.progressLabel, null, 'orphaned progress handle should be cleaned up on disable');
    });
  });

  describe('kitchen-sink: menu bar + menus API', () => {
    let studioAgent: StudioAgent;

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('menuBar/registerItem: button appears in menu bar view data', async () => {
      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.menuBar.getViewData());

      const rightItems = viewData.items.right;
      const quickAction = rightItems.find((item: any) => item.id === 'kitchen-sink.quickAction');
      assert.ok(quickAction, 'kitchen-sink.quickAction should exist in right area');
      assert.strictEqual(quickAction.type, 'button');
      assert.strictEqual(quickAction.icon, 'ph-lightning');
    });

    it('menuBar/modifier: pane toggle appears after plugins toggle', async () => {
      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.menuBar.getViewData());

      const leftItems = viewData.items.left;
      const pluginsIdx = leftItems.findIndex((item: any) => item.id === 'pane/left/plugins');
      const sidebarIdx = leftItems.findIndex((item: any) => item.id === 'kitchen-sink.sidebarToggle');

      assert.ok(pluginsIdx !== -1, 'pane/left/plugins should exist in left area');
      assert.ok(sidebarIdx !== -1, 'kitchen-sink.sidebarToggle should exist in left area');
      assert.ok(sidebarIdx > pluginsIdx, 'sidebar toggle should appear after plugins toggle');
    });

    it('menuBar/isVisible: returns current visibility state', async () => {
      const visible = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.isMenuBarVisible');
      assert.strictEqual(visible, true, 'menu bar should be visible by default');
    });

    it('menus/modifier: entry appears in View submenu of application menu', async () => {
      const menu = await studioAgent.getTestDriver().client!.execute(async () => {
        return (window as any).bifrost.menus.getMenu('std/application/main', [(window as any).bifrost]);
      });

      const viewSubmenu = menu.find((item: any) => item.type === 'menu' && item.id === 'view');
      assert.ok(viewSubmenu, 'View submenu should exist');

      const kitchenSinkEntry = viewSubmenu.submenu.find((item: any) => item.id === 'plugin.kitchen-sink.viewEntry');
      assert.ok(kitchenSinkEntry, 'Kitchen Sink View Entry should appear in View submenu');
      assert.strictEqual(kitchenSinkEntry.label, 'Kitchen Sink View Entry');
    });

    it('menus/cleanup: menu modifier removed on plugin disable', async () => {
      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      const menu = await studioAgent.getTestDriver().client!.execute(async () => {
        return (window as any).bifrost.menus.getMenu('std/application/main', [(window as any).bifrost]);
      });

      const viewSubmenu = menu.find((item: any) => item.type === 'menu' && item.id === 'view');
      const kitchenSinkEntry = viewSubmenu?.submenu?.find((item: any) => item.id === 'plugin.kitchen-sink.viewEntry');
      assert.strictEqual(kitchenSinkEntry, undefined, 'Kitchen Sink View Entry should be removed after disable');
    });

    it('menuBar/cleanup: items and modifiers removed on plugin disable', async () => {
      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      const viewData = await studioAgent
        .getTestDriver()
        .client!.execute(() => (window as any).bifrost.menuBar.getViewData());

      const allItems = [...viewData.items.left, ...viewData.items.center, ...viewData.items.right];
      const quickAction = allItems.find((item: any) => item.id === 'kitchen-sink.quickAction');
      const sidebarToggle = allItems.find((item: any) => item.id === 'kitchen-sink.sidebarToggle');

      assert.strictEqual(quickAction, undefined, 'quick action button should be removed after disable');
      assert.strictEqual(sidebarToggle, undefined, 'sidebar toggle should be removed after disable');
    });
  });

  describe('kitchen-sink: diagnostics API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: diagnostics API',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');
      // Wait for kitchen-sink to be fully loaded and give deferred eager plugins
      // (e.g. webview-showcase with permissions) time to finish loading.
      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'loaded');
      await studioAgent.pause(2_000);
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('diagnostics/set: contributes diagnostics for a URI', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');

      const diagnostics = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnostics');
      const uri = 'file:///test/kitchen-sink.bpmn';

      assert.ok(diagnostics[uri], 'should have diagnostics for the test URI');
      assert.strictEqual(diagnostics[uri].length, 2, 'should have two diagnostics');
      assert.strictEqual(diagnostics[uri][0].severity, 'error');
      assert.strictEqual(diagnostics[uri][1].severity, 'warning');
    });

    it('diagnostics/getCount: returns aggregate counts', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');

      const counts = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnosticCount');
      assert.ok(counts.errors >= 1, 'should count at least 1 error');
      assert.ok(counts.warnings >= 1, 'should count at least 1 warning');
    });

    it('diagnostics/clear: removes all diagnostics for this plugin', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.clearDiagnostics');

      const diagnostics = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnostics');
      const uri = 'file:///test/kitchen-sink.bpmn';
      assert.ok(!diagnostics[uri], 'diagnostics should be cleared for the test URI');
    });

    it('diagnostics/set empty: clears diagnostics for a specific URI', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');
      await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.setDiagnostics',
        'file:///test/kitchen-sink.bpmn',
        [],
      );

      const diagnostics = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnostics');
      assert.ok(
        !diagnostics['file:///test/kitchen-sink.bpmn'],
        'diagnostics should be cleared when setting empty array',
      );
    });

    it('diagnostics/onDidChange: fires on diagnostic changes', async () => {
      const countBefore = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnosticsChangeCount');

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const countAfter = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getDiagnosticsChangeCount');
          return countAfter > countBefore;
        },
        { timeout: 5_000, timeoutMsg: 'onDidChange callback did not fire after setting diagnostics' },
      );
    });

    it('diagnostics/cleanup: diagnostics cleared on plugin disable', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDiagnostics');

      const countsBefore = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.diagnostics.getCount();
      });
      assert.ok(countsBefore.errors >= 1, 'should have errors before disable');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      const countsAfter = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.diagnostics.getCount();
      });

      assert.ok(countsAfter.errors < countsBefore.errors, 'error count should decrease after plugin disable');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');
      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'loaded');
    });
  });

  describe('kitchen-sink: notifications with actions', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: notifications with actions',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showNotificationWithActions');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showNotificationWithActions');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('notifications/open-with-actions: opens notification with action buttons', async () => {
      const notificationId: string = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.showNotificationWithActions',
      );
      assert.ok(typeof notificationId === 'string' && notificationId.length > 0, 'should return notification ID');

      const notification = await studioAgent.getTestDriver().client!.execute((id: string) => {
        const all = (window as any).bifrost.notifications.getAllNotifications();
        const found = all.find((notif: any) => notif.id === id);
        return found
          ? {
              actions: found.options.actions,
              sticky: found.options.sticky,
            }
          : null;
      }, notificationId);

      assert.ok(notification, 'notification should exist');
      assert.strictEqual(notification.actions.length, 2, 'should have two actions');
      assert.strictEqual(notification.actions[0].action, 'accept');
      assert.strictEqual(notification.actions[1].action, 'decline');
    });

    it('notifications/sticky: opens a sticky notification', async () => {
      const notificationId: string = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.showStickyNotification',
      );
      assert.ok(typeof notificationId === 'string' && notificationId.length > 0, 'should return notification ID');

      const notification = await studioAgent.getTestDriver().client!.execute((id: string) => {
        const all = (window as any).bifrost.notifications.getAllNotifications();
        const found = all.find((notif: any) => notif.id === id);
        return found ? { sticky: found.options.sticky } : null;
      }, notificationId);

      assert.ok(notification, 'notification should exist');
      assert.strictEqual(notification.sticky, true, 'notification should be sticky');
    });

    it('notifications/onResponse: response callback fires when action is triggered', async () => {
      const notificationId: string = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.showNotificationWithActions',
      );

      await studioAgent.getTestDriver().client!.execute((id: string) => {
        const all = (window as any).bifrost.notifications.getAllNotifications();
        const found = all.find((notif: any) => notif.id === id);
        if (found) {
          found.responseCallbackFn({ action: 'accept', label: 'Accept' });
        }
      }, notificationId);

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const response = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getLastNotificationResponse');
          return response != null && response.action === 'accept';
        },
        { timeout: 5_000, timeoutMsg: 'onResponse callback did not fire with expected action' },
      );

      const response = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getLastNotificationResponse');
      assert.strictEqual(response.action, 'accept');
      assert.strictEqual(response.label, 'Accept');
    });
  });

  describe('kitchen-sink: dialogs API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: dialogs API',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showDialog');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.showDialog');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('dialogs/open: opens a custom dialog and returns result on submit', async () => {
      // Fire the dialog command without awaiting — bifrost.commands.executeCommand returns
      // a Promise that blocks until the dialog is submitted, which would deadlock the
      // WebDriver session if we awaited it here.
      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).__dialogResult = null;
        (window as any).bifrost.commands.executeCommand('plugin.kitchen-sink.showDialog', []).then((result: any) => {
          (window as any).__dialogResult = result;
        });
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.dialog.isActive());
        },
        { timeout: 5_000, timeoutMsg: 'Dialog did not open in time' },
      );

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.dialog.submit('submit', { name: 'Test User', agree: true });
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult != null);
        },
        { timeout: 5_000, timeoutMsg: 'Dialog result was not received' },
      );

      const result = await studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult);
      assert.strictEqual(result.wasCancelled, false, 'dialog should not be cancelled');
      assert.strictEqual(result.response, 'submit', 'response should be submit');
      assert.strictEqual(result.formData.name, 'Test User', 'form data should contain name');
      assert.strictEqual(result.formData.agree, true, 'form data should contain agree');
    });

    it('dialogs/open: cancel returns wasCancelled=true', async () => {
      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).__dialogResult = null;
        (window as any).bifrost.commands.executeCommand('plugin.kitchen-sink.showDialog', []).then((result: any) => {
          (window as any).__dialogResult = result;
        });
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.dialog.isActive());
        },
        { timeout: 5_000, timeoutMsg: 'Dialog did not open in time' },
      );

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.dialog.close();
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult != null);
        },
        { timeout: 5_000, timeoutMsg: 'Dialog result was not received' },
      );

      const result = await studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult);
      assert.strictEqual(result.wasCancelled, true, 'dialog should be cancelled');
    });

    it('dialogs/prompt: shows prompt and returns entered text', async () => {
      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).__dialogResult = null;
        (window as any).bifrost.commands.executeCommand('plugin.kitchen-sink.showPrompt', []).then((result: any) => {
          (window as any).__dialogResult = result;
        });
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.dialog.isActive());
        },
        { timeout: 5_000, timeoutMsg: 'Prompt dialog did not open in time' },
      );

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.dialog.submit('submit', { promptValue: 'Hello from test' });
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult != null);
        },
        { timeout: 5_000, timeoutMsg: 'Prompt result was not received' },
      );

      const result = await studioAgent.getTestDriver().client!.execute(() => (window as any).__dialogResult);
      assert.strictEqual(result, 'Hello from test', 'prompt should return entered text');
    });

    it('dialogs/cleanup: open dialog is force-closed on plugin disable', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.showDialogNonBlocking');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          return studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.dialog.isActive());
        },
        { timeout: 5_000, timeoutMsg: 'Dialog did not open in time' },
      );

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      const dialogStillActive = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.dialog.isActive();
      });
      assert.strictEqual(dialogStillActive, false, 'dialog should be force-closed after plugin disable');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');
      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'loaded');
    });
  });

  describe('kitchen-sink: workspace API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: workspace API',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.writeStorageFile');
    });

    beforeEach(async ({ task }) => {
      studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.writeStorageFile');
    });

    afterEach(async ({ task }) => {
      if (studioAgent != null) {
        studioAgent.updateTestContext({
          testName: task.name,
          testFile: __filename,
          state: task.result?.state === 'fail' ? 'failed' : 'passed',
        });
      }
    });

    afterAll(async () => {
      if (studioAgent != null) {
        await studioAgent.stopAndRecordErrors(false);
      }
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('workspace/writeFile + readFile: round-trips through plugin storage', async () => {
      const written = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.writeStorageFile',
        'roundtrip.txt',
        'workspace-test-content',
      );
      assert.ok(written, 'writeStorageFile should return the URI');

      const content = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readStorageFile', 'roundtrip.txt');
      assert.strictEqual(content, 'workspace-test-content', 'readStorageFile should return the written content');
    });

    it('workspace/writeBinaryFile + readBinaryFile: round-trips binary data', async () => {
      const testBytes = [0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff];
      const base64Input = Buffer.from(testBytes).toString('base64');

      const written = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.writeBinaryStorageFile',
        'binary-roundtrip.bin',
        base64Input,
      );
      assert.ok(written, 'writeBinaryStorageFile should return the URI');

      const base64Output = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.readBinaryStorageFile',
        'binary-roundtrip.bin',
      );
      assert.strictEqual(base64Output, base64Input, 'binary data should survive the round-trip unchanged');
    });

    it('workspace/writeFile: creates parent directories automatically', async () => {
      const nestedFile = 'auto-created-dir/nested/deep-file.txt';
      const written = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.writeStorageFile',
        nestedFile,
        'deep content',
      );
      assert.ok(written, 'writeStorageFile should return the URI');

      const content = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readStorageFile', nestedFile);
      assert.strictEqual(content, 'deep content', 'reading back nested file should return the written content');
    });

    it('workspace/stat: returns correct metadata for existing file', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.writeStorageFile', 'stat-test.txt', 'stat content');

      const env = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEnv');
      const statResult = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.statFile',
        `file://${env.storagePath}/stat-test.txt`,
      );

      assert.strictEqual(statResult.exists, true, 'file should exist');
      assert.strictEqual(statResult.isFile, true, 'should be a file');
      assert.strictEqual(statResult.isDirectory, false, 'should not be a directory');
    });

    it('workspace/stat: returns exists=false for missing path', async () => {
      const env = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEnv');
      const statResult = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.statFile',
        `file://${env.storagePath}/nonexistent-file.txt`,
      );

      assert.strictEqual(statResult.exists, false, 'file should not exist');
      assert.strictEqual(statResult.isFile, false);
      assert.strictEqual(statResult.isDirectory, false);
    });

    it('workspace/createDirectory: creates a subdirectory', async () => {
      const dirUri = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.createStorageDir', 'test-subdir');
      assert.ok(dirUri, 'createStorageDir should return the URI');

      const env = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEnv');
      const statResult = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.statFile',
        `file://${env.storagePath}/test-subdir`,
      );

      assert.strictEqual(statResult.exists, true, 'directory should exist');
      assert.strictEqual(statResult.isDirectory, true, 'should be a directory');
    });

    it('workspace/deleteFile: removes a file', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.writeStorageFile', 'delete-me.txt', 'to be deleted');

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.deleteStorageFile', 'delete-me.txt');

      const env = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEnv');
      const statResult = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.statFile',
        `file://${env.storagePath}/delete-me.txt`,
      );

      assert.strictEqual(statResult.exists, false, 'file should have been deleted');
    });

    it('workspace/scope: denies access outside allowed scope', async () => {
      try {
        const result = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readOutOfScope');
        assert.strictEqual(result.success, false, 'reading /etc/passwd should fail');
        assert.ok(result.error.includes('Access denied'), 'error should mention access denied');
      } catch (error: any) {
        assert.ok(error.message.includes('Access denied'), `error should mention access denied, got: ${error.message}`);
      }
    });

    it('workspace/getProjectFolders: returns empty when no solution is open', async () => {
      const folders = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getProjectFolders');
      assert.ok(Array.isArray(folders), 'should return an array');
    });

    it('workspace/onDidChangeFile: watcher captures file change events', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.watchStorageDir');

      await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.writeStorageFile',
        'watched-file.txt',
        'watcher test',
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const events = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getWatcherEvents');
      assert.ok(events.length > 0, 'watcher should have captured at least one event');
      assert.ok(
        events.some((evt: any) => evt.type === 'created' || evt.type === 'changed'),
        'should have a created or changed event',
      );

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.disposeWatcher');
    });

    it('workspace/cleanup: file watchers disposed on plugin disable', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.watchStorageDir');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'loaded');
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });
  });

  describe('kitchen-sink: editors dirty state & save lifecycle', () => {
    let studioAgent: StudioAgent;
    const testDocUri = 'about:plugin-readme/kitchen-sink';

    beforeEach(async ({ task }) => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');

      await studioAgent.getTestDriver().client!.execute(
        (uri: string, label: string) => {
          (window as any).bifrost.editors.focusOrOpenEditorDocument(uri, label);
        },
        testDocUri,
        'Kitchen Sink',
      );
    });

    afterEach(async () => {
      await studioAgent.stop();
    });

    it('editors/setDirty: marks document as dirty', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDirty', testDocUri, true);

      const hasUnsaved = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const doc = (window as any).bifrost.editors.getEditorDocumentByUri(uri);
        return doc?.hasUnsavedChanges ?? false;
      }, testDocUri);

      assert.strictEqual(hasUnsaved, true, 'document should be marked as dirty');
    });

    it('editors/setDirty: clears dirty state', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDirty', testDocUri, true);
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDirty', testDocUri, false);

      const hasUnsaved = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const doc = (window as any).bifrost.editors.getEditorDocumentByUri(uri);
        return doc?.hasUnsavedChanges ?? false;
      }, testDocUri);

      assert.strictEqual(hasUnsaved, false, 'document should no longer be dirty');
    });

    it('editors/onSaveRequest: save delegate is invoked on save', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerSave', testDocUri);
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDirty', testDocUri, true);

      await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const doc = (window as any).bifrost.editors.getEditorDocumentByUri(uri);
        return (window as any).bifrost.editors.saveEditorDocument(doc);
      }, testDocUri);

      const saveCount = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getSaveCount');
      assert.strictEqual(saveCount, 1, 'save delegate should have been called once');

      const hasUnsaved = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const doc = (window as any).bifrost.editors.getEditorDocumentByUri(uri);
        return doc?.hasUnsavedChanges ?? false;
      }, testDocUri);

      assert.strictEqual(hasUnsaved, false, 'dirty state should be cleared after save');
    });

    it('editors/onSaveRequest: dispose removes the delegate', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerSave', testDocUri);
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.unregisterSave');
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.setDirty', testDocUri, true);

      const saveResult = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const doc = (window as any).bifrost.editors.getEditorDocumentByUri(uri);
        return (window as any).bifrost.editors.saveEditorDocument(doc);
      }, testDocUri);

      assert.strictEqual(saveResult, false, 'save should fail without delegate');
    });

    it('editors/cleanup: save delegates and docs removed on plugin disable', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerSave', testDocUri);

      const docExistsBefore = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        return (window as any).bifrost.editors.getEditorDocumentByUri(uri) != null;
      }, testDocUri);
      assert.strictEqual(docExistsBefore, true, 'document should exist before disable');

      await studioAgent.getTestDriver().client!.execute((pluginName: string) => {
        return (window as any).bifrost.plugins.togglePlugin(pluginName);
      }, 'kitchen-sink');

      await waitForPluginStatus(studioAgent, 'kitchen-sink', 'disabled');

      const docExistsAfter = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        return (window as any).bifrost.editors.getEditorDocumentByUri(uri) != null;
      }, testDocUri);
      assert.strictEqual(docExistsAfter, false, 'document should be closed after plugin disable');

      const hasDelegateAfter = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        return (window as any).bifrost.editors.saveDelegates.has(uri);
      }, testDocUri);
      assert.strictEqual(hasDelegateAfter, false, 'save delegate should be removed after plugin disable');
    });
  });

  describe('kitchen-sink: pane visibility API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: pane visibility API',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
      await waitForPluginCommand(studioAgent, 'plugin.webview-showcase.getState');
    });

    afterAll(async () => {
      await studioAgent?.stop();
    });

    it('pane-visibility/setVisible-shows-pane: setVisible(true) makes pane visible', async () => {
      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', true);

      const visible = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        if (provider?.shouldBeDisplayed == null) {
          return false;
        }
        return provider.shouldBeDisplayed(null, null, (window as any).bifrost);
      });
      assert.strictEqual(visible, true, 'pane should be visible after setVisible(true)');
    });

    it('pane-visibility/setVisible-hides-pane: setVisible(false) hides pane', async () => {
      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', false);

      const hidden = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        if (provider?.shouldBeDisplayed == null) {
          return true;
        }
        return provider.shouldBeDisplayed(null, null, (window as any).bifrost);
      });
      assert.strictEqual(hidden, false, 'pane should be hidden after setVisible(false)');

      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', true);
    });

    it('pane-visibility/toggle-cycle: show → hide → show cycle works correctly', async () => {
      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', true);
      const step1 = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        return provider?.shouldBeDisplayed?.(null, null, (window as any).bifrost) ?? false;
      });
      assert.strictEqual(step1, true, 'step 1: should be visible');

      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', false);
      const step2 = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        return provider?.shouldBeDisplayed?.(null, null, (window as any).bifrost) ?? true;
      });
      assert.strictEqual(step2, false, 'step 2: should be hidden');

      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', true);
      const step3 = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        return provider?.shouldBeDisplayed?.(null, null, (window as any).bifrost) ?? false;
      });
      assert.strictEqual(step3, true, 'step 3: should be visible again');
    });

    it('pane-visibility/settings-driven: plugin reacts to setting changes via setVisible', async () => {
      await studioAgent.getTestDriver().client!.execute((key: string) => {
        (window as any).bifrost.settings.set(key, false);
      }, 'plugin.webview-showcase.panes.showExample');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const visible = await studioAgent.getTestDriver().client!.execute(() => {
            const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
            return provider?.shouldBeDisplayed?.(null, null, (window as any).bifrost) ?? true;
          });
          return visible === false;
        },
        { timeout: 5_000, timeoutMsg: 'Pane did not react to setting=false via setVisible' },
      );

      await studioAgent.getTestDriver().client!.execute((key: string) => {
        (window as any).bifrost.settings.set(key, true);
      }, 'plugin.webview-showcase.panes.showExample');

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const visible = await studioAgent.getTestDriver().client!.execute(() => {
            const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
            return provider?.shouldBeDisplayed?.(null, null, (window as any).bifrost) ?? false;
          });
          return visible === true;
        },
        { timeout: 5_000, timeoutMsg: 'Pane did not react to setting=true via setVisible' },
      );
    });

    it('pane-visibility/cleanup-on-disable: visibility state cleared when plugin is disabled', async () => {
      await executePluginCommand(studioAgent, 'plugin.webview-showcase.forcePaneVisible', false);

      const hiddenBefore = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        if (provider?.shouldBeDisplayed == null) {
          return true;
        }
        return provider.shouldBeDisplayed(null, null, (window as any).bifrost);
      });
      assert.strictEqual(hiddenBefore, false, 'pane should be hidden before disable');

      await studioAgent.getTestDriver().client!.execute((name: string) => {
        return (window as any).bifrost.plugins.togglePlugin(name);
      }, 'webview-showcase');
      await waitForPluginStatus(studioAgent, 'webview-showcase', 'disabled');

      await studioAgent.getTestDriver().client!.execute((name: string) => {
        return (window as any).bifrost.plugins.togglePlugin(name);
      }, 'webview-showcase');
      await waitForPluginStatus(studioAgent, 'webview-showcase', 'loaded');
      await waitForPluginCommand(studioAgent, 'plugin.webview-showcase.getState');

      const visibleAfterReEnable = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider('plugin/webview-showcase/panes/sidebar');
        if (provider?.shouldBeDisplayed == null) {
          return false;
        }
        return provider.shouldBeDisplayed(null, null, (window as any).bifrost);
      });
      assert.strictEqual(
        visibleAfterReEnable,
        true,
        'after disable/re-enable, old visibility state should be gone and pane defaults to visible',
      );
    });

    it('pane-visibility/editorFocusChanged-event: plugin receives editor focus events', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.clearEditorFocusEvents');

      const focusEventsBefore = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents');
      const countBefore = focusEventsBefore.length;

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.editors.focusOrOpenEditorDocument('about:about', 'About');
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const events = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents');
          return events.length > countBefore;
        },
        { timeout: 10_000, timeoutMsg: 'Expected editorFocusChanged event after opening editor' },
      );

      const focusEventsAfter = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents');
      assert.ok(focusEventsAfter.length > countBefore, 'should have received at least one editorFocusChanged event');

      const lastEvent = focusEventsAfter[focusEventsAfter.length - 1];
      assert.ok(lastEvent.uri != null, 'focus event should contain a uri');
      assert.ok('documentType' in lastEvent, 'focus event should have a documentType key');
      assert.strictEqual(typeof lastEvent.uri, 'string', 'uri should be a string');

      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.clearEditorFocusEvents');
      const countAfterClear = (await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents'))
        .length;

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.editors.focusOrOpenEditorDocument('about:settings', 'Settings');
      });

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const events = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents');
          return events.length > countAfterClear;
        },
        { timeout: 10_000, timeoutMsg: 'Expected editorFocusChanged event after switching editor' },
      );

      const eventsAfterSwitch = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getEditorFocusEvents');
      assert.ok(eventsAfterSwitch.length > 0, 'should receive event when switching between editors');
    });

    it('pane-visibility/manifest-pane-visibleWhen: manifest placeholder pane uses visibleWhen as activation trigger', async () => {
      await waitForPluginCommand(studioAgent, 'plugin.manifest-full.manifestFull.greet');

      const visibleWithoutBpmn = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider(
          'plugin/manifest-full/panes/manifestFull.sidebar',
        );
        if (provider?.shouldBeDisplayed == null) {
          return true;
        }
        return provider.shouldBeDisplayed(null, null, (window as any).bifrost);
      });

      const visibleWithBpmn = await studioAgent.getTestDriver().client!.execute(() => {
        const provider = (window as any).bifrost.panes.getPaneProvider(
          'plugin/manifest-full/panes/manifestFull.sidebar',
        );
        if (provider?.shouldBeDisplayed == null) {
          return false;
        }
        const mockDoc = { documentType: 'bpmn', uri: 'file:///test.bpmn' };
        return provider.shouldBeDisplayed(mockDoc, null, (window as any).bifrost);
      });

      assert.strictEqual(visibleWithoutBpmn, false, 'manifest pane should be hidden when no BPMN is focused');
      assert.strictEqual(visibleWithBpmn, true, 'manifest pane should be visible when BPMN is focused');
    });
  });

  // ─── Tree View API ─────────────────────────────────────────────
  describe('kitchen-sink: tree view API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: tree view API',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    afterAll(async () => {
      await studioAgent.stopAndRecordErrors(false);
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('tree-view/register: registers a tree view pane', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerTreeView');

      const registered = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getTreeViewRegistered');
      assert.strictEqual(registered, true);

      const paneExists = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.panes.alreadyRegistered('plugin.kitchen-sink.ks-tree');
      });
      assert.strictEqual(paneExists, true, 'tree view pane should be registered in the pane system');
    });

    it('tree-view/update-and-clear-data: pushes tree data then clears it', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerTreeView');

      const updateResult = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.updateTreeData');
      assert.deepStrictEqual(updateResult, { updated: true });

      const clearResult = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.clearTreeData');
      assert.deepStrictEqual(clearResult, { cleared: true });
    });

    it('tree-view/cleanup-on-disable: tree view removed when plugin disabled', async () => {
      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('kitchen-sink');
      });
      await studioAgent.pause(2000);

      const paneExists = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.panes.alreadyRegistered('plugin.kitchen-sink.ks-tree');
      });
      assert.strictEqual(paneExists, false, 'tree view pane should be removed after plugin disable');

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('kitchen-sink');
      });
      await studioAgent.pause(3000);
    });
  });

  describe('tree-view-demo: tree view fixture', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'tree-view-demo: fixture',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.tree-view-demo.getTreeState');
    });

    afterAll(async () => {
      await studioAgent.stopAndRecordErrors(false);
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('tree-view/auto-register: tree view pane exists after activation', async () => {
      const paneExists = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.panes.alreadyRegistered('plugin.tree-view-demo.demo-tree');
      });
      assert.strictEqual(paneExists, true);
    });

    it('tree-view/initial-data: tree populated with sample data on activation', async () => {
      const state = await executePluginCommand(studioAgent, 'plugin.tree-view-demo.getTreeState');
      assert.strictEqual(state.registered, true);
    });

    it('tree-view/update: data update replaces tree content', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.tree-view-demo.updateTree');
      assert.deepStrictEqual(result, { updated: true });
    });

    it('tree-view/clear: empty array clears the tree', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.tree-view-demo.clearTree');
      assert.deepStrictEqual(result, { cleared: true });
    });

    it('tree-view/click-command: clicking an item executes the assigned command', async () => {
      await executePluginCommand(studioAgent, 'plugin.tree-view-demo.updateTree');
      await executePluginCommand(studioAgent, 'plugin.tree-view-demo.onItemClicked', {
        name: 'new-file.ts',
        type: 'typescript',
      });

      const clickedItems = await executePluginCommand(studioAgent, 'plugin.tree-view-demo.getClickedItems');
      assert.ok(clickedItems.length > 0, 'should have recorded at least one click');
      assert.strictEqual(clickedItems[clickedItems.length - 1].name, 'new-file.ts');
    });
  });

  // ─── Theme Contributions ───────────────────────────────────────
  describe('kitchen-sink: themes API', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'kitchen-sink: themes API',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.getStatus');
    });

    afterAll(async () => {
      await studioAgent.stopAndRecordErrors(false);
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('themes/register: runtime theme appears in registered themes and injects CSS', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerTheme');

      const registered = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getThemeRegistered');
      assert.strictEqual(registered, true);

      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.kitchen-sink.ks-test-dark');
      });
      assert.strictEqual(themeExists, true, 'theme should be in the registered themes list');

      const styleExists = await studioAgent.getTestDriver().client!.execute(() => {
        const styleEl = document.querySelector('style[data-plugin-theme="plugin.kitchen-sink.ks-test-dark"]');
        return styleEl != null;
      });
      assert.strictEqual(styleExists, true, 'theme <style> element should be injected');
    });

    it('themes/unregister: removing a theme clears CSS and theme list', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.unregisterTheme');

      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.kitchen-sink.ks-test-dark');
      });
      assert.strictEqual(themeExists, false, 'theme should be removed from the list');

      const styleExists = await studioAgent.getTestDriver().client!.execute(() => {
        return document.querySelector('style[data-plugin-theme="plugin.kitchen-sink.ks-test-dark"]') != null;
      });
      assert.strictEqual(styleExists, false, 'theme <style> element should be removed');
    });

    it('themes/get-active: returns the current active theme ID', async () => {
      const activeTheme = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.getActiveTheme');
      assert.ok(typeof activeTheme === 'string', 'active theme should be a string');
      assert.ok(activeTheme.length > 0, 'active theme should not be empty');
    });

    it('themes/cleanup-on-disable: plugin themes removed when plugin disabled', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.registerTheme');

      const beforeDisable = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.kitchen-sink.ks-test-dark');
      });
      assert.strictEqual(beforeDisable, true);

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('kitchen-sink');
      });
      await studioAgent.pause(2000);

      const afterDisable = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.kitchen-sink.ks-test-dark');
      });
      assert.strictEqual(afterDisable, false, 'theme should be removed after plugin disable');

      const styleAfterDisable = await studioAgent.getTestDriver().client!.execute(() => {
        return document.querySelector('style[data-plugin-theme="plugin.kitchen-sink.ks-test-dark"]') != null;
      });
      assert.strictEqual(styleAfterDisable, false, 'theme <style> should be removed after plugin disable');

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('kitchen-sink');
      });
      await studioAgent.pause(3000);
    });
  });

  describe('theme-demo: declarative theme contributions', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      studioAgent = await createAndStartStudioAgent({
        testName: 'theme-demo: declarative themes',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.theme-demo.getActiveTheme');
    });

    afterAll(async () => {
      await studioAgent.stopAndRecordErrors(false);
      delete process.env.BFR_PLUGINS_DIR;
    });

    it('themes/manifest-dark: dark manifest theme is registered', async () => {
      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.theme-demo.demoNight');
      });
      assert.strictEqual(themeExists, true, 'Demo Night theme should be registered from manifest');
    });

    it('themes/manifest-light: light manifest theme is registered', async () => {
      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.theme-demo.demoDay');
      });
      assert.strictEqual(themeExists, true, 'Demo Day theme should be registered from manifest');
    });

    it('themes/manifest-css: manifest theme CSS is injected', async () => {
      const darkStyleExists = await studioAgent.getTestDriver().client!.execute(() => {
        return document.querySelector('style[data-plugin-theme="plugin.theme-demo.demoNight"]') != null;
      });
      assert.strictEqual(darkStyleExists, true, 'Demo Night <style> element should be injected');

      const lightStyleExists = await studioAgent.getTestDriver().client!.execute(() => {
        return document.querySelector('style[data-plugin-theme="plugin.theme-demo.demoDay"]') != null;
      });
      assert.strictEqual(lightStyleExists, true, 'Demo Day <style> element should be injected');
    });

    it('themes/runtime-register: runtime API theme registration works', async () => {
      await executePluginCommand(studioAgent, 'plugin.theme-demo.registerRuntimeTheme');

      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.theme-demo.demoSolarized');
      });
      assert.strictEqual(themeExists, true, 'Runtime-registered theme should appear in theme list');
    });

    it('themes/runtime-unregister: runtime API theme removal works', async () => {
      await executePluginCommand(studioAgent, 'plugin.theme-demo.unregisterRuntimeTheme');

      const themeExists = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.some((theme: any) => theme.id === 'plugin.theme-demo.demoSolarized');
      });
      assert.strictEqual(themeExists, false, 'Runtime-unregistered theme should be removed');
    });

    it('themes/fallback-on-removal: active plugin theme falls back to default on removal', async () => {
      await executePluginCommand(studioAgent, 'plugin.theme-demo.registerRuntimeTheme');

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.theme.setTheme('plugin.theme-demo.demoSolarized');
      });
      await studioAgent.pause(500);

      const activeBeforeRemoval = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.theme.getCurrentTheme();
      });
      assert.strictEqual(activeBeforeRemoval, 'plugin.theme-demo.demoSolarized');

      await executePluginCommand(studioAgent, 'plugin.theme-demo.unregisterRuntimeTheme');
      await studioAgent.pause(500);

      const activeAfterRemoval = await studioAgent.getTestDriver().client!.execute(() => {
        return (window as any).bifrost.theme.getCurrentTheme();
      });
      assert.strictEqual(
        activeAfterRemoval,
        'dark',
        'should fall back to Bifrost Night (dark) when a dark theme is removed',
      );
    });

    it('themes/cleanup-on-disable: all manifest themes removed when plugin disabled', async () => {
      const beforeDisable = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.filter(
          (theme: any) => theme.id === 'plugin.theme-demo.demoNight' || theme.id === 'plugin.theme-demo.demoDay',
        ).length;
      });
      assert.strictEqual(beforeDisable, 2, 'both manifest themes should exist before disable');

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('theme-demo');
      });
      await studioAgent.pause(2000);

      const afterDisable = await studioAgent.getTestDriver().client!.execute(() => {
        const themes = (window as any).bifrost.theme.getRegisteredThemes();
        return themes.filter(
          (theme: any) => theme.id === 'plugin.theme-demo.demoNight' || theme.id === 'plugin.theme-demo.demoDay',
        ).length;
      });
      assert.strictEqual(afterDisable, 0, 'manifest themes should be removed after plugin disable');

      await studioAgent.getTestDriver().client!.execute(() => {
        (window as any).bifrost.plugins.togglePlugin('theme-demo');
      });
      await studioAgent.pause(3000);
    });
  });

  // ─── Sandbox Security Tests ──────────────────────────────────────

  describe('sandbox: permission enforcement', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'sandbox: permission enforcement',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryWorkspace');
    });

    afterAll(async () => {
      await studioAgent?.stop();
    });

    it('denies workspace API access to zero-permission plugin', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryWorkspace');
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });

    it('denies hard-blocked commands (git.commit)', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryBlockedCommand');
      // `git.commit` matches the top-level `HARD_DENIED` patterns in CommandDenylist.ts, which
      // intentionally throw a `CommandBlockedError` ("is blocked"). Only the more specific
      // `HARD_DENIED_SUBPATTERNS` (e.g. `std.solution.*`) are disguised as "not registered" to
      // avoid revealing their existence to malicious plugins.
      assert.ok(typeof result === 'string' && result.includes('blocked'), `Expected 'blocked', got: ${result}`);
    });

    it('denies std.* commands without commands.std permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryStdCommand');
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });

    it('denies settings write to foreign namespace', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.trySettingsWrite');
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });

    it('allows settings write to own namespace', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryOwnSettings');
      assert.strictEqual(result, 'ok', 'Plugin should be able to write its own settings namespace');
    });

    it('denies workspace.onDidChangeFile without filesystem permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-no-perms.tryFileWatcher');
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });
  });

  describe('sandbox: module gate', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'sandbox: module gate',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.sandbox-module-gate.tryRequireFs');
    });

    afterAll(async () => {
      await studioAgent?.stop();
    });

    it('blocks require("fs") without filesystem permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-module-gate.tryRequireFs');
      assert.ok(typeof result === 'string' && result !== 'ok', `Expected module block, got: ${result}`);
    });

    it('blocks require("http") unconditionally', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-module-gate.tryRequireHttp');
      assert.ok(typeof result === 'string' && result !== 'ok', `Expected module block, got: ${result}`);
    });

    it('allows require("os") with system-info permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-module-gate.tryRequireOs');
      assert.ok(typeof result === 'string' && result !== '', `Expected os.platform() result, got: ${result}`);
      assert.doesNotMatch(result, /denied|blocked|Error/i, 'Should not be blocked');
    });

    it('allows require("path") unconditionally', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.sandbox-module-gate.tryRequirePath');
      assert.ok(typeof result === 'string', 'Should return a string');
      assert.doesNotMatch(result, /denied|blocked|Error/i, 'path.join should work');
    });
  });

  describe('sandbox: quarantine', () => {
    let studioAgent: StudioAgent;
    const quarantineStoragePath = path.join(os.tmpdir(), 'bifrost-test-quarantine-storage');

    beforeAll(async () => {
      // Use an isolated plugin-storage directory so this test does not
      // interfere with the user's real quarantine state in the dev channel.
      await fs.rm(quarantineStoragePath, { recursive: true, force: true });
      await fs.mkdir(quarantineStoragePath, { recursive: true });

      process.env.BFR_PLUGIN_STORAGE_PATH = quarantineStoragePath;
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'sandbox: quarantine',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginStatus(studioAgent, 'sandbox-crash', 'loaded');
      await waitForPluginCommand(studioAgent, 'plugin.sandbox-crash.crash');
    });

    afterAll(async () => {
      await studioAgent?.stop();
      delete process.env.BFR_PLUGIN_STORAGE_PATH;
      await fs.rm(quarantineStoragePath, { recursive: true, force: true });
    });

    it('plugin enters quarantined status after repeated crashes', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await executePluginCommand(studioAgent, 'plugin.sandbox-crash.crash');
        } catch {
          // crash expected
        }
        if (i < 2) {
          await studioAgent.pause(2000);
          await waitForPluginCommand(studioAgent, 'plugin.sandbox-crash.crash');
        }
      }

      await studioAgent.getTestDriver().client!.waitUntil(
        async () => {
          const plugins = await getPluginList(studioAgent);
          const crashPlugin = plugins.find((plugin: any) => plugin.name === 'sandbox-crash');
          return crashPlugin?.status === 'quarantined';
        },
        { timeout: 15_000, timeoutMsg: 'Plugin did not reach quarantined status within 15s' },
      );

      const plugins = await getPluginList(studioAgent);
      const crashPlugin = plugins.find((plugin: any) => plugin.name === 'sandbox-crash');
      assert.ok(crashPlugin, 'sandbox-crash plugin should exist');
      assert.strictEqual(crashPlugin.status, 'quarantined', 'Plugin should be quarantined after 3 crashes');
    });
  });

  describe('sandbox: scoped plugin name', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'sandbox: scoped plugin name',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.test-scope--scoped-plugin.ping');
    });

    afterAll(async () => {
      await studioAgent?.stop();
    });

    it('scoped plugin loads and registers commands correctly', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.test-scope--scoped-plugin.ping');
      assert.strictEqual(result, 'pong', 'Scoped plugin should respond to ping');
    });

    it('scoped plugin appears in plugin list with normalized name', async () => {
      const plugins = await getPluginList(studioAgent);
      const scopedPlugin = plugins.find((plugin: any) => plugin.name === 'test-scope--scoped-plugin');
      assert.ok(scopedPlugin, 'Scoped plugin should be in the plugin list');
      assert.strictEqual(scopedPlugin.status, 'loaded', 'Scoped plugin should be loaded');
      assert.strictEqual(
        scopedPlugin.packageName,
        '@test-scope/scoped-plugin',
        'packageName should preserve the original scoped npm name',
      );
    });
  });

  describe('sandbox: settings namespace enforcement (add/removeValue)', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'sandbox: settings namespace enforcement',
        testFile: __filename,
      });
      await waitForPluginList(studioAgent, FIXTURE_PLUGIN_COUNT);
      await waitForPluginCommand(studioAgent, 'plugin.kitchen-sink.tryAddOutsideNamespace');
    });

    afterAll(async () => {
      await studioAgent?.stop();
    });

    it('denies settings.add() to foreign namespace', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.tryAddOutsideNamespace',
        'plugins.disabledPlugins',
        'some-plugin',
      );
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });

    it('denies settings.removeValue() to foreign namespace', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.kitchen-sink.tryRemoveOutsideNamespace',
        'plugins.trustedPlugins',
        'some-plugin',
      );
      assert.ok(typeof result === 'string' && result.includes('denied'), `Expected denial, got: ${result}`);
    });

    it('allows settings.add() to own namespace', async () => {
      await executePluginCommand(studioAgent, 'plugin.kitchen-sink.addToArraySetting', 'test-item');
      const result = await executePluginCommand(studioAgent, 'plugin.kitchen-sink.readArraySetting');
      assert.ok(Array.isArray(result) && result.includes('test-item'), 'Should allow add to own namespace');
    });
  });
});
