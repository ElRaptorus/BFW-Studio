import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Key } from 'webdriverio';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { LandscapeWorkspace } from './landscapeWorkspace';
import { createLandscapeWorkspace } from './landscapeWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const DOCUMENT_TYPE = 'bpmn-landscape-map';
const CANVAS = '[data-test--landscape-canvas]';
const SAVE = OsSpecificKeystroke('cmd-s', 'ctrl-s');
const CALL_LINE = 'relation:callActivity:order:payment';
const MESSAGE_LINE = 'relation:message:sender:receiver';
const CALL_KEY = 'callActivity:order-process:payment-process';
const PROPERTIES_PANE = 'discover/landscapes/properties';

const messageBpmn = (processId: string, eventXml: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bfw="https://bifrostforge.world/schema/bpmn" id="Definitions_${processId}" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:message id="Message_shipped" name="OrderShipped" />
  <bpmn:process id="${processId}" name="${processId}" isExecutable="true">
    ${eventXml}
  </bpmn:process>
</bpmn:definitions>
`;

const box = (id: string, x: number, y: number) => ({ id, parentId: null, x, y, width: 120, height: 50, style: null });
const processShape = (id: string, processId: string, x: number, y: number): LandscapeElement => ({
  ...box(id, x, y),
  type: 'process',
  processId,
  fileHint: `../${processId}.bpmn`,
  label: null,
  shape: 'box',
});

describe('bpmn-landscape/landscape-relations', () => {
  let studioAgent: StudioAgent;
  let workspace: string;
  let landscapeWorkspace: LandscapeWorkspace;

  const mapPath = (fileName: string): string => path.join(landscapeWorkspace.landscapeFolder, fileName);
  const mapUri = (): string => `file://${mapPath('Relations.bfwmap')}`;
  const readMap = async (): Promise<LandscapeMap> => {
    const result = await parseLandscapeMap(fs.readFileSync(mapPath('Relations.bfwmap'), 'utf8'));
    if (!result.ok) {
      throw new Error(`Relations.bfwmap cannot be read: ${result.errors.join(' ')}`);
    }
    return result.map;
  };

  const waitForFile = async (condition: (map: LandscapeMap) => boolean): Promise<LandscapeMap> => {
    let map = await readMap();
    await studioAgent.waitUntil(
      async () => {
        map = await readMap();
        return condition(map);
      },
      { timeout: TIMEOUT, timeoutMsg: 'Relations.bfwmap was not saved as expected' },
    );
    return map;
  };

  /** Runs `script` in the renderer with `modeler`, `modeling`, `registry` and `commandStack` of the open map in scope. */
  const onCanvas = async (script: string): Promise<unknown> =>
    studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri())});
      const modeler = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument).modeler;
      const modeling = modeler.get('modeling');
      const registry = modeler.get('elementRegistry');
      const commandStack = modeler.get('commandStack');
      ${script}
    `);

  const relationIds = async (): Promise<string[]> =>
    (await onCanvas(
      `return registry.filter((element) => element.type === 'relation').map((element) => element.id).sort();`,
    )) as string[];

  const waitForRelations = async (expected: string[]): Promise<void> => {
    await studioAgent.waitUntil(async () => JSON.stringify(await relationIds()) === JSON.stringify(expected), {
      timeout: TIMEOUT,
      timeoutMsg: `Expected the relation lines ${expected.join(', ') || '(none)'}`,
    });
  };

  const openMap = async (): Promise<void> => {
    await studioAgent.openUriAsDocument(mapUri());
    await studioAgent.navigation.assertActivePage('discover/landscapes');
    await studioAgent.assertVisible(CANVAS, TIMEOUT);
    await waitForRelations([CALL_LINE, MESSAGE_LINE]);
  };

  const element = (id: string): string => `${CANVAS} [data-element-id="${id}"]`;

  const waitForLabel = async (id: string, expected: string): Promise<void> => {
    const labelText = async (): Promise<unknown> =>
      onCanvas(`return registry.getGraphics(${JSON.stringify(id)})?.querySelector('.landscape-label')?.textContent;`);
    await studioAgent.waitUntil(async () => (await labelText()) === expected, {
      timeout: TIMEOUT,
      timeoutMsg: `Expected the label '${expected}' on ${id}, got '${String(await labelText())}'`,
    });
  };

  const save = async (): Promise<void> => {
    await studioAgent.sendKeyboardInput([SAVE], false);
  };

  const centerOf = async (selector: string): Promise<{ x: number; y: number }> => {
    const target = await studioAgent.getTestDriver().client!.$(selector);
    const location = await target.getLocation();
    const size = await target.getSize();
    return { x: Math.round(location.x + size.width / 2), y: Math.round(location.y + size.height / 2) };
  };

  const pointerActions = async (actions: object[]): Promise<void> => {
    await studioAgent.getTestDriver().client!.performActions([{ type: 'pointer', id: 'landscapePointer', actions }]);
    await studioAgent.getTestDriver().client!.releaseActions();
  };

  beforeEach(async ({ task }) => {
    landscapeWorkspace = createLandscapeWorkspace('bfw-landscape-relations-');
    workspace = landscapeWorkspace.workspace;
    fs.writeFileSync(
      path.join(workspace, 'shipping-sender.bpmn'),
      messageBpmn(
        'shipping-sender',
        '<bpmn:intermediateThrowEvent id="Throw_shipped"><bpmn:messageEventDefinition messageRef="Message_shipped" /></bpmn:intermediateThrowEvent>',
      ),
    );
    fs.writeFileSync(
      path.join(workspace, 'shipping-receiver.bpmn'),
      messageBpmn(
        'shipping-receiver',
        '<bpmn:intermediateCatchEvent id="Catch_shipped"><bpmn:messageEventDefinition messageRef="Message_shipped" /></bpmn:intermediateCatchEvent>',
      ),
    );
    fs.writeFileSync(
      mapPath('Relations.bfwmap'),
      serializeLandscapeMap({
        ...createEmptyLandscapeMap('Relations'),
        elements: [
          processShape('order', 'order-process', 50, 50),
          processShape('payment', 'payment-process', 350, 50),
          processShape('sender', 'shipping-sender', 50, 200),
          processShape('receiver', 'shipping-receiver', 350, 200),
          { ...box('note', 50, 350), type: 'note', text: 'Remember' },
          { ...box('archive', 350, 350), type: 'placeholder', label: 'Archive', shape: 'box' },
        ],
      }),
    );

    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('draws the call and message relations, labels the message, and does not save them', async () => {
    await openMap();

    await waitForLabel(MESSAGE_LINE, 'OrderShipped');
    await studioAgent.clickOn(element('note'));
    await studioAgent.sendKeyboardInput([Key.ArrowRight], false);
    await save();

    const saved = await waitForFile((map) => (map.elements.find((entry) => entry.id === 'note')?.x ?? 50) > 50);
    expect(saved.connectors).toEqual([]);
    expect(fs.readFileSync(mapPath('Relations.bfwmap'), 'utf8')).not.toContain('relation:');
  });

  it('hides a relation from the context pad with undo and redo, and saves it as hidden', async () => {
    await openMap();

    await studioAgent.clickOn(element(CALL_LINE));
    await studioAgent.clickOn('.djs-context-pad .entry[data-action="hide"]');
    await waitForRelations([MESSAGE_LINE]);

    await studioAgent.executeCommand('std.editor.undoInFocusedEditorDocument');
    await waitForRelations([CALL_LINE, MESSAGE_LINE]);
    await studioAgent.executeCommand('std.editor.redoInFocusedEditorDocument');
    await waitForRelations([MESSAGE_LINE]);

    await studioAgent.clickOn(CANVAS);
    await save();
    const saved = await waitForFile((map) => map.hiddenRelations.length > 0);
    expect(saved.hiddenRelations).toEqual([CALL_KEY]);
  });

  it('switches the call layer off in the properties pane and saves the layers', async () => {
    await openMap();
    await studioAgent.assertPaneVisible(PROPERTIES_PANE);

    await studioAgent.clickOn('[data-test--landscape-switch="landscape-layer-callActivity"]');
    await waitForRelations([MESSAGE_LINE]);

    await studioAgent.clickOn(CANVAS);
    await save();
    const saved = await waitForFile((map) => !map.relationLayers.callActivity);
    expect(saved.relationLayers).toEqual({ callActivity: false, message: true, signal: true });
  });

  it('deleting a process removes its lines, and undo brings them back', async () => {
    await openMap();

    const steps = await onCanvas(`
      const lines = () => registry.filter((element) => element.type === 'relation').map((element) => element.id);
      modeling.removeElements([registry.get('payment')]);
      const deleted = lines();
      commandStack.undo();
      return { deleted, undone: lines().sort() };
    `);

    expect(steps).toEqual({ deleted: [MESSAGE_LINE], undone: [CALL_LINE, MESSAGE_LINE] });
  });

  it('moving a selection that contains a relation line moves the shapes', async () => {
    await openMap();
    await onCanvas(`
      modeler.get('selection').select(['order', 'payment', ${JSON.stringify(CALL_LINE)}].map((id) => registry.get(id)));
    `);
    const start = await centerOf(element('order'));

    await pointerActions([
      { type: 'pointerMove', duration: 0, x: start.x, y: start.y },
      { type: 'pointerDown', button: 0 },
      { type: 'pointerMove', duration: 200, x: start.x + 20, y: start.y + 100 },
      { type: 'pointerMove', duration: 200, x: start.x + 40, y: start.y + 200 },
      { type: 'pointerUp', button: 0 },
    ]);

    await studioAgent.waitUntil(async () => ((await onCanvas(`return registry.get('order').y;`)) as number) > 150, {
      timeout: TIMEOUT,
      timeoutMsg: 'The order process was not moved',
    });
    expect(await onCanvas(`return registry.get('payment').y - registry.get('order').y;`)).toBe(0);
    await waitForRelations([CALL_LINE, MESSAGE_LINE]);
    await studioAgent.assertNoErrorsPresent();
  });

  it('draws a connector through the context pad, labels it by double-click, and keeps it after reopening', async () => {
    await openMap();

    await studioAgent.clickOn(element('note'));
    await studioAgent.clickOn('.djs-context-pad .entry[data-action="connect"]');
    const target = await centerOf(element('archive'));
    await pointerActions([
      { type: 'pointerMove', duration: 200, x: target.x, y: target.y },
      { type: 'pointerDown', button: 0 },
      { type: 'pointerUp', button: 0 },
    ]);
    await studioAgent.assertVisible(`${CANVAS} .landscape-connector`, TIMEOUT);

    const connectorId = (await onCanvas(
      `return registry.filter((element) => element.type === 'connector')[0].id;`,
    )) as string;
    await studioAgent.doubleClickOn(element(connectorId));
    await studioAgent.assertVisible('.djs-direct-editing-parent', TIMEOUT);
    await studioAgent.sendKeyboardInput([...'Files'.split('')]);
    await studioAgent.clickOn(element('order'));
    await waitForLabel(connectorId, 'Files');

    await save();
    const saved = await waitForFile((map) => map.connectors.length === 1);
    expect(saved.connectors[0]).toMatchObject({ sourceId: 'note', targetId: 'archive', label: 'Files' });

    await studioAgent.closeOpenEditors(DOCUMENT_TYPE);
    await openMap();
    await waitForLabel(connectorId, 'Files');
  });

  it('the properties pane edits label, shape and colour and lists the decision', async () => {
    await openMap();

    await studioAgent.clickOn(element('order'));
    await studioAgent.assertVisible('[data-test--landscape-decision="discount-rules"]', TIMEOUT);
    await studioAgent.assertPaneVisible(PROPERTIES_PANE);
    expect(await studioAgent.getElementCount('.pane-area-right [data-test--pane]')).toBe(1);

    await studioAgent.clearTextInput('[data-test--landscape-property="label"]');
    await studioAgent.sendKeyboardInput([...'Orders'.split(''), 'enter']);
    await waitForLabel('order', 'Orders');

    await studioAgent.clickOn('#landscape-shape-property');
    await studioAgent.clickOn('#landscape-shape-property [data-test-option-value="chevron"]');
    await studioAgent.clickOn('[data-test--landscape-color] .react-select__control');
    await studioAgent.clickOn('[data-test--landscape-color] [data-test-option-value="custom"]');

    await studioAgent.clickOn(CANVAS);
    await save();
    const saved = await waitForFile((map) => map.elements.find((entry) => entry.id === 'order')?.style != null);
    expect(saved.elements.find((entry) => entry.id === 'order')).toMatchObject({
      label: 'Orders',
      shape: 'chevron',
      style: { fill: expect.stringMatching(/^#/), stroke: expect.stringMatching(/^#/) },
    });

    await studioAgent.clickOn(element('order'));
    await studioAgent.clickOn('[data-test--landscape-decision="discount-rules"] button');
    await studioAgent.waitUntil(
      async () => (await studioAgent.getFocusedDocumentUri()).endsWith('discount-rules.dmn'),
      {
        timeout: TIMEOUT,
        timeoutMsg: 'The decision did not open',
      },
    );
  });

  it('double-clicking a process opens it in the Designer', async () => {
    await openMap();

    await studioAgent.doubleClickOn(element('order'));

    await studioAgent.waitUntil(
      async () => (await studioAgent.getFocusedDocumentUri()).endsWith('order-process.bpmn'),
      {
        timeout: TIMEOUT,
        timeoutMsg: 'order-process.bpmn did not open',
      },
    );
  });

  it('focus mode, by button and by F, dims what is not related to the selection', async () => {
    await openMap();
    const focusedOrDimmed = async (): Promise<unknown> =>
      onCanvas(`
        const container = modeler.container;
        const focused = (id) => modeler.get('canvas').hasMarker(id, 'landscape-focused');
        return {
          on: container.classList.contains('landscape-map--focus'),
          payment: focused('payment'),
          note: focused('note'),
        };
      `);

    await studioAgent.clickOn(element('order'));
    await studioAgent.clickOn('[data-test--landscape-focus-mode]');
    await studioAgent.waitUntil(async () => ((await focusedOrDimmed()) as { on: boolean }).on, {
      timeout: TIMEOUT,
      timeoutMsg: 'Focus mode did not turn on',
    });
    expect(await focusedOrDimmed()).toEqual({ on: true, payment: true, note: false });

    await studioAgent.clickOn(element('order'));
    await studioAgent.sendKeyboardInput(['f'], false);
    await studioAgent.waitUntil(async () => !((await focusedOrDimmed()) as { on: boolean }).on, {
      timeout: TIMEOUT,
      timeoutMsg: 'F did not turn focus mode off',
    });
  });
});
