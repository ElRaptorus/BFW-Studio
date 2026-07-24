import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

const PLUGIN_LOAD_TIMEOUT = 30_000;

const DECISION_ELEMENT_ID = 'Decision_Discount';
const INPUT_DATA_ELEMENT_ID = 'InputData_Age';

// Manifest-declared commands are registered as stubs at plugin discovery time,
// before `activate()` runs — `isRegistered` is true for a stub immediately, so
// waiting on any particular command name (even the "last" one declared) does not
// guarantee `activate()` has finished replacing every stub with its real handler.
// Waiting for the plugin status to reach 'loaded' is the only reliable signal.
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

async function hasContextPadEntry(
  studioAgent: StudioAgentDmnExtension,
  elementId: string,
  entryIdFragment: string,
): Promise<boolean> {
  return studioAgent.getTestDriver().client!.execute(
    (id: string, fragment: string) => {
      const container = document.querySelector('.dmn-drd-container') ?? document;
      const contextPad = container.querySelectorAll('.djs-context-pad .entry, .djs-context-pad [data-action]');
      for (const entry of contextPad) {
        const action = entry.getAttribute('data-action');
        if (action != null && action.includes(fragment)) {
          return true;
        }
      }
      return false;
    },
    elementId,
    entryIdFragment,
  );
}

