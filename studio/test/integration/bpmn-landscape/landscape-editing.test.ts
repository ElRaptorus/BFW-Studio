import type { LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Key } from 'webdriverio';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const DOCUMENT_TYPE = 'bpmn-landscape-map';
const CANVAS = '[data-test--landscape-canvas]';
const SAVE = OsSpecificKeystroke('cmd-s', 'ctrl-s');
const DELETE = process.platform === 'darwin' ? Key.Backspace : Key.Delete;

describe('bpmn-landscape/landscape-editing', () => {
  let studioAgent: StudioAgent;
  let workspace: string;

  const mapPath = (fileName: string): string => path.join(workspace, fileName);
  const writeMap = (fileName: string, content: LandscapeMap | string): void =>
    fs.writeFileSync(mapPath(fileName), typeof content === 'string' ? content : serializeLandscapeMap(content));
  const readMap = async (fileName: string): Promise<LandscapeMap> => {
    const result = await parseLandscapeMap(fs.readFileSync(mapPath(fileName), 'utf8'));
    if (!result.ok) {
      throw new Error(`${fileName} cannot be read: ${result.errors.join(' ')}`);
    }
    return result.map;
  };

  const openMap = async (fileName: string): Promise<void> => {
    await studioAgent.openUriAsDocument(`file://${mapPath(fileName)}`);
    await studioAgent.navigation.assertActivePage('discover/landscapes');
    await studioAgent.assertVisible(CANVAS, TIMEOUT);
  };

  const countOnCanvas = async (className: string): Promise<number> =>
    studioAgent.getElementCount(`${CANVAS} .${className}`);

  const waitForCount = async (className: string, expected: number): Promise<void> => {
    await studioAgent.waitUntil(async () => (await countOnCanvas(className)) === expected, {
      timeout: TIMEOUT,
      timeoutMsg: `Expected ${expected} '${className}' shapes on the map`,
    });
  };

  const waitForFile = async (fileName: string, condition: (map: LandscapeMap) => boolean): Promise<LandscapeMap> => {
    let map = await readMap(fileName);
    await studioAgent.waitUntil(
      async () => {
        map = await readMap(fileName);
        return condition(map);
      },
      { timeout: TIMEOUT, timeoutMsg: `${fileName} was not saved as expected` },
    );
    return map;
  };

  const hasUnsavedChanges = async (fileName: string): Promise<boolean> =>
    (await studioAgent.executeInRenderer(
      `return bifrost.editors.getEditorDocumentByUri(${JSON.stringify(`file://${mapPath(fileName)}`)})?.hasUnsavedChanges ?? null`,
    )) as boolean;

  const addProcess = (processId: string, x: number, y: number): Promise<unknown> =>
    studioAgent.executeCommand('bpmn.landscape.addProcessToMap', [
      { processId, fileUri: `file://${path.join(workspace, `${processId}.bpmn`)}`, x, y },
    ]);

  const centerOf = async (selector: string): Promise<{ x: number; y: number }> => {
    const element = await studioAgent.getTestDriver().client!.$(selector);
    const location = await element.getLocation();
    const size = await element.getSize();
    return { x: Math.round(location.x + size.width / 2), y: Math.round(location.y + size.height / 2) };
  };

  /** Runs `script` in the renderer with `modeler`, `modeling`, `registry` and `root` of the open map in scope. */
  const onCanvas = async (fileName: string, script: string): Promise<unknown> =>
    studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(`file://${mapPath(fileName)}`)});
      const modeler = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument).modeler;
      const modeling = modeler.get('modeling');
      const registry = modeler.get('elementRegistry');
      const root = modeler.get('canvas').getRootElement();
      ${script}
    `);

  /** Drops a new group with its centre on `point`; by default in the upper-left quarter, which is empty canvas. */
  const createGroupFromPalette = async (point?: { x: number; y: number }): Promise<void> => {
    await studioAgent.clickOn('.djs-palette .entry[data-action="create-group"]');
    const canvas = await studioAgent.getTestDriver().client!.$(CANVAS);
    const location = await canvas.getLocation();
    const size = await canvas.getSize();
    // The first attach centres the placeholder, so the upper-left quarter is empty.
    const x = point?.x ?? Math.round(location.x + size.width / 4);
    const y = point?.y ?? Math.round(location.y + size.height / 4);
    await studioAgent.getTestDriver().client!.performActions([
      {
        type: 'pointer',
        id: 'placeGroup',
        actions: [
          { type: 'pointerMove', duration: 0, x: x - 10, y: y - 10 },
          { type: 'pointerMove', duration: 100, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await studioAgent.getTestDriver().client!.releaseActions();
  };

  beforeEach(async ({ task }) => {
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bfw-landscape-')));
    fs.cpSync(path.join(__dirname, '..', '..', 'fixtures', 'test-solution-deploy'), workspace, { recursive: true });
    if (task.name.includes('Explorer')) {
      writeMap('Empty.bfwmap', '');
    }
    writeMap('Test.bfwmap', {
      ...createEmptyLandscapeMap('Test'),
      elements: [
        {
          id: 'placeholder-1',
          type: 'placeholder',
          parentId: null,
          x: 100,
          y: 100,
          width: 140,
          height: 60,
          style: null,
          label: 'Billing',
          shape: 'box',
        },
      ],
    });
    writeMap(
      'Broken.bfwmap',
      '<landscape:map xmlns:landscape="https://bifrostforge.world/schema/landscape" version="1" name="Broken">' +
        '<landscape:group id="group" x="0" y="0" width="400" height="300">' +
        '<landscape:band id="band" x="10" y="10" width="300" height="100" />' +
        '</landscape:group></landscape:map>',
    );

    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openDirectoryAsSolution(workspace);
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

  it('opening an empty map from the Explorer activates the Landscapes page', async () => {
    await studioAgent.jumpToFileInSolution('Empty.bfwmap', DOCUMENT_TYPE);

    await studioAgent.navigation.assertActivePage('discover/landscapes');
    await studioAgent.assertVisible(CANVAS, TIMEOUT);
    await studioAgent.assertVisible('.djs-palette', TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('adding the same process twice gives one shape and the on-map badge', async () => {
    await openMap('Test.bfwmap');

    await addProcess('order-process', 400, 300);
    await addProcess('order-process', 700, 500);

    await waitForCount('landscape-process', 1);
    await studioAgent.assertVisible('.treeview__label=order-process.bpmn', TIMEOUT);
    await studioAgent.clickOn('.treeview__label=order-process.bpmn');
    await studioAgent.assertVisible(
      '[data-test--tree="bpmn-landscape/processes"] .treeview__badge .ph-map-pin',
      TIMEOUT,
    );
    expect(await studioAgent.getElementCount('[data-test--tree="bpmn-landscape/processes"] .ph-map-pin')).toBe(1);
  });

  it('the palette creates a group with a click on the canvas', async () => {
    await openMap('Test.bfwmap');

    await createGroupFromPalette();

    await waitForCount('landscape-group', 1);
    expect(await hasUnsavedChanges('Test.bfwmap')).toBe(true);
  });

  it('a group dropped with the cursor on a placeholder adopts it, and the saved file nests it', async () => {
    await openMap('Test.bfwmap');
    await waitForCount('landscape-placeholder', 1);

    await createGroupFromPalette(await centerOf('[data-element-id="placeholder-1"]'));
    await waitForCount('landscape-group', 1);

    await studioAgent.clickOn(CANVAS);
    await studioAgent.sendKeyboardInput([SAVE], false);
    const saved = await waitForFile('Test.bfwmap', (map) => map.elements.length === 2);
    const group = saved.elements.find((element) => element.type === 'group');
    expect(saved.elements.map((element) => [element.type, element.parentId])).toEqual([
      ['group', null],
      ['placeholder', group?.id],
    ]);
  });

  it('enlarging, shrinking and moving a group reassign its children, each in one undo step', async () => {
    await openMap('Test.bfwmap');
    await waitForCount('landscape-placeholder', 1);

    const steps = await onCanvas(
      'Test.bfwmap',
      `
      const factory = modeler.get('elementFactory');
      const placeholder = registry.get('placeholder-1');
      const parentOf = (shape) => (shape.parent === root ? 'root' : shape.parent.id);
      const createGroup = (id, center, width, height) => {
        const element = { id, type: 'group', parentId: null, label: id, collapsed: false, style: null, x: 0, y: 0, width, height };
        return modeling.createShape(factory.createShape({ id, type: 'group', x: 0, y: 0, width, height, businessObject: element }), center, root);
      };
      const steps = {};
      const group = createGroup('group-1', { x: 400, y: 400 }, 100, 100);
      steps.created = parentOf(placeholder);
      modeling.resizeShape(group, { x: 50, y: 50, width: 400, height: 400 });
      steps.enlarged = parentOf(placeholder);
      modeling.resizeShape(group, { x: 50, y: 50, width: 100, height: 100 });
      steps.shrunk = parentOf(placeholder);
      modeling.resizeShape(group, { x: 50, y: 50, width: 120, height: 100 });
      steps.partlyCovered = parentOf(placeholder);
      steps.groupDrawnBehind = root.children.indexOf(group) < root.children.indexOf(placeholder);
      modeling.resizeShape(group, { x: 600, y: 50, width: 400, height: 300 });
      modeling.moveElements([group], { x: -560, y: 0 });
      steps.movedOver = parentOf(placeholder);
      modeler.get('commandStack').undo();
      steps.undone = parentOf(placeholder) + ' ' + group.x;
      createGroup('outer', { x: 500, y: 300 }, 1200, 800);
      steps.outerCreated = parentOf(placeholder) + ' ' + parentOf(group);
      modeling.resizeShape(group, { x: 60, y: 50, width: 940, height: 300 });
      steps.nestedEnlarged = parentOf(placeholder);
      modeling.resizeShape(group, { x: 600, y: 50, width: 400, height: 300 });
      steps.nestedShrunk = parentOf(placeholder);
      return steps;
      `,
    );

    expect(steps).toEqual({
      created: 'root',
      enlarged: 'group-1',
      shrunk: 'root',
      partlyCovered: 'root',
      groupDrawnBehind: true,
      movedOver: 'group-1',
      undone: 'root 600',
      outerCreated: 'outer outer',
      nestedEnlarged: 'group-1',
      nestedShrunk: 'outer',
    });
  });

  it('saving writes the process and the group, and a reopened map shows both', async () => {
    await openMap('Test.bfwmap');
    await createGroupFromPalette();
    await waitForCount('landscape-group', 1);
    await addProcess('order-process', -2000, -2000);
    await waitForCount('landscape-process', 1);

    await studioAgent.clickOn(CANVAS);
    await studioAgent.sendKeyboardInput([SAVE], false);

    const saved = await waitForFile('Test.bfwmap', (map) => map.elements.length === 3);
    const process = saved.elements.find((element) => element.type === 'process');
    expect(process?.type === 'process' ? process.fileHint : null).toBe('order-process.bpmn');
    expect(saved.elements.filter((element) => element.type === 'group')).toHaveLength(1);

    await studioAgent.closeOpenEditors(DOCUMENT_TYPE);
    await openMap('Test.bfwmap');
    await waitForCount('landscape-process', 1);
    await waitForCount('landscape-group', 1);
    await waitForCount('landscape-placeholder', 1);
  });

  it('arrow keys move the selection; Delete removes it and undo brings it back clean', async () => {
    await openMap('Test.bfwmap');
    await waitForCount('landscape-placeholder', 1);

    await studioAgent.clickOn('[data-element-id="placeholder-1"]');
    await studioAgent.assertVisible('[data-element-id="placeholder-1"].selected', TIMEOUT);
    await studioAgent.sendKeyboardInput([Key.ArrowRight], false);
    await studioAgent.sendKeyboardInput([SAVE], false);

    await waitForFile('Test.bfwmap', (map) => (map.elements[0]?.x ?? 100) > 100);
    expect(await hasUnsavedChanges('Test.bfwmap')).toBe(false);

    await studioAgent.sendKeyboardInput([DELETE], false);
    await waitForCount('landscape-placeholder', 0);
    expect(await hasUnsavedChanges('Test.bfwmap')).toBe(true);

    // Letter keys follow the host keyboard layout (Cmd+Z arrives as Cmd+Y on QWERTZ), so undo goes through its command.
    await studioAgent.executeCommand('std.editor.undoInFocusedEditorDocument');
    await waitForCount('landscape-placeholder', 1);
    await studioAgent.waitUntil(async () => (await hasUnsavedChanges('Test.bfwmap')) === false, {
      timeout: TIMEOUT,
      timeoutMsg: 'The map stayed dirty after undoing the delete',
    });
  });

  it('an unreadable map shows the error view and saving leaves the file unchanged', async () => {
    const before = fs.readFileSync(mapPath('Broken.bfwmap'));

    await studioAgent.openUriAsDocument(`file://${mapPath('Broken.bfwmap')}`);
    await studioAgent.assertVisible('h2=This landscape map cannot be read', TIMEOUT);
    await studioAgent.clickOn('.editor__content--loading-error');
    await studioAgent.sendKeyboardInput([SAVE], false);
    await studioAgent.pause(1000);

    expect(fs.readFileSync(mapPath('Broken.bfwmap')).equals(before)).toBe(true);
    await studioAgent.assertNotVisible(CANVAS);
    await studioAgent.closeAllNotifications();
  });
});
