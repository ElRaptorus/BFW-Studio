import * as assert from 'node:assert';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');

const PLUGIN_LOAD_TIMEOUT = 30_000;

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

async function openDmnFileAndGetUri(studioAgent: StudioAgentDmnExtension, filename: string): Promise<string> {
  const fixtureDir = path.resolve(__dirname, '../../fixtures/test-solution-dmn');
  const filePath = path.join(fixtureDir, filename);
  const fileUri = `file://${filePath}`;

  await studioAgent.jumpToFileInSolution(filename, 'dmn');
  await studioAgent.waitForInteractiveDmnDocument();

  return fileUri;
}

describe('plugin/dmn-modeling', { timeout: 120_000 }, () => {
  describe('permission gating — dmn.modelling required for modeling.*', () => {
    let studioAgent: StudioAgentDmnExtension;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-modeling-perm',
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

    it('denies modeling.updateProperties to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingUpdateProperties');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.removeElement to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingRemoveElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.createElement to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingCreateElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.appendElement to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingAppendElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.createConnection to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingCreateConnection');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('denies modeling.moveElement to plugin without dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingMoveElement');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('denied') || result.toLowerCase().includes('permission'),
        `Expected permission denial, got: ${result}`,
      );
    });

    it('permission error message mentions dmn.modelling', async () => {
      const result = await executePluginCommand(studioAgent, 'plugin.dmn-perm-low.tryModelingUpdateProperties');
      assert.ok(typeof result === 'string', 'Expected string error message');
      assert.ok(
        result.toLowerCase().includes('modelling') || result.toLowerCase().includes('dmn.modelling'),
        `Expected error to mention 'dmn.modelling', got: ${result}`,
      );
    });
  });

  describe('modeling operations', () => {
    let studioAgent: StudioAgentDmnExtension;
    let dmnUri: string;

    beforeAll(async () => {
      process.env.BFR_PLUGINS_DIR = PLUGINS_FIXTURE_DIR;
      process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
      studioAgent = await createAndStartStudioAgentDmnExtension({
        testName: 'dmn-modeling-ops',
        testFile: __filename,
      });
      // dmn-palette-demo activates lazily via `onDocumentType:dmn` — it only starts
      // activating once a DMN document is opened, so the status wait must come after.
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
      dmnUri = await openDmnFileAndGetUri(studioAgent, 'simple-decision.dmn');
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

    it('updateProperties changes element name', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.updateProperties',
        dmnUri,
        'Decision_Discount',
        { name: 'Updated by Plugin' },
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const detail = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        'Decision_Discount',
      );
      assert.ok(detail != null && typeof detail === 'object', 'Expected element detail object');
      assert.strictEqual(detail.name, 'Updated by Plugin');
    });

    it('updateProperties rejects blocked properties ($type, $parent, di)', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.updateProperties',
        dmnUri,
        'Decision_Discount',
        { $type: 'dmn:BusinessKnowledgeModel' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error for $type, got: ${result}`);
    });

    it('updateProperties returns error for non-existent element', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.updateProperties',
        dmnUri,
        'NonExistent_xyz_123',
        { name: 'fail' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
      assert.ok(result.includes('not found'), `Expected 'not found' in error, got: ${result}`);
    });

    it('createElement places a new element at an absolute position', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.createElement',
        dmnUri,
        {
          type: 'dmn:InputData',
          name: 'Created By Plugin',
          position: { x: 400, y: 400 },
        },
      );
      assert.ok(result != null && typeof result === 'object', `Expected object result, got: ${typeof result}`);
      assert.ok('elementId' in result, 'Result should have elementId');

      const detail = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        result.elementId,
      );
      assert.ok(detail != null, 'Created element should be retrievable');
      assert.strictEqual(detail.type, 'dmn:InputData');
      assert.strictEqual(detail.name, 'Created By Plugin');
    });

    it('appendElement creates a new element connected to the source', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.appendElement',
        dmnUri,
        'InputData_Age',
        { type: 'dmn:Decision', name: 'Appended Decision' },
      );
      assert.ok(result != null && typeof result === 'object', `Expected object result, got: ${typeof result}`);
      assert.ok('elementId' in result, 'Result should have elementId');
      assert.ok(typeof result.elementId === 'string' && result.elementId.length > 0, 'elementId should be a string');

      const detail = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        result.elementId,
      );
      assert.ok(detail != null, 'Appended element should be retrievable');
      assert.strictEqual(detail.type, 'dmn:Decision');
    });

    it('appendElement returns error for non-existent source', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.appendElement',
        dmnUri,
        'NonExistent_source_999',
        { type: 'dmn:Decision' },
      );
      assert.ok(
        typeof result === 'string' && result.startsWith('error:'),
        `Expected error, got: ${JSON.stringify(result)}`,
      );
    });

    it('moveElement changes element position', async () => {
      const before = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        'InputData_Age',
      );
      assert.ok(before != null, 'Expected InputData_Age to exist');

      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.moveElement',
        dmnUri,
        'InputData_Age',
        { x: 30, y: -20 },
      );
      assert.strictEqual(result, 'ok', `Expected 'ok', got: ${result}`);

      const after = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        'InputData_Age',
      );
      assert.ok(after != null, 'Expected element to still exist');
    });

    it('moveElement returns error for non-finite delta', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.moveElement',
        dmnUri,
        'InputData_Age',
        { x: Infinity, y: 0 },
      );
      assert.ok(
        typeof result === 'string' && result.startsWith('error:'),
        `Expected error for non-finite delta, got: ${result}`,
      );
    });

    it('removeElement removes the element from the DRD', async () => {
      const createResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.createElement',
        dmnUri,
        { type: 'dmn:InputData', name: 'To Be Deleted', position: { x: 500, y: 500 } },
      );
      assert.ok(createResult != null && 'elementId' in createResult);
      const toDeleteId = createResult.elementId;

      const removeResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.removeElement',
        dmnUri,
        toDeleteId,
      );
      assert.strictEqual(removeResult, 'ok', `Expected 'ok', got: ${removeResult}`);

      const detail = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.getElement',
        dmnUri,
        toDeleteId,
      );
      assert.strictEqual(detail, null, 'Element should no longer exist after removal');
    });

    it('createConnection links two existing elements', async () => {
      const inputResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.createElement',
        dmnUri,
        { type: 'dmn:InputData', name: 'Connection Source', position: { x: 600, y: 200 } },
      );
      assert.ok(inputResult != null && 'elementId' in inputResult);

      const decisionResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.createElement',
        dmnUri,
        { type: 'dmn:Decision', name: 'Connection Target', position: { x: 600, y: 320 } },
      );
      assert.ok(decisionResult != null && 'elementId' in decisionResult);

      const connectionResult = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.createConnection',
        dmnUri,
        inputResult.elementId,
        decisionResult.elementId,
      );
      assert.ok(
        connectionResult != null && typeof connectionResult === 'object' && 'connectionId' in connectionResult,
        `Expected object result with connectionId, got: ${JSON.stringify(connectionResult)}`,
      );
    });

    it('operations on non-DMN URI returns error', async () => {
      const result = await executePluginCommand(
        studioAgent,
        'plugin.dmn-palette-demo.test.modeling.updateProperties',
        'file:///nonexistent.dmn',
        'Decision_1',
        { name: 'fail' },
      );
      assert.ok(typeof result === 'string' && result.startsWith('error:'), `Expected error, got: ${result}`);
    });
  });
});
