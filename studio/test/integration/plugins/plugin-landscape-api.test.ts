import type { LandscapeElement } from '#modules/bpmn-landscape/LandscapeMapFile';
import { createEmptyLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import {
  ASSERT_VISIBLE_TIMEOUT,
  type StudioAgent,
  createAndStartStudioAgentForPluginHost,
  stopPluginHostStudioAgent,
} from '../../StudioAgent';
import type { LandscapeWorkspace } from '../bpmn-landscape/landscapeWorkspace';
import { createLandscapeWorkspace } from '../bpmn-landscape/landscapeWorkspace';

const PLUGINS_FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/plugins');
const CANVAS = '[data-test--landscape-canvas]';
const KITCHEN_SINK = 'landscape-kitchen-sink';
const CALL_LINE = 'relation:callActivity:order:payment';

type CallResult = { success: boolean; result?: any; error?: string };

const box = (id: string, x: number, y: number) => ({
  id,
  parentId: null,
  x,
  y,
  width: 120,
  height: 50,
  style: null,
});

const processShape = (id: string, processId: string, x: number, y: number): LandscapeElement => ({
  ...box(id, x, y),
  type: 'process',
  processId,
  fileHint: `../${processId}.bpmn`,
  label: null,
  shape: 'box',
});

/**
 * One Studio instance serves the whole file: the plugins load once at startup (`onStartup`), the map is opened once,
 * and the tests that change the map clean up after themselves or use ids of their own.
 */
describe('plugin/landscape-api', () => {
  let studioAgent: StudioAgent;
  let landscapeWorkspace: LandscapeWorkspace;
  let mapUri: string;

  const call = async (plugin: string, method: string, ...args: unknown[]): Promise<CallResult> =>
    (await studioAgent.executeCommand(`plugin.${plugin}.call`, [method, args])) as CallResult;

  /** Calls `method` on the kitchen-sink plugin and fails the test when the call fails. */
  const callOk = async (method: string, ...args: unknown[]): Promise<any> => {
    const outcome = await call(KITCHEN_SINK, method, ...args);
    assert.ok(outcome.success, `landscape.${method} failed: ${outcome.error}`);
    return outcome.result;
  };

  const assertDenied = (outcome: CallResult, permission: string): void => {
    assert.strictEqual(outcome.success, false, 'Expected the call to be denied');
    assert.ok(
      outcome.error?.includes('denied') === true && outcome.error.includes(permission),
      `Expected a denial that names '${permission}', got: ${outcome.error}`,
    );
  };

  /** Runs `script` in the renderer with `modeler`, `registry` and `eventBus` of the open map in scope. */
  const onCanvas = async (script: string): Promise<any> =>
    studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri)});
      const modeler = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument).modeler;
      const registry = modeler.get('elementRegistry');
      const eventBus = modeler.get('eventBus');
      ${script}
    `);

  const waitFor = async (condition: () => Promise<boolean>, message: string): Promise<void> =>
    studioAgent.waitUntil(condition, { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: message });

  const overlayTexts = async (): Promise<string[]> =>
    (await studioAgent.executeInRenderer(
      `return [...document.querySelectorAll('.bfw-plugin-overlay')].map((overlay) => overlay.textContent ?? '');`,
    )) as string[];

  const recordedEvents = async (): Promise<any[]> =>
    (await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.events`)) as any[];

  beforeAll(async () => {
    landscapeWorkspace = createLandscapeWorkspace('bfw-landscape-plugin-');
    fs.writeFileSync(
      path.join(landscapeWorkspace.landscapeFolder, 'Plugins.bfwmap'),
      serializeLandscapeMap({
        ...createEmptyLandscapeMap('Plugins'),
        elements: [
          processShape('order', 'order-process', 50, 50),
          processShape('payment', 'payment-process', 350, 50),
          { ...box('note', 50, 250), type: 'note', text: 'Remember' },
          { ...box('archive', 350, 250), type: 'placeholder', label: 'Archive', shape: 'box' },
        ],
      }),
    );
    mapUri = `file://${path.join(landscapeWorkspace.landscapeFolder, 'Plugins.bfwmap')}`;

    studioAgent = await createAndStartStudioAgentForPluginHost(
      { testName: 'landscape-api-setup', testFile: __filename },
      {
        pluginsDirectory: PLUGINS_FIXTURE_DIR,
        waitUntilLoaded: [KITCHEN_SINK, 'landscape-no-perm', 'landscape-read-only'],
      },
    );
    await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    await studioAgent.openUriAsDocument(mapUri);
    await studioAgent.assertVisible(CANVAS, ASSERT_VISIBLE_TIMEOUT);
    await waitFor(
      async () => ((await onCanvas(`return registry.get(${JSON.stringify(CALL_LINE)}) != null;`)) as boolean) === true,
      'The map did not draw its relation line',
    );
  });

  afterAll(async () => {
    await stopPluginHostStudioAgent(studioAgent, false);
    fs.rmSync(landscapeWorkspace.workspace, { recursive: true, force: true });
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

  describe('permission gating', () => {
    it('denies every query, overlay call and subscription to a plugin without a landscape permission', async () => {
      assertDenied(await call('landscape-no-perm', 'getElements', mapUri), "'landscape'");
      assertDenied(await call('landscape-no-perm', 'getElement', mapUri, 'order'), "'landscape'");
      assertDenied(await call('landscape-no-perm', 'getXml', mapUri), "'landscape'");
      assertDenied(await call('landscape-no-perm', 'setOverlays', mapUri, []), "'landscape'");
      assertDenied(await call('landscape-no-perm', 'onElementSelected', mapUri), "'landscape'");
    });

    it('lets a plugin with only the landscape permission query the map', async () => {
      const outcome = await call('landscape-read-only', 'getElements', mapUri);
      assert.ok(outcome.success, String(outcome.error));
      assert.ok(outcome.result.some((element: any) => element.id === 'order'));
    });

    it('denies modeling and the palette and context pad registration without landscape.modelling', async () => {
      assertDenied(
        await call('landscape-read-only', 'modeling.updateProperties', mapUri, 'note', { text: 'X' }),
        'landscape.modelling',
      );
      assertDenied(await call('landscape-read-only', 'modeling.removeElement', mapUri, 'note'), 'landscape.modelling');
      assertDenied(
        await call('landscape-read-only', 'registerPaletteEntry', {
          id: 'denied',
          icon: 'ph-light ph-flag',
          title: 'Denied',
          command: 'mark',
        }),
        'landscape.modelling',
      );
      assertDenied(
        await call('landscape-read-only', 'registerContextPadEntry', {
          id: 'denied',
          icon: 'ph-light ph-flag',
          title: 'Denied',
          command: 'mark',
        }),
        'landscape.modelling',
      );
      const note = await callOk('getElement', mapUri, 'note');
      assert.strictEqual(note.text, 'Remember', 'A denied call must not change the map');
    });

    it('denies the renderer module channel without landscape.renderer', async () => {
      assertDenied(await call('landscape-read-only', 'postToRendererModule', { type: 'ring' }), 'landscape.renderer');
    });

    it('does not apply a manifest palette or module of a plugin that lacks the permission', async () => {
      // landscape-read-only declares no contributions, landscape-no-perm neither: only the kitchen sink adds entries.
      // Scoped to this map: other editors keep their own palettes in the document.
      const entries = (await onCanvas(
        `return [...modeler.get('canvas').getContainer().querySelectorAll('.djs-palette [data-action^="plugin."]')].map((entry) => entry.getAttribute('data-action'));`,
      )) as string[];
      assert.deepStrictEqual(entries, [`plugin.${KITCHEN_SINK}.ks-mark`]);
    });
  });

  describe('queries', () => {
    it('getElements lists the shapes, the connectors and the relation lines of the map', async () => {
      const elements = await callOk('getElements', mapUri);
      const byId = new Map<string, any>(elements.map((element: any) => [element.id, element]));

      const order = byId.get('order');
      assert.strictEqual(order.type, 'process');
      assert.strictEqual(order.processId, 'order-process');
      assert.strictEqual(order.parentId, null);
      for (const key of ['x', 'y', 'width', 'height']) {
        assert.ok(Number.isFinite(order[key]), `${key} must be a number`);
      }
      assert.strictEqual(byId.get('archive').type, 'placeholder');
      assert.strictEqual(byId.get('note').type, 'note');

      const relation = byId.get(CALL_LINE);
      assert.strictEqual(relation.type, 'relation');
      assert.strictEqual(relation.kind, 'callActivity');
      assert.strictEqual(relation.sourceElementId, 'order');
      assert.strictEqual(relation.targetElementId, 'payment');
    });

    it('getElement returns one element and null for an unknown id', async () => {
      const note = await callOk('getElement', mapUri, 'note');
      assert.strictEqual(note.text, 'Remember');
      assert.strictEqual(await callOk('getElement', mapUri, 'does-not-exist'), null);
    });

    it('getXml returns the map file text', async () => {
      const xml = await callOk('getXml', mapUri);
      assert.ok(typeof xml === 'string' && xml.includes('order-process'), 'Expected the map text with its processes');
    });

    it('refuses a map that is not open', async () => {
      const outcome = await call(KITCHEN_SINK, 'getElements', 'file:///not-open.bfwmap');
      assert.strictEqual(outcome.success, false);
      assert.ok(outcome.error?.includes('not-open.bfwmap'), `The error must name the URI, got: ${outcome.error}`);
    });
  });

  describe('events', () => {
    it('reports selection, hover, double click, context menu and overlay context changes', async () => {
      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.subscribe`, [mapUri]);
      await waitFor(
        async () => (await recordedEvents()).some((event) => event.kind === 'overlayContext'),
        'The overlay context subscription never reported the open map',
      );
      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.clearEvents`);

      await onCanvas(`
        const order = registry.get('order');
        modeler.get('selection').select(order);
        eventBus.fire('element.hover', { element: order, gfx: registry.getGraphics(order) });
        eventBus.fire('element.dblclick', { element: order, gfx: registry.getGraphics(order) });
        eventBus.fire('element.contextmenu', { element: order, gfx: registry.getGraphics(order) });
        return true;
      `);

      await waitFor(async () => {
        const kinds = new Set((await recordedEvents()).map((event) => event.kind));
        return ['selected', 'hover', 'doubleClick', 'contextMenu', 'overlayContext'].every((kind) => kinds.has(kind));
      }, 'Not every landscape event reached the plugin');

      const events = await recordedEvents();
      for (const kind of ['selected', 'hover', 'doubleClick', 'contextMenu']) {
        const event = events.find((candidate) => candidate.kind === kind);
        assert.strictEqual(event.elementId, 'order', `${kind} names the element`);
        assert.strictEqual(event.elementType, 'process', `${kind} names the element type`);
      }
      assert.ok(events.some((event) => event.kind === 'overlayContext' && event.reason === 'selection-changed'));

      await onCanvas(`modeler.get('selection').select([]); return true;`);
      await waitFor(
        async () => (await recordedEvents()).some((event) => event.kind === 'selected' && event.elementId === ''),
        'Clearing the selection was not reported',
      );
    });

    it('refuses to subscribe to a map that is not open', async () => {
      const outcome = await call(KITCHEN_SINK, 'onElementSelected', 'file:///not-open.bfwmap');
      assert.strictEqual(outcome.success, false);
      assert.ok(outcome.error?.includes('no landscape map open'), String(outcome.error));
    });
  });

  describe('overlays', () => {
    it('setOverlays draws the overlays and clearOverlays removes them again', async () => {
      await callOk('setOverlays', mapUri, [
        { elementId: 'order', position: 'top-left', type: 'badge', text: 'DIRECT', style: 'warning' },
        { elementId: 'payment', position: 'bottom-left', type: 'icon', icon: 'ph-light ph-info', tooltip: 'Info' },
      ]);
      await waitFor(async () => (await overlayTexts()).includes('DIRECT'), 'The direct overlay was not drawn');
      assert.strictEqual((await overlayTexts()).length, 2);

      await callOk('clearOverlays', mapUri, { elementId: 'order' });
      await waitFor(async () => !(await overlayTexts()).includes('DIRECT'), 'The overlay was not cleared');
      assert.strictEqual((await overlayTexts()).length, 1, 'Only the overlay of the other element is left');

      await callOk('clearOverlays', mapUri);
      await waitFor(async () => (await overlayTexts()).length === 0, 'clearOverlays without a filter keeps overlays');
    });

    it('direct overlays survive a command on the map', async () => {
      await callOk('setOverlays', mapUri, [
        { elementId: 'archive', position: 'top-right', type: 'badge', text: 'KEEP', style: 'info' },
      ]);
      await waitFor(async () => (await overlayTexts()).includes('KEEP'), 'The overlay was not drawn');

      await callOk('modeling.updateProperties', mapUri, 'archive', { label: 'Archive 2' });
      await waitFor(async () => (await overlayTexts()).includes('KEEP'), 'The overlay was lost after a map change');
      await callOk('modeling.updateProperties', mapUri, 'archive', { label: 'Archive' });
      await callOk('clearOverlays', mapUri);
    });

    it('rejects an overlay list that is not an array', async () => {
      const outcome = await call(KITCHEN_SINK, 'setOverlays', mapUri, { not: 'an array' });
      assert.strictEqual(outcome.success, false);
      assert.ok(outcome.error?.includes('must be an array'), String(outcome.error));
    });

    it('an overlay factory sees the plane on screen and decorates every process; disposing it removes the badges', async () => {
      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.registerFactory`);
      await waitFor(
        async () => (await overlayTexts()).filter((text) => text === 'KS').length === 2,
        'The factory did not badge both processes',
      );

      const calls = (await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.factoryCalls`)) as any[];
      const latest = calls[calls.length - 1];
      assert.strictEqual(latest.uri, mapUri);
      assert.ok(latest.elementIds.includes('order') && latest.elementIds.includes('archive'));
      assert.ok(latest.relationCount >= 1, 'The factory sees the relation lines drawn on the plane');

      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.disposeFactory`);
      await waitFor(async () => !(await overlayTexts()).includes('KS'), 'The badges stayed after the factory ended');
    });
  });

  describe('modeling', () => {
    it('updateProperties changes a note and is undoable through the map command stack', async () => {
      await callOk('modeling.updateProperties', mapUri, 'note', { text: 'Changed by plugin' });
      assert.strictEqual((await callOk('getElement', mapUri, 'note')).text, 'Changed by plugin');

      await onCanvas(`modeler.get('commandStack').undo(); return true;`);
      assert.strictEqual((await callOk('getElement', mapUri, 'note')).text, 'Remember');
    });

    it('updateProperties refuses properties that do not belong to the element type', async () => {
      const outcome = await call(KITCHEN_SINK, 'modeling.updateProperties', mapUri, 'note', { processId: 'x' });
      assert.strictEqual(outcome.success, false);
      assert.ok(outcome.error?.includes("'processId' cannot be set on the note"), String(outcome.error));

      const colour = await call(KITCHEN_SINK, 'modeling.updateProperties', mapUri, 'note', {
        style: { fill: 'url(javascript:alert(1))', stroke: null },
      });
      assert.strictEqual(colour.success, false, 'A colour must be a plain colour value');
    });

    it('createElement, appendElement and createConnection build a connected pair; removeElement takes them away', async () => {
      const created = await callOk('modeling.createElement', mapUri, {
        type: 'placeholder',
        label: 'Plugin made',
        position: { x: 600, y: 400 },
      });
      const appended = await callOk('modeling.appendElement', mapUri, created.elementId, {
        type: 'note',
        text: 'Appended',
        position: { x: 0, y: 0 },
      });
      const elements = await callOk('getElements', mapUri);
      const connector = elements.find(
        (element: any) =>
          element.type === 'connector' &&
          element.sourceId === created.elementId &&
          element.targetId === appended.elementId,
      );
      assert.ok(connector, 'appendElement connects the new element to its source');

      const explicit = await callOk('modeling.createConnection', mapUri, 'archive', created.elementId);
      assert.ok(typeof explicit.connectionId === 'string' && explicit.connectionId.length > 0);

      await callOk('modeling.removeElement', mapUri, created.elementId);
      await callOk('modeling.removeElement', mapUri, appended.elementId);
      const remaining = await callOk('getElements', mapUri);
      assert.ok(!remaining.some((element: any) => element.id === created.elementId));
      assert.ok(
        !remaining.some((element: any) => element.type === 'connector' && element.targetId === created.elementId),
        'Removing an element removes the connectors that end on it',
      );
    });

    it('moveElement moves a shape by a delta and refuses a relation line', async () => {
      const before = await callOk('getElement', mapUri, 'archive');
      await callOk('modeling.moveElement', mapUri, 'archive', { x: 40, y: 20 });
      const after = await callOk('getElement', mapUri, 'archive');
      assert.strictEqual(after.x, before.x + 40);
      assert.strictEqual(after.y, before.y + 20);
      await callOk('modeling.moveElement', mapUri, 'archive', { x: -40, y: -20 });

      const line = await call(KITCHEN_SINK, 'modeling.moveElement', mapUri, CALL_LINE, { x: 5, y: 5 });
      assert.strictEqual(line.success, false);
      assert.ok(line.error?.includes('is a line and cannot be moved'), String(line.error));

      const notFinite = await call(KITCHEN_SINK, 'modeling.moveElement', mapUri, 'archive', { x: Number.NaN, y: 0 });
      assert.strictEqual(notFinite.success, false);
    });

    it('refuses to create a process that the map already shows, and a relation line to remove', async () => {
      const duplicate = await call(KITCHEN_SINK, 'modeling.createElement', mapUri, {
        type: 'process',
        processId: 'order-process',
        position: { x: 700, y: 50 },
      });
      assert.strictEqual(duplicate.success, false);
      assert.ok(duplicate.error?.includes("already shows the process 'order-process'"), String(duplicate.error));

      const relation = await call(KITCHEN_SINK, 'modeling.removeElement', mapUri, CALL_LINE);
      assert.strictEqual(relation.success, false);
    });

    it('reports the change to an overlay context subscription as data-updated', async () => {
      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.subscribe`, [mapUri]);
      await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.clearEvents`);
      await callOk('modeling.updateProperties', mapUri, 'archive', { label: 'Archive 3' });
      await waitFor(
        async () =>
          (await recordedEvents()).some((event) => event.kind === 'overlayContext' && event.reason === 'data-updated'),
        'A map change was not reported as data-updated',
      );
      await callOk('modeling.updateProperties', mapUri, 'archive', { label: 'Archive' });
    });
  });

  describe('palette and context pad', () => {
    const PALETTE_ENTRY = `.djs-palette [data-action="plugin.${KITCHEN_SINK}.ks-mark"]`;
    const PAD_ENTRY = `.djs-context-pad [data-action="plugin.${KITCHEN_SINK}.ks-mark-process"]`;

    const invocations = async (): Promise<any[][]> =>
      (await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.markInvocations`)) as any[][];

    const openContextPad = async (elementId: string): Promise<void> => {
      await onCanvas(`
        const element = registry.get(${JSON.stringify(elementId)});
        modeler.get('selection').select(element);
        modeler.get('contextPad').open(element, true);
        return true;
      `);
    };

    const padActions = async (): Promise<string[]> =>
      (await onCanvas(
        `return [...modeler.get('canvas').getContainer().querySelectorAll('.djs-context-pad [data-action^="plugin."]')].map((entry) => entry.getAttribute('data-action'));`,
      )) as string[];

    it('the manifest palette entry is shown and runs the plugin command when clicked', async () => {
      await studioAgent.assertVisible(PALETTE_ENTRY, ASSERT_VISIBLE_TIMEOUT);
      const before = (await invocations()).length;

      await studioAgent.clickOn(PALETTE_ENTRY);

      await waitFor(async () => (await invocations()).length === before + 1, 'The palette command did not run');
    });

    it('the manifest context pad entry is offered on a process and not on a note', async () => {
      await openContextPad('order');
      await waitFor(async () => (await padActions()).includes(`plugin.${KITCHEN_SINK}.ks-mark-process`), 'Missing');

      await openContextPad('note');
      await waitFor(async () => (await padActions()).length === 0, 'The entry for processes must not show on a note');
    });

    it('clicking the context pad entry runs the command with the element id and type', async () => {
      await openContextPad('payment');
      await studioAgent.assertVisible(PAD_ENTRY, ASSERT_VISIBLE_TIMEOUT);
      const before = (await invocations()).length;

      await studioAgent.clickOn(PAD_ENTRY);

      await waitFor(async () => (await invocations()).length === before + 1, 'The context pad command did not run');
      const latest = (await invocations()).at(-1)!;
      assert.deepStrictEqual(latest[0], { elementId: 'payment', elementType: 'process' });
    });

    it('registers, filters by element id, updates and removes a runtime context pad entry', async () => {
      await callOk('registerContextPadEntry', {
        id: 'dynamic',
        icon: 'ph-light ph-star',
        title: 'Dynamic',
        command: 'mark',
        elementTypes: ['note', 'placeholder'],
      });
      const dynamicAction = `plugin.${KITCHEN_SINK}.dynamic`;

      await openContextPad('archive');
      await waitFor(async () => (await padActions()).includes(dynamicAction), 'The runtime entry is missing');

      await callOk('updateContextPadEntry', 'dynamic', { elementIds: ['note'] });
      await openContextPad('archive');
      await waitFor(async () => !(await padActions()).includes(dynamicAction), 'The allowlist must hide the entry');
      await openContextPad('note');
      await waitFor(async () => (await padActions()).includes(dynamicAction), 'The allowlist must show the entry');

      await callOk('unregisterContextPadEntry', 'dynamic');
      await openContextPad('note');
      await waitFor(async () => !(await padActions()).includes(dynamicAction), 'The entry was not removed');

      const missing = await call(KITCHEN_SINK, 'unregisterContextPadEntry', 'dynamic');
      assert.strictEqual(missing.success, false, 'Removing an unknown entry is reported');
    });

    it('registers and removes a runtime palette entry', async () => {
      await callOk('registerPaletteEntry', {
        id: 'dynamic-palette',
        icon: 'ph-light ph-star',
        title: 'Dynamic palette',
        command: 'mark',
      });
      await studioAgent.assertVisible(
        `.djs-palette [data-action="plugin.${KITCHEN_SINK}.dynamic-palette"]`,
        ASSERT_VISIBLE_TIMEOUT,
      );

      await callOk('unregisterPaletteEntry', 'dynamic-palette');
      await studioAgent.waitForNotVisible(`.djs-palette [data-action="plugin.${KITCHEN_SINK}.dynamic-palette"]`);
    });
  });

  describe('renderer module', () => {
    const rendererMessages = async (): Promise<any[]> =>
      (await studioAgent.executeCommand(`plugin.${KITCHEN_SINK}.rendererMessages`)) as any[];

    const hasMarker = async (elementId: string): Promise<boolean> =>
      (await onCanvas(`return modeler.get('canvas').hasMarker(${JSON.stringify(elementId)}, 'ks-ring');`)) as boolean;

    it('the plugin module receives a message, marks the elements and answers over the channel', async () => {
      await callOk('postToRendererModule', { type: 'ring', elementIds: ['order', 'payment'] });

      await waitFor(
        async () => (await rendererMessages()).some((message) => message.type === 'ringResult' && message.count === 2),
        'The renderer module did not answer',
      );
      assert.ok(await hasMarker('order'));
      assert.ok(await hasMarker('payment'));
      assert.ok(!(await hasMarker('note')));

      await callOk('postToRendererModule', { type: 'clear' });
      await waitFor(async () => !(await hasMarker('order')), 'The markers were not cleared');
    });
  });
});
