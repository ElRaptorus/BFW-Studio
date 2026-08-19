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

// Manifest-declared commands are registered as stubs at plugin discovery time,
// before `activate()` runs — `isRegistered` is true for a stub immediately, so
// waiting on any particular command name does not guarantee `activate()` has
// finished replacing every stub with its real handler. Waiting for the plugin
// status to reach 'loaded' is the only reliable signal (see the DMN permission
// test suites, which already use this pattern for the same reason).
async function waitForPluginStatus(
  studioAgent: StudioAgent,
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

async function executePluginCommand(studioAgent: StudioAgent, commandId: string, ...args: unknown[]): Promise<any> {
  return studioAgent.executeCommand(commandId, args);
}

async function openBpmnFileAndGetUri(studioAgent: StudioAgent, filename: string): Promise<string> {
  const fixtureDir = path.resolve(__dirname, '../../fixtures/test-solution-bpmn');
  const filePath = path.join(fixtureDir, filename);
  const fileUri = `file://${filePath}`;

  await studioAgent.jumpToFileInSolution(filename, 'bpmn');
  await studioAgent.assertVisible('.djs-container', ASSERT_VISIBLE_TIMEOUT);

  return fileUri;
}

/**
 * Installs a test-only global that resolves the BPMN modeler adapter for a given document URI.
 *
 * There is no `bpmn:modeler-adapter` shared resource in the product — `Bifrost.getSharedRessource`
 * throws on unknown keys. The correct, public way to reach the modeler is via the editor document
 * model's `modelerAdapter` getter (see `BpmnApiBridge.resolveAdapter`). WebdriverIO `execute`
 * callbacks cannot close over test-module helpers, so this resolver is installed once per suite as
 * a `window` global and referenced by URI from every `execute` call site.
 */
async function installBpmnAdapterResolver(studioAgent: StudioAgent): Promise<void> {
  await studioAgent.getTestDriver().client!.execute(() => {
    (window as any).__bfwResolveBpmnAdapter = (uri: string) => {
      const bifrost = (window as any).bifrost;
      const doc = bifrost?.editors?.getEditorDocumentByUri?.(uri);
      if (doc == null) {
        return null;
      }
      const model = bifrost.editors.getEditorDocumentModelIfPresent(doc);
      return model?.modelerAdapter ?? null;
    };
  });
}

describe('plugin/bpmn-palette-contextpad', { timeout: 120_000 }, () => {
  describe('permission gating — bpmn.modelling required', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-palette-perm',
        testFile: __filename,
      });
      await waitForPluginStatus(studioAgent, 'bpmn-perm-low', 'loaded');
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

    it('denies registerPaletteEntry to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryRegisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies unregisterPaletteEntry to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryUnregisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies registerContextPadEntry to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryRegisterContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies unregisterContextPadEntry to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryUnregisterContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies updateContextPadEntry to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryUpdateContextPadEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('permission error message mentions the required permission', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryRegisterPaletteEntry');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('modelling') || result.toLowerCase().includes('bpmn.modelling'),
        `Expected error to mention 'bpmn.modelling', got: ${result}`,
      );
    });
  });

  // Shuffle disabled: these tests share one long-lived studioAgent/document and have genuine
  // order dependencies (e.g. "unregisterContextPadEntry removes the entry" must run after
  // "runtime context pad entry (toggle-flag) appears", and the updateContextPadEntry tests must
  // run in the order they mutate the shared `view-connections` allowlist). The global
  // `sequence: { shuffle: true }` in vitest.config.ts would otherwise interleave these
  // mutating/asserting pairs randomly. See docs/architecture/common-pitfalls.md.
  describe('palette and context pad lifecycle', { shuffle: false }, () => {
    let studioAgent: StudioAgent;
    let bpmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-palette-lifecycle',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-palette-demo.test.isActivated');
      await installBpmnAdapterResolver(studioAgent);
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
      bpmnUri = await openBpmnFileAndGetUri(studioAgent, 'untyped-task.bpmn');
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
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-palette-demo.test.isActivated');
      assert.strictEqual(result, true);
    });

    it('manifest palette entry appears in BPMN palette', async () => {
      const hasPaletteEntry = await studioAgent.getTestDriver().client!.execute(() => {
        const entry = document.querySelector('.djs-palette [data-action="plugin.bpmn-palette-demo.run-analysis"]');
        if (entry != null) {
          return true;
        }
        const allEntries = document.querySelectorAll('.djs-palette .entry, .djs-palette .djs-palette-entries > *');
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
      const hasEntry = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const tasks = elementRegistry.filter(
          (el: any) =>
            el.type === 'bpmn:Task' ||
            el.type === 'bpmn:ServiceTask' ||
            el.type === 'bpmn:UserTask' ||
            el.type === 'bpmn:ScriptTask',
        );
        if (tasks.length === 0) {
          return 'no-tasks';
        }
        const entries = contextPad.getEntries(tasks[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.inspect-element'),
        );
        return pluginEntry != null;
      }, bpmnUri);
      assert.strictEqual(hasEntry, true, `Expected manifest context pad entry on task element, got: ${hasEntry}`);
    });

    it('manifest context pad entry does NOT appear on non-matching element type', async () => {
      const result = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const startEvents = elementRegistry.filter((el: any) => el.type === 'bpmn:StartEvent');
        if (startEvents.length === 0) {
          return 'no-start-events';
        }
        const entries = contextPad.getEntries(startEvents[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.inspect-element'),
        );
        return pluginEntry == null;
      }, bpmnUri);
      assert.strictEqual(result, true, `Expected NO context pad entry on StartEvent, got: ${result}`);
    });

    it('runtime context pad entry (toggle-flag) appears on all elements', async () => {
      const result = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const startEvents = elementRegistry.filter((el: any) => el.type === 'bpmn:StartEvent');
        if (startEvents.length === 0) {
          return 'no-start-events';
        }
        const entries = contextPad.getEntries(startEvents[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.toggle-flag'),
        );
        return pluginEntry != null;
      }, bpmnUri);
      assert.strictEqual(result, true, `Expected toggle-flag context pad entry on StartEvent, got: ${result}`);
    });

    it('dynamic context pad entry with empty elementIds does NOT appear', async () => {
      const result = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const tasks = elementRegistry.filter((el: any) => el.type === 'bpmn:Task');
        if (tasks.length === 0) {
          return 'no-tasks';
        }
        const entries = contextPad.getEntries(tasks[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.view-connections'),
        );
        return pluginEntry == null;
      }, bpmnUri);
      assert.strictEqual(
        result,
        true,
        `Expected view-connections entry NOT to appear (empty elementIds), got: ${result}`,
      );
    });

    it('updateContextPadEntry with specific IDs makes entry visible on those elements', async () => {
      const targetElementId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return null;
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const elementRegistry = modeler.get('elementRegistry');
        const tasks = elementRegistry.filter((el: any) => el.type === 'bpmn:Task');
        return tasks.length > 0 ? tasks[0].id : null;
      }, bpmnUri);
      assert.ok(targetElementId != null, 'Expected to find at least one Task element');

      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.updateContextPadEntry',
        'view-connections',
        { elementIds: [targetElementId] },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      const hasEntry = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
          if (canvas == null) {
            return 'no-adapter';
          }
          const modeler = canvas.getModeler?.();
          if (modeler == null) {
            return 'no-modeler';
          }
          const elementRegistry = modeler.get('elementRegistry');
          const contextPad = modeler.get('contextPad');
          const element = elementRegistry.get(elementId);
          if (element == null) {
            return 'element-not-found';
          }
          const entries = contextPad.getEntries(element);
          const pluginEntry = Object.keys(entries).find((key: string) =>
            key.includes('plugin.bpmn-palette-demo.view-connections'),
          );
          return pluginEntry != null;
        },
        bpmnUri,
        targetElementId,
      );
      assert.strictEqual(hasEntry, true, `Expected view-connections entry to appear on ${targetElementId}`);
    });

    it('updateContextPadEntry with null clears the allowlist (entry shows on all matching types)', async () => {
      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.updateContextPadEntry',
        'view-connections',
        { elementIds: null },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      const hasEntry = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const tasks = elementRegistry.filter((el: any) => el.type === 'bpmn:Task');
        if (tasks.length === 0) {
          return 'no-tasks';
        }
        const entries = contextPad.getEntries(tasks[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.view-connections'),
        );
        return pluginEntry != null;
      }, bpmnUri);
      assert.strictEqual(hasEntry, true, 'Expected view-connections entry to appear after clearing elementIds');
    });

    it('updateContextPadEntry for non-existent entry returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.updateContextPadEntry',
        'non-existent-entry-id',
        { elementIds: ['Task_1'] },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('unregisterContextPadEntry removes the entry', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.tryUnregisterContextPadEntry',
        'toggle-flag',
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const hasEntry = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return 'no-adapter';
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return 'no-modeler';
        }
        const elementRegistry = modeler.get('elementRegistry');
        const contextPad = modeler.get('contextPad');
        const startEvents = elementRegistry.filter((el: any) => el.type === 'bpmn:StartEvent');
        if (startEvents.length === 0) {
          return 'no-start-events';
        }
        const entries = contextPad.getEntries(startEvents[0]);
        const pluginEntry = Object.keys(entries).find((key: string) =>
          key.includes('plugin.bpmn-palette-demo.toggle-flag'),
        );
        return pluginEntry == null;
      }, bpmnUri);
      assert.strictEqual(hasEntry, true, 'Expected toggle-flag to be removed after unregister');
    });

    it('unregisterContextPadEntry for non-existent entry returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.tryUnregisterContextPadEntry',
        'does-not-exist',
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });

    it('elementIds and elementTypes work together — both must match', async () => {
      const taskId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return null;
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const elementRegistry = modeler.get('elementRegistry');
        const tasks = elementRegistry.filter((el: any) => el.type === 'bpmn:Task');
        return tasks.length > 0 ? tasks[0].id : null;
      }, bpmnUri);
      assert.ok(taskId != null, 'Expected to find a Task element');

      const startEventId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
        if (canvas == null) {
          return null;
        }
        const modeler = canvas.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const elementRegistry = modeler.get('elementRegistry');
        const startEvents = elementRegistry.filter((el: any) => el.type === 'bpmn:StartEvent');
        return startEvents.length > 0 ? startEvents[0].id : null;
      }, bpmnUri);
      assert.ok(startEventId != null, 'Expected to find a StartEvent element');

      // "inspect-element" has elementTypes: ['bpmn:Task', 'bpmn:SubProcess'] from the manifest.
      // Now set elementIds to include only the startEventId — which does NOT match the type filter.
      // The entry should NOT appear on the start event because elementTypes blocks it.
      const updateResult = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.updateContextPadEntry',
        'inspect-element',
        { elementIds: [startEventId, taskId] },
      );
      assert.strictEqual(updateResult, 'ok', `Expected 'ok', got: ${updateResult}`);

      // Check that the entry appears on the task (type match + id match)
      const taskHasEntry = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
          if (canvas == null) {
            return 'no-adapter';
          }
          const modeler = canvas.getModeler?.();
          if (modeler == null) {
            return 'no-modeler';
          }
          const elementRegistry = modeler.get('elementRegistry');
          const contextPad = modeler.get('contextPad');
          const element = elementRegistry.get(elementId);
          if (element == null) {
            return 'element-not-found';
          }
          const entries = contextPad.getEntries(element);
          const pluginEntry = Object.keys(entries).find((key: string) =>
            key.includes('plugin.bpmn-palette-demo.inspect-element'),
          );
          return pluginEntry != null;
        },
        bpmnUri,
        taskId,
      );
      assert.strictEqual(taskHasEntry, true, 'Expected inspect-element to appear on Task (types AND ids match)');

      // Check that the entry does NOT appear on the start event (type mismatch despite id match)
      const startHasEntry = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const canvas = (window as any).__bfwResolveBpmnAdapter(uri);
          if (canvas == null) {
            return 'no-adapter';
          }
          const modeler = canvas.getModeler?.();
          if (modeler == null) {
            return 'no-modeler';
          }
          const elementRegistry = modeler.get('elementRegistry');
          const contextPad = modeler.get('contextPad');
          const element = elementRegistry.get(elementId);
          if (element == null) {
            return 'element-not-found';
          }
          const entries = contextPad.getEntries(element);
          const pluginEntry = Object.keys(entries).find((key: string) =>
            key.includes('plugin.bpmn-palette-demo.inspect-element'),
          );
          return pluginEntry == null;
        },
        bpmnUri,
        startEventId,
      );
      assert.strictEqual(
        startHasEntry,
        true,
        'Expected inspect-element NOT on StartEvent (type filter blocks it despite id match)',
      );

      // Clean up: clear the elementIds so subsequent tests aren't affected
      await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.updateContextPadEntry',
        'inspect-element',
        { elementIds: null },
      );
    });
  });
});