describe('plugin/dmn-palette-contextpad', { timeout: 120_000 }, () => {
  describe('permission gating — dmn.modelling required', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-palette-perm',
        testFile: __filename,
      });
      await waitForPluginStatus(studioAgent, 'dmn-perm-low', 'loaded');
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

    it('denies registerPaletteEntry to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryRegisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies unregisterPaletteEntry to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryUnregisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies registerContextPadEntry to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryRegisterContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies unregisterContextPadEntry to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryUnregisterContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies updateContextPadEntry to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryUpdateContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('permission error message mentions the required permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryRegisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('modelling') || result.toLowerCase().includes('dmn.modelling'),
        `Expected error to mention 'dmn.modelling', got: ${result}`,
      );
    });
  });

  describe('palette and context pad lifecycle', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-palette-lifecycle',
        testFile: __filename,
      });
      // dmn-palette-demo activates lazily via `onDocumentType:dmn` — it only starts
      // activating once a DMN document is opened, so the status wait must come after.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
      await studioAgent.waitForInteractiveDmnDocument();
      await studioAgent.assertVisible('.dmn-drd-container', ASSERT_VISIBLE_TIMEOUT);
      await waitForPluginStatus(studioAgent, 'dmn-palette-demo', 'loaded');
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

    it('plugin activates successfully', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-palette-demo.test.isActivated');
      assert.strictEqual(result, true);
    });

    it('manifest palette entry appears in DMN palette', async () => {
      const hasPaletteEntry = await studioAgent.getTestDriver().client!.execute(() => {
        const container = document.querySelector('.dmn-drd-container') ?? document;
        const entry = container.querySelector('.djs-palette [data-action="plugin.dmn-palette-demo.run-analysis"]');
        if (entry != null) {
          return true;
        }
        const allEntries = container.querySelectorAll('.djs-palette .entry, .djs-palette .djs-palette-entries > *');
        for (const el of allEntries) {
          if (el.getAttribute('title')?.includes('Run Analysis')) {
            return true;
          }
        }
        return false;
      });
      assert.strictEqual(hasPaletteEntry, true, 'Expected "Run Analysis" palette entry to appear');
    });

    it('manifest context pad entry appears on matching element type', async () => {
      await studioAgent.selectDmnElementByIdAndWaitForElement(DECISION_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        DECISION_ELEMENT_ID,
        'plugin.dmn-palette-demo.inspect-element',
      );
      assert.strictEqual(hasEntry, true, 'Expected manifest context pad entry on Decision element');
    });

    it('runtime context pad entry (toggle-flag) appears on all elements', async () => {
      await studioAgent.selectDmnElementByIdAndWaitForElement(INPUT_DATA_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        INPUT_DATA_ELEMENT_ID,
        'plugin.dmn-palette-demo.toggle-flag',
      );
      assert.strictEqual(hasEntry, true, 'Expected toggle-flag context pad entry on InputData element');
    });

    it('dynamic context pad entry with empty elementIds does NOT appear', async () => {
      // `vitest.config.ts` shuffles test order within a describe block, so this test
      // cannot assume it runs before the "updateContextPadEntry" tests below that
      // mutate the same 'view-requirements' entry — reset it back to its manifest-
      // declared empty allowlist first.
      await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'view-requirements',
        {
          elementIds: [],
        },
      );
      await studioAgent.selectDmnElementByIdAndWaitForElement(DECISION_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        DECISION_ELEMENT_ID,
        'plugin.dmn-palette-demo.view-requirements',
      );
      assert.strictEqual(hasEntry, false, 'Expected view-requirements entry NOT to appear (empty elementIds)');
    });

    it('updateContextPadEntry with specific IDs makes entry visible on those elements', async () => {
      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'view-requirements',
        { elementIds: [DECISION_ELEMENT_ID] },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      await studioAgent.selectDmnElementByIdAndWaitForElement(DECISION_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        DECISION_ELEMENT_ID,
        'plugin.dmn-palette-demo.view-requirements',
      );
      assert.strictEqual(hasEntry, true, `Expected view-requirements entry to appear on ${DECISION_ELEMENT_ID}`);
    });

    it('updateContextPadEntry with null clears the allowlist (entry shows on all matching types)', async () => {
      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'view-requirements',
        { elementIds: null },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      await studioAgent.selectDmnElementByIdAndWaitForElement(DECISION_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        DECISION_ELEMENT_ID,
        'plugin.dmn-palette-demo.view-requirements',
      );
      assert.strictEqual(hasEntry, true, 'Expected view-requirements entry to appear after clearing elementIds');
    });

    it('updateContextPadEntry for non-existent entry returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'non-existent-entry-id',
        { elementIds: [DECISION_ELEMENT_ID] },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('unregisterContextPadEntry removes the entry', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.tryUnregisterContextPadEntry',
        'toggle-flag',
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      await studioAgent.selectDmnElementByIdAndWaitForElement(INPUT_DATA_ELEMENT_ID, '.djs-context-pad');
      const hasEntry = await hasContextPadEntry(
        studioAgent,
        INPUT_DATA_ELEMENT_ID,
        'plugin.dmn-palette-demo.toggle-flag',
      );
      assert.strictEqual(hasEntry, false, 'Expected toggle-flag to be removed after unregister');
    });

    it('unregisterContextPadEntry for non-existent entry returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.tryUnregisterContextPadEntry',
        'does-not-exist',
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('elementIds and elementTypes work together — both must match', async () => {
      // "view-requirements" has elementTypes: ['dmn:Decision'] from the manifest/runtime registration.
      // Set elementIds to include both the InputData and Decision element — InputData does NOT
      // match the type filter, so the entry must still be excluded there despite the id match.
      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'view-requirements',
        { elementIds: [INPUT_DATA_ELEMENT_ID, DECISION_ELEMENT_ID] },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      await studioAgent.selectDmnElementByIdAndWaitForElement(DECISION_ELEMENT_ID, '.djs-context-pad');
      const decisionHasEntry = await hasContextPadEntry(
        studioAgent,
        DECISION_ELEMENT_ID,
        'plugin.dmn-palette-demo.view-requirements',
      );
      assert.strictEqual(
        decisionHasEntry,
        true,
        'Expected view-requirements to appear on Decision (types AND ids match)',
      );

      await studioAgent.selectDmnElementByIdAndWaitForElement(INPUT_DATA_ELEMENT_ID, '.djs-context-pad');
      const inputDataHasEntry = await hasContextPadEntry(
        studioAgent,
        INPUT_DATA_ELEMENT_ID,
        'plugin.dmn-palette-demo.view-requirements',
      );
      assert.strictEqual(
        inputDataHasEntry,
        false,
        'Expected view-requirements NOT on InputData (type filter blocks it despite id match)',
      );

      // Clean up: clear the elementIds so subsequent tests aren't affected.
      await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.updateContextPadEntry',
        'view-requirements',
        {
          elementIds: null,
        },
      );
    });
  });
});
