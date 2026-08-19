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

describe('plugin/bpmn-modeling', { timeout: 120_000 }, () => {
  describe('permission gating — bpmn.modelling required for modeling.*', () => {
    let studioAgent: StudioAgent;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-modeling-perm',
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

    it('denies modeling.updateProperties to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingUpdateProperties');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.removeElement to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingRemoveElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.appendElement to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingAppendElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.createConnection to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingCreateConnection');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.moveElement to plugin without bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingMoveElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('permission error message mentions bpmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.bpmn-perm-low.tryModelingUpdateProperties');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('modelling') || result.toLowerCase().includes('bpmn.modelling'),
        `Expected error to mention 'bpmn.modelling', got: ${result}`,
      );
    });
  });

  describe('modeling operations', () => {
    let studioAgent: StudioAgent;
    let bpmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgent({
        testName: 'bpmn-modeling-ops',
        testFile: __filename,
      });
      await waitForPluginCommand(studioAgent, 'plugin.bpmn-palette-demo.test.modeling.updateProperties');
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

    it('updateProperties changes element name', async () => {
      const elements = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return [];
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return [];
        }
        const registry = modeler.get('elementRegistry');
        return registry
          .filter((el: any) => el.type.includes('Task'))
          .map((el: any) => ({ id: el.id, name: el.businessObject?.name }));
      }, bpmnUri);

      assert.ok(Array.isArray(elements) && elements.length > 0, 'Expected at least one task');
      const targetId = elements[0].id;

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.updateProperties',
        bpmnUri,
        targetId,
        { name: 'Updated by Plugin' },
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const updatedName = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
          if (adapter == null) {
            return null;
          }
          const modeler = adapter.getModeler?.();
          if (modeler == null) {
            return null;
          }
          const registry = modeler.get('elementRegistry');
          const el = registry.get(elementId);
          return el?.businessObject?.name ?? null;
        },
        bpmnUri,
        targetId,
      );
      assert.strictEqual(updatedName, 'Updated by Plugin');
    });

    it('updateProperties rejects blocked properties ($type, $parent, di)', async () => {
      const elements = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return [];
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return [];
        }
        const registry = modeler.get('elementRegistry');
        return registry.filter((el: any) => el.type.includes('Task')).map((el: any) => ({ id: el.id }));
      }, bpmnUri);
      assert.ok(elements.length > 0);

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.updateProperties',
        bpmnUri,
        elements[0].id,
        { $type: 'bpmn:ServiceTask' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error for $type, got: ${result}`);
    });

    it('updateProperties returns error for non-existent element', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.updateProperties',
        bpmnUri,
        'NonExistent_xyz_123',
        { name: 'fail' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
      assert.ok(result.includes('not found'), `Expected 'not found' in error, got: ${result}`);
    });

    it('appendElement creates a new connected element', async () => {
      const sourceId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return null;
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const registry = modeler.get('elementRegistry');
        const tasks = registry.filter((el: any) => el.type === 'bpmn:Task' || el.type === 'bpmn:ServiceTask');
        return tasks.length > 0 ? tasks[0].id : null;
      }, bpmnUri);
      assert.ok(sourceId != null, 'Expected a task element');

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.appendElement',
        bpmnUri,
        sourceId,
        { type: 'bpmn:UserTask', name: 'Appended Task' },
      );
      assert.ok(result != null && typeof result === 'object', `Expected object result, got: ${typeof result}`);
      assert.ok('elementId' in result, 'Result should have elementId');
      assert.ok(typeof result.elementId === 'string' && result.elementId.length > 0, 'elementId should be a string');

      const exists = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
          if (adapter == null) {
            return false;
          }
          const modeler = adapter.getModeler?.();
          if (modeler == null) {
            return false;
          }
          const registry = modeler.get('elementRegistry');
          return registry.get(elementId) != null;
        },
        bpmnUri,
        result.elementId,
      );
      assert.strictEqual(exists, true, 'Appended element should exist in the registry');
    });

    it('appendElement returns error for non-existent source', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.appendElement',
        bpmnUri,
        'NonExistent_source_999',
        { type: 'bpmn:Task' },
      );
      assert.ok(
        typeof result === 'string' && result.startsWith('error:'),
        `Expected error, got: ${JSON.stringify(result)}`,
      );
    });

    it('moveElement changes element position', async () => {
      const elementData = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return null;
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const registry = modeler.get('elementRegistry');
        const tasks = registry.filter((el: any) => el.type.includes('Task'));
        if (tasks.length === 0) {
          return null;
        }
        return { id: tasks[0].id, x: tasks[0].x, y: tasks[0].y };
      }, bpmnUri);
      assert.ok(elementData != null, 'Expected a task element with position');

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.moveElement',
        bpmnUri,
        elementData.id,
        { x: 30, y: -20 },
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const newPosition = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
          if (adapter == null) {
            return null;
          }
          const modeler = adapter.getModeler?.();
          if (modeler == null) {
            return null;
          }
          const registry = modeler.get('elementRegistry');
          const el = registry.get(elementId);
          if (el == null) {
            return null;
          }
          return { x: el.x, y: el.y };
        },
        bpmnUri,
        elementData.id,
      );
      assert.ok(newPosition != null, 'Expected element to still exist');
      assert.strictEqual(newPosition.x, elementData.x + 30, 'X should be moved +30');
      assert.strictEqual(newPosition.y, elementData.y - 20, 'Y should be moved -20');
    });

    it('moveElement returns error for non-finite delta', async () => {
      const taskId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return null;
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const registry = modeler.get('elementRegistry');
        const tasks = registry.filter((el: any) => el.type.includes('Task'));
        return tasks.length > 0 ? tasks[0].id : null;
      }, bpmnUri);
      assert.ok(taskId != null);

      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.moveElement',
        bpmnUri,
        taskId,
        { x: Infinity, y: 0 },
      );
      assert.ok(
        typeof result === 'string' && result.startsWith('error:'),
        `Expected error for non-finite delta, got: ${result}`,
      );
    });

    it('removeElement removes the element from canvas', async () => {
      // First append a disposable element to remove
      const sourceId = await studioAgent.getTestDriver().client!.execute((uri: string) => {
        const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
        if (adapter == null) {
          return null;
        }
        const modeler = adapter.getModeler?.();
        if (modeler == null) {
          return null;
        }
        const registry = modeler.get('elementRegistry');
        const tasks = registry.filter((el: any) => el.type.includes('Task'));
        return tasks.length > 0 ? tasks[0].id : null;
      }, bpmnUri);
      assert.ok(sourceId != null);

      const appendResult = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.appendElement',
        bpmnUri,
        sourceId,
        { type: 'bpmn:Task', name: 'To Be Deleted' },
      );
      assert.ok(appendResult != null && 'elementId' in appendResult);
      const toDeleteId = appendResult.elementId;

      const removeResult = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.removeElement',
        bpmnUri,
        toDeleteId,
      );
      assert.strictEqual(removeResult, 'ok', `Expected 'ok', got: ${removeResult}`);

      const stillExists = await studioAgent.getTestDriver().client!.execute(
        (uri: string, elementId: string) => {
          const adapter = (window as any).__bfwResolveBpmnAdapter(uri);
          if (adapter == null) {
            return true;
          }
          const modeler = adapter.getModeler?.();
          if (modeler == null) {
            return true;
          }
          const registry = modeler.get('elementRegistry');
          return registry.get(elementId) != null;
        },
        bpmnUri,
        toDeleteId,
      );
      assert.strictEqual(stillExists, false, 'Element should no longer exist after removal');
    });

    it('operations on non-BPMN URI returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.bpmn-palette-demo.test.modeling.updateProperties',
        'file:///nonexistent.bpmn',
        'Task_1',
        { name: 'fail' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });
  });
});
