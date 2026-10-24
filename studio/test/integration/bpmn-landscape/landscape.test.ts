import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
const DELETE = process.platform === 'darwin' ? Key.Backspace : Key.Delete;

/**
 * All landscape tests share one Electron window. After every test the window returns to a blank state (no solution,
 * no open document), so the tests do not depend on each other and run in any order. Each test sets up its own
 * workspace through the `prepare` function of its block.
 */
describe('bpmn-landscape', () => {
  let studioAgent: StudioAgent;
  const createdWorkspaces: string[] = [];

  /** A temporary workspace that the reset after the test removes. */
  const createWorkspace = (prefix: string, options: { declareLandscapeFolder?: boolean } = {}): LandscapeWorkspace => {
    const landscapeWorkspace = createLandscapeWorkspace(prefix, options);
    createdWorkspaces.push(landscapeWorkspace.workspace);
    return landscapeWorkspace;
  };

  beforeAll(async () => {
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    // Tests replace these two dialogs; the reset puts the originals back.
    await studioAgent.executeInRenderer(
      'window.__landscapeOriginalDialogs = { showOpenDirectory: bifrost.dialog.showOpenDirectory, showSaveFile: bifrost.dialog.showSaveFile };',
    );
  });

  beforeEach(async ({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    expect(await studioAgent.getFocusedDocumentUri(), 'the previous test left a document open').toBe('');
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();

    await studioAgent.closeActiveDialog();
    await studioAgent.closeAllNotifications();
    await studioAgent.executeInRenderer('Object.assign(bifrost.dialog, window.__landscapeOriginalDialogs);');
    // Closing the solution alone would ask about unsaved maps and leave other documents open.
    await studioAgent.closeOpenEditors(DOCUMENT_TYPE);
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.closeSolutionViaApi();
    for (const workspace of createdWorkspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  describe('page', () => {
    const PANE_ID = 'discover/landscapes/landscapes';
    const TREE = '[data-test--tree="bpmn-landscape/processes"]';
    const FILTER = '[data-test--landscape-process-filter]';

    let landscapeWorkspace: LandscapeWorkspace;

    const prepare = async (): Promise<void> => {
      landscapeWorkspace = createWorkspace('bfw-landscape-page-');
      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    };

    const treeLabels = async (): Promise<string[]> =>
      (await studioAgent.executeInRenderer(
        `return [...document.querySelectorAll('${TREE} .treeview__label')].map((label) => label.textContent)`,
      )) as string[];

    const waitForTreeLabels = async (expected: string[]): Promise<void> => {
      await studioAgent.waitUntil(async () => JSON.stringify(await treeLabels()) === JSON.stringify(expected), {
        timeout: TIMEOUT,
        timeoutMsg: `The Processes pane did not show ${JSON.stringify(expected)}`,
      });
    };

    it('shows the Discover category with the Landscapes page, its Maps explorer and its Processes pane', async () => {
      await prepare();
      await studioAgent.assertVisible('.workbench-header__category[data-category-id="discover"]', TIMEOUT);
      await studioAgent.navigation.showLeftPane(PANE_ID);
      await studioAgent.navigation.assertLeftPaneIsActive(PANE_ID);
      await studioAgent.assertVisible('[data-test--landscape-new-map]', TIMEOUT);
      await studioAgent.assertVisible('[data-test--tree="bpmn-landscape/processes"]', TIMEOUT);
    });

    it('lists the BPMN files collapsed; expanding a file shows its processes', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane(PANE_ID);
      await waitForTreeLabels([
        'draft-process.bpmn',
        'order-process.bpmn',
        'payment-process.bpmn',
        'unversioned-process.bpmn',
      ]);

      await studioAgent.clickOn('.treeview__label=order-process.bpmn');

      await studioAgent.assertVisible('.treeview__label=Order Process', TIMEOUT);
      expect(await treeLabels()).toContain('Order Process');
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('the filter keeps matching processes and expands their files', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane(PANE_ID);
      await studioAgent.clickOn(FILTER);
      await studioAgent.sendKeyboardInput([...'payment'.split('')], false);

      await waitForTreeLabels(['payment-process.bpmn', 'Payment Process']);

      await studioAgent.clearTextInput(FILTER);
      await waitForTreeLabels([
        'draft-process.bpmn',
        'order-process.bpmn',
        'payment-process.bpmn',
        'unversioned-process.bpmn',
      ]);
    });
  });

  describe('folder', () => {
    const MAPS_PANE = 'discover/landscapes/maps';
    const PROCESSES_PANE = '[data-test--pane="discover/landscapes/landscapes"]';
    const MAPS_TREE = '[data-test--tree="std/file-explorer/landscapes"]';
    const hint = (state: string): string => `[data-test--landscape-folder-hint="${state}"]`;

    let landscapeWorkspace: LandscapeWorkspace;

    const writeMap = (relativePath: string): void => {
      const mapPath = path.join(landscapeWorkspace.landscapeFolder, relativePath);
      fs.mkdirSync(path.dirname(mapPath), { recursive: true });
      fs.writeFileSync(mapPath, serializeLandscapeMap(createEmptyLandscapeMap(path.basename(mapPath, '.bfwmap'))));
    };

    const notificationTexts = async (): Promise<string[]> =>
      (await studioAgent.executeInRenderer(
        'return bifrost.notifications.getVisibleNotifications().map((notification) => String(notification.options.content))',
      )) as string[];

    const waitForNotification = async (text: string): Promise<void> => {
      await studioAgent.waitUntil(async () => (await notificationTexts()).some((content) => content.includes(text)), {
        timeout: TIMEOUT,
        timeoutMsg: `No notification contained "${text}"`,
      });
    };

    const openSolutionAndShowMaps = async (): Promise<void> => {
      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
      await studioAgent.navigation.showLeftPane(MAPS_PANE);
    };

    const prepare = ({ declareLandscapeFolder = true }: { declareLandscapeFolder?: boolean } = {}): void => {
      landscapeWorkspace = createWorkspace('bfw-landscape-folder-', { declareLandscapeFolder });
    };

    it('a folder opened as a solution asks to be saved as a solution first', async () => {
      prepare();
      await studioAgent.openDirectoryAsSolution(landscapeWorkspace.workspace);
      await studioAgent.navigation.showLeftPane(MAPS_PANE);

      await studioAgent.assertVisible(hint('unsaved'), TIMEOUT);
      await studioAgent.assertVisible('button=Convert to Solution…', TIMEOUT);
      expect(await studioAgent.getElementCount(hint('unsaved'))).toBe(1);
      expect(await studioAgent.getElementCount(PROCESSES_PANE)).toBe(0);
    });

    it('closing the solution closes its open maps', async () => {
      prepare();
      writeMap('Overview.bfwmap');
      await openSolutionAndShowMaps();
      await studioAgent.assertVisible(PROCESSES_PANE, TIMEOUT);
      const mapUri = `file://${path.join(landscapeWorkspace.landscapeFolder, 'Overview.bfwmap')}`;
      await studioAgent.executeCommandWithoutBlocking('std.editor.focusOrOpenDocument', [mapUri]);
      await studioAgent.waitUntil(async () => (await studioAgent.getFocusedDocumentUri()) === mapUri, {
        timeout: TIMEOUT,
        timeoutMsg: 'The map did not open',
      });

      await studioAgent.closeSolutionViaApi();

      await studioAgent.waitUntil(async () => (await studioAgent.getFocusedDocumentUri()) === '', {
        timeout: TIMEOUT,
        timeoutMsg: 'The map stayed open after the solution was closed',
      });
      await studioAgent.assertVisible(hint('no-solution'), TIMEOUT);
      expect(await studioAgent.getElementCount(PROCESSES_PANE)).toBe(0);
    });

    it('a solution without a landscape folder sets it up next to the solution file', async () => {
      prepare({ declareLandscapeFolder: false });
      await openSolutionAndShowMaps();
      await studioAgent.assertVisible(hint('no-folder'), TIMEOUT);

      await studioAgent.clickOn('button=Set Up Landscape Folder');

      await studioAgent.waitForJsonFileValue(landscapeWorkspace.solutionFile, 'views', {
        landscapes: { path: 'landscapes' },
      });
      expect(fs.existsSync(landscapeWorkspace.landscapeFolder)).toBe(true);
      await studioAgent.assertVisible('button=New Landscape Map', TIMEOUT);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('a landscape folder holding a root folder of the solution is refused', async () => {
      prepare();
      await openSolutionAndShowMaps();
      await studioAgent.executeInRenderer(
        `bifrost.dialog.showOpenDirectory = async () => [${JSON.stringify(landscapeWorkspace.workspace)}]`,
      );

      await studioAgent.executeCommandWithoutBlocking('bpmn.landscape.chooseLandscapeFolder', []);

      await waitForNotification('holds a root folder of the solution');
      await studioAgent.waitForJsonFileValue(landscapeWorkspace.solutionFile, 'views', {
        landscapes: { path: 'landscapes' },
      });
    });

    it('a missing landscape folder can be created', async () => {
      prepare();
      fs.rmSync(landscapeWorkspace.landscapeFolder, { recursive: true });
      await openSolutionAndShowMaps();

      await studioAgent.assertVisible('p=The landscape folder landscapes does not exist.', TIMEOUT);
      await studioAgent.clickOn('button=Create Folder');

      await studioAgent.waitUntil(async () => fs.existsSync(landscapeWorkspace.landscapeFolder), {
        timeout: TIMEOUT,
        timeoutMsg: 'The landscape folder was not created',
      });
      await studioAgent.assertVisible('button=New Landscape Map', TIMEOUT);
    });

    it('a map outside the landscape folder is refused', async () => {
      prepare();
      const outsidePath = path.join(landscapeWorkspace.workspace, 'Outside.bfwmap');
      fs.writeFileSync(outsidePath, serializeLandscapeMap(createEmptyLandscapeMap('Outside')));
      await openSolutionAndShowMaps();

      await studioAgent.executeCommandWithoutBlocking('std.editor.focusOrOpenDocument', [`file://${outsidePath}`]);

      await waitForNotification(
        'Landscape maps open only from the landscape folder of the open solution (landscapes). Move this map there or open its solution.',
      );
      expect(await studioAgent.getFocusedDocumentUri()).toBe('');
    });

    it('the Maps explorer lists the maps and offers no structural entries', async () => {
      prepare();
      writeMap('Overview.bfwmap');
      writeMap('archive/Old.bfwmap');
      fs.mkdirSync(path.join(landscapeWorkspace.landscapeFolder, 'empty'));
      await openSolutionAndShowMaps();

      await studioAgent.assertVisible(
        `${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/Overview.bfwmap"]`,
        TIMEOUT,
      );
      await studioAgent.assertVisible(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`, TIMEOUT);
      expect(await studioAgent.getElementCount(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/empty"]`)).toBe(
        0,
      );
      await studioAgent.assertVisible('[data-test--landscape-new-map]', TIMEOUT);

      await studioAgent.rightClickOn(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`);
      await studioAgent.assertContextMenuVisible();
      await studioAgent.assertVisible(
        '[data-test--context-menu-id="std/file-explorer/directory/new-landscape-map"]',
        TIMEOUT,
      );
      for (const entry of ['new-file', 'new-directory', 'rename', 'delete', 'hide-by-name']) {
        expect(
          await studioAgent.getElementCount(`[data-test--context-menu-id="std/file-explorer/directory/${entry}"]`),
        ).toBe(0);
      }
    });

    it('"New Landscape Map..." saves into the clicked folder', async () => {
      prepare();
      writeMap('archive/Old.bfwmap');
      await openSolutionAndShowMaps();
      await studioAgent.executeInRenderer(
        'bifrost.dialog.showSaveFile = async (options) => options.defaultPath.replace("New Landscape", "Fresh")',
      );

      await studioAgent.rightClickOn(`${MAPS_TREE} [data-test--tree-entry-uri$="/landscapes/archive"]`);
      await studioAgent.clickOn('[data-test--context-menu-id="std/file-explorer/directory/new-landscape-map"]');

      const expectedPath = path.join(landscapeWorkspace.landscapeFolder, 'archive', 'Fresh.bfwmap');
      await studioAgent.waitUntil(
        async () => (await studioAgent.getFocusedDocumentUri()) === `file://${expectedPath}`,
        {
          timeout: TIMEOUT,
          timeoutMsg: 'The new map did not open from the archive folder',
        },
      );
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('solution', () => {
    const MAPS_TREE = '[data-test--tree="std/file-explorer/landscapes"]';

    const box = (id: string, x: number, y: number) => ({
      id,
      parentId: null,
      x,
      y,
      width: 140,
      height: 60,
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
    const placeholderShape = (id: string, label: string, x: number, y: number): LandscapeElement => ({
      ...box(id, x, y),
      type: 'placeholder',
      label,
      shape: 'box',
    });

    let workspace: string;
    let landscapeWorkspace: LandscapeWorkspace;

    const mapPath = (fileName: string): string => path.join(landscapeWorkspace.landscapeFolder, fileName);
    const mapUri = (fileName: string): string => `file://${mapPath(fileName)}`;
    const writeMap = (fileName: string, map: LandscapeMap): void =>
      fs.writeFileSync(mapPath(fileName), serializeLandscapeMap(map));
    const readMap = async (fileName: string): Promise<LandscapeMap> => {
      const result = await parseLandscapeMap(fs.readFileSync(mapPath(fileName), 'utf8'));
      if (!result.ok) {
        throw new Error(`${fileName} cannot be read: ${result.errors.join(' ')}`);
      }
      return result.map;
    };

    /** Runs `script` in the renderer with `modeler`, `registry` and `selection` of the open map in scope. */
    const onCanvas = async (fileName: string, script: string): Promise<unknown> =>
      studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri(fileName))});
      const modeler = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument).modeler;
      const registry = modeler.get('elementRegistry');
      const selection = modeler.get('selection');
      ${script}
    `);

    const openMap = async (fileName: string): Promise<void> => {
      await studioAgent.openUriAsDocument(mapUri(fileName));
      await studioAgent.navigation.assertActivePage('discover/landscapes');
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
    };

    const waitForCount = async (selector: string, expected: number): Promise<void> => {
      await studioAgent.waitUntil(async () => (await studioAgent.getElementCount(selector)) === expected, {
        timeout: TIMEOUT,
        timeoutMsg: `Expected ${expected} of '${selector}'`,
      });
    };

    const shapeIdsOfType = async (fileName: string, type: string): Promise<string[]> =>
      (await onCanvas(
        fileName,
        `return registry.filter((element) => element.type === ${JSON.stringify(type)}).map((element) => element.id).sort();`,
      )) as string[];

    const waitForSelection = async (fileName: string, expected: string[]): Promise<void> => {
      await studioAgent.waitUntil(
        async () =>
          JSON.stringify(await onCanvas(fileName, `return selection.get().map((element) => element.id);`)) ===
          JSON.stringify(expected),
        { timeout: TIMEOUT, timeoutMsg: `Expected the selection ${expected.join(', ')}` },
      );
    };

    /** Plays a drag of the tree row onto the canvas with the events the browser would send. */
    const dragRowToCanvas = async (rowSelector: string, targetSelector: string): Promise<void> => {
      await studioAgent.executeInRenderer(`
      const row = document.querySelector(${JSON.stringify(rowSelector)});
      const target = document.querySelector(${JSON.stringify(targetSelector)});
      const bounds = target.getBoundingClientRect();
      const position = { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 };
      const dataTransfer = new DataTransfer();
      const send = (element, type, extra) =>
        element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, ...extra }));
      send(row, 'dragstart', {});
      send(target, 'dragover', position);
      send(target, 'drop', position);
      send(row, 'dragend', {});
    `);
    };

    const exportMap = async (fileName: string, format: string, target: string): Promise<void> => {
      const editorDocument = await studioAgent.executeInRenderer(
        `return JSON.parse(JSON.stringify(bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri(fileName))})));`,
      );
      await studioAgent.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, target]);
    };

    const waitForFile = async (filename: string, condition: (content: Buffer) => boolean): Promise<Buffer> => {
      let content = Buffer.alloc(0);
      await studioAgent.waitUntil(
        async () => {
          content = fs.existsSync(filename) ? fs.readFileSync(filename) : Buffer.alloc(0);
          return condition(content);
        },
        { timeout: TIMEOUT, timeoutMsg: `${filename} was not written as expected` },
      );
      return content;
    };

    const prepare = async (): Promise<void> => {
      landscapeWorkspace = createWorkspace('bfw-landscape-solution-');
      workspace = landscapeWorkspace.workspace;
      writeMap('Missing.bfwmap', {
        ...createEmptyLandscapeMap('Missing'),
        elements: [processShape('ghost', 'ghost-process', 50, 50), processShape('order', 'order-process', 350, 50)],
      });
      writeMap('Connected.bfwmap', {
        ...createEmptyLandscapeMap('Connected'),
        elements: [processShape('ghost', 'ghost-process', 50, 50), placeholderShape('archive', 'Archive', 350, 50)],
        connectors: [{ id: 'connector-1', sourceId: 'ghost', targetId: 'archive', label: '', waypoints: [] }],
      });
      writeMap('Target.bfwmap', {
        ...createEmptyLandscapeMap('Target'),
        elements: [placeholderShape('note', 'Elsewhere', 50, 50)],
      });
      writeMap('Dropper.bfwmap', {
        ...createEmptyLandscapeMap('Dropper'),
        elements: [placeholderShape('start', 'Start', 50, 50)],
      });
      writeMap('Exported.bfwmap', {
        ...createEmptyLandscapeMap('Exported'),
        elements: [processShape('order', 'order-process', 50, 50), placeholderShape('archive', 'Archive', 350, 50)],
      });

      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    };

    it('a missing process is greyed, Review selects it and Replace repairs it', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane('discover/landscapes/maps');
      await studioAgent.assertVisible(
        `${MAPS_TREE} [data-test--tree-entry-uri$="/Missing.bfwmap"] .treeview__badge`,
        TIMEOUT,
      );

      await openMap('Missing.bfwmap');

      await waitForCount(`${CANVAS} .landscape-reference-warning`, 1);
      expect(
        await onCanvas(
          'Missing.bfwmap',
          `return registry.getGraphics('ghost').querySelector('.landscape-process').getAttribute('opacity');`,
        ),
      ).toBe('0.45');

      await studioAgent.waitUntil(
        async () =>
          (await studioAgent.executeInRenderer(`
          const notification = bifrost.notifications
            .getVisibleNotifications()
            .find((candidate) => candidate.options.actions?.some((action) => action.action === 'review'));
          notification?.responseCallbackFn({ action: 'review', label: 'Review' });
          return notification != null;
        `)) === true,
        { timeout: TIMEOUT, timeoutMsg: 'The Review notification did not appear' },
      );
      await waitForSelection('Missing.bfwmap', ['ghost']);
      await studioAgent.assertVisible('[data-test--landscape-broken-process="missing"]', TIMEOUT);
      await studioAgent.closeAllNotifications();

      await studioAgent.clickOn('#landscape-replace-process .react-select__control');
      await studioAgent.clickOn(
        `[data-test-option-value="file://${path.join(workspace, 'payment-process.bpmn')}#payment-process"]`,
      );

      await waitForCount(`${CANVAS} .landscape-reference-warning`, 0);
      await studioAgent.sendKeyboardInput([SAVE], false);
      await studioAgent.waitUntil(
        async () =>
          (await readMap('Missing.bfwmap')).elements.some(
            (element) =>
              element.id === 'ghost' && element.type === 'process' && element.processId === 'payment-process',
          ),
        { timeout: TIMEOUT, timeoutMsg: 'The replaced process was not saved' },
      );
    });

    it('dropping a reference leaves a placeholder that keeps its connector', async () => {
      await prepare();
      await openMap('Connected.bfwmap');
      await waitForCount(`${CANVAS} .landscape-reference-warning`, 1);
      await studioAgent.closeAllNotifications();

      await studioAgent.clickOn(`${CANVAS} [data-element-id="ghost"]`);
      await studioAgent.clickOn('[data-test--landscape-drop-reference]');

      await waitForCount(`${CANVAS} .landscape-reference-warning`, 0);
      expect(await shapeIdsOfType('Connected.bfwmap', 'process')).toEqual([]);
      expect(await shapeIdsOfType('Connected.bfwmap', 'placeholder')).toHaveLength(2);
      expect(
        await onCanvas(
          'Connected.bfwmap',
          `const connector = registry.filter((element) => element.type === 'connector')[0];
         return [connector?.source.type, connector?.source.businessObject.label, connector?.target.id];`,
        ),
      ).toEqual(['placeholder', 'ghost-process', 'archive']);

      await studioAgent.sendKeyboardInput([SAVE], false);
      await studioAgent.waitUntil(
        async () => !(await readMap('Connected.bfwmap')).elements.some((e) => e.type === 'process'),
        {
          timeout: TIMEOUT,
          timeoutMsg: 'The placeholder was not saved',
        },
      );
      const saved = await readMap('Connected.bfwmap');
      const placeholder = saved.elements.find(
        (element) => element.type === 'placeholder' && element.label === 'ghost-process',
      );
      expect(saved.connectors.map((connector) => connector.sourceId)).toEqual([placeholder?.id]);
    });

    it('a map dragged from the Maps explorer becomes a link that opens its target', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane('discover/landscapes/maps');
      await openMap('Dropper.bfwmap');
      await studioAgent.assertVisible(`${MAPS_TREE} [data-test--tree-entry-uri$="/Target.bfwmap"]`, TIMEOUT);

      await dragRowToCanvas(`${MAPS_TREE} [data-test--tree-entry-uri$="/Target.bfwmap"]`, CANVAS);

      await waitForCount(`${CANVAS} .landscape-mapLink`, 1);
      const [linkId] = await shapeIdsOfType('Dropper.bfwmap', 'mapLink');
      expect(
        await onCanvas('Dropper.bfwmap', `return registry.get(${JSON.stringify(linkId)}).businessObject.mapPath;`),
      ).toBe('Target.bfwmap');
      expect(await studioAgent.getElementCount(`${CANVAS} .landscape-reference-warning`)).toBe(0);

      await onCanvas(
        'Dropper.bfwmap',
        `modeler.get('eventBus').fire('element.dblclick', { element: registry.get(${JSON.stringify(linkId)}) });`,
      );

      await studioAgent.waitUntil(
        async () =>
          (await studioAgent.executeInRenderer(`return bifrost.editors.getFocusedEditorDocument()?.uri;`)) ===
          mapUri('Target.bfwmap'),
        { timeout: TIMEOUT, timeoutMsg: 'The target map was not opened' },
      );

      await studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri('Dropper.bfwmap'))});
      bifrost.editors
        .getEditorDocumentModelIfPresent(editorDocument)
        .retargetSelectedMapLink(${JSON.stringify(mapUri('Exported.bfwmap'))});
    `);
      expect(
        await onCanvas(
          'Dropper.bfwmap',
          `const link = registry.get(${JSON.stringify(linkId)}).businessObject; return [link.mapPath, link.label];`,
        ),
      ).toEqual(['Exported.bfwmap', 'Exported']);
    });

    it('a Maps explorer row dropped on another row does not move the file', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane('discover/landscapes/maps');
      await studioAgent.assertVisible(`${MAPS_TREE} [data-test--tree-entry-uri$="/Target.bfwmap"]`, TIMEOUT);

      await dragRowToCanvas(
        `${MAPS_TREE} [data-test--tree-entry-uri$="/Target.bfwmap"]`,
        `${MAPS_TREE} [data-test--tree-entry-uri$="/Dropper.bfwmap"]`,
      );

      expect(fs.existsSync(mapPath('Target.bfwmap'))).toBe(true);
      expect(fs.existsSync(mapPath('Dropper.bfwmap'))).toBe(true);
      expect(fs.readdirSync(landscapeWorkspace.landscapeFolder).sort()).toEqual([
        'Connected.bfwmap',
        'Dropper.bfwmap',
        'Exported.bfwmap',
        'Missing.bfwmap',
        'Target.bfwmap',
      ]);
    });

    it('exports the map as SVG with plain colours and as a PNG image', async () => {
      await prepare();
      await openMap('Exported.bfwmap');
      await studioAgent.waitUntil(
        async () =>
          (await onCanvas(
            'Exported.bfwmap',
            `return registry.getGraphics('order').querySelector('.landscape-label')?.textContent;`,
          )) === 'Order Process',
        { timeout: TIMEOUT, timeoutMsg: 'The process name was not shown on the map' },
      );
      await studioAgent.clickOn('.treeview__label=order-process.bpmn');
      await studioAgent.waitUntil(
        async () =>
          (await studioAgent.executeInRenderer(`
          const row = [...document.querySelectorAll('[data-test--tree="bpmn-landscape/processes"] [data-test--tree-entry-type="file"]')]
            .find((entry) => entry.textContent.includes('Order Process'));
          return row?.querySelector('.treeview__badge')?.firstChild?.textContent;
        `)) === '2',
        {
          timeout: TIMEOUT,
          timeoutMsg: 'The Processes pane does not show order-process on the two maps that resolve it',
        },
      );
      const svgPath = path.join(workspace, 'exported.svg');
      const pngPath = path.join(workspace, 'exported.png');

      await exportMap('Exported.bfwmap', 'svg', svgPath);
      const svg = (await waitForFile(svgPath, (content) => content.toString().includes('</svg>'))).toString();
      await exportMap('Exported.bfwmap', 'png', pngPath);
      const png = await waitForFile(pngPath, (content) => content.length > 100);

      expect(svg).toContain('Archive');
      expect(svg).toContain('Order Process');
      expect(svg).not.toContain('var(--');
      expect(svg).not.toContain('djs-hit');
      expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('relations', () => {
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

    const prepare = async (): Promise<void> => {
      landscapeWorkspace = createWorkspace('bfw-landscape-relations-');
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

      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    };

    it('draws the call and message relations, labels the message, and does not save them', async () => {
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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
      await prepare();
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

  describe('editing', () => {
    let workspace: string;
    let landscapeWorkspace: LandscapeWorkspace;

    const mapPath = (fileName: string): string => path.join(landscapeWorkspace.landscapeFolder, fileName);
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

    const prepare = async ({
      emptyMap = false,
      bandLabel = false,
    }: { emptyMap?: boolean; bandLabel?: boolean } = {}): Promise<void> => {
      landscapeWorkspace = createWorkspace('bfw-landscape-');
      workspace = landscapeWorkspace.workspace;
      if (emptyMap) {
        writeMap('Empty.bfwmap', '');
      }
      writeMap('Test.bfwmap', {
        ...createEmptyLandscapeMap('Test'),
        elements: [
          ...(bandLabel
            ? [
                {
                  id: 'band-1',
                  type: 'band' as const,
                  parentId: null,
                  x: 300,
                  y: 300,
                  width: 900,
                  height: 200,
                  style: null,
                  label: 'Core',
                },
              ]
            : []),
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

      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    };

    it('opening an empty map from the Maps explorer activates the Landscapes page', async () => {
      await prepare({ emptyMap: true });
      await studioAgent.navigation.showLeftPane('discover/landscapes/maps');
      await studioAgent.clickOn(
        `[data-test--tree="std/file-explorer/landscapes"] [data-test--tree-entry-uri$="/landscapes/Empty.bfwmap"]`,
      );

      await studioAgent.navigation.assertActivePage('discover/landscapes');
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      await studioAgent.assertVisible('.djs-palette', TIMEOUT);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('adding the same process twice gives one shape and the on-map badge', async () => {
      await prepare();
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
      await prepare();
      await openMap('Test.bfwmap');

      await createGroupFromPalette();

      await waitForCount('landscape-group', 1);
      expect(await hasUnsavedChanges('Test.bfwmap')).toBe(true);
    });

    it('a group dropped with the cursor on a placeholder adopts it, and the saved file nests it', async () => {
      await prepare();
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
      await prepare();
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

    it('editing a band label opens a box turned over the strip on the left edge', async () => {
      await prepare({ bandLabel: true });
      await openMap('Test.bfwmap');
      await studioAgent.waitUntil(
        async () => (await onCanvas('Test.bfwmap', `return registry.get('band-1') != null;`)) === true,
        {
          timeout: TIMEOUT,
          timeoutMsg: 'Expected the band on the map',
        },
      );

      await onCanvas('Test.bfwmap', `modeler.get('directEditing').activate(registry.get('band-1'));`);

      // The strip is 32 units wide and as high as the band; the visible box has to cover exactly that.
      const isOverStrip = await onCanvas(
        'Test.bfwmap',
        `const canvas = modeler.get('canvas');
       const box = document.querySelector('.djs-direct-editing-parent');
       const container = canvas.getContainer().getBoundingClientRect();
       const bounds = canvas.getAbsoluteBBox(registry.get('band-1'));
       const zoom = canvas.zoom();
       const visible = box.getBoundingClientRect();
       const near = (actual, expected) => Math.abs(actual - expected) <= 2;
       return box.style.transform === 'rotate(-90deg)'
         && near(visible.width, 32 * zoom) && near(visible.height, bounds.height)
         && near(visible.left - container.left, bounds.x) && near(visible.top - container.top, bounds.y);`,
      );
      expect(isOverStrip).toBe(true);
    });

    it('saving writes the process and the group, and a reopened map shows both', async () => {
      await prepare();
      await openMap('Test.bfwmap');
      await createGroupFromPalette();
      await waitForCount('landscape-group', 1);
      await addProcess('order-process', -2000, -2000);
      await waitForCount('landscape-process', 1);

      await studioAgent.clickOn(CANVAS);
      await studioAgent.sendKeyboardInput([SAVE], false);

      const saved = await waitForFile('Test.bfwmap', (map) => map.elements.length === 3);
      const process = saved.elements.find((element) => element.type === 'process');
      expect(process?.type === 'process' ? process.fileHint : null).toBe('../order-process.bpmn');
      expect(saved.elements.filter((element) => element.type === 'group')).toHaveLength(1);

      await studioAgent.closeOpenEditors(DOCUMENT_TYPE);
      await openMap('Test.bfwmap');
      await waitForCount('landscape-process', 1);
      await waitForCount('landscape-group', 1);
      await waitForCount('landscape-placeholder', 1);
    });

    it('arrow keys move the selection; Delete removes it and undo brings it back clean', async () => {
      await prepare();
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
      await prepare();
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

  describe('hierarchy', () => {
    const PROPERTIES_PANE = 'discover/landscapes/properties';
    const MAP_FILE = 'Hierarchy.bfwmap';
    const CALL_LINE_TO_GROUP = 'relation:callActivity:team:payment';

    /**
     * The bends of the connector `link`: out to the left of the note, up, and back into the process. They stay outside
     * `team`, so a click on the middle of the group does not hit the line.
     */
    const LINK_WAYPOINTS = [
      { x: 50, y: 325 },
      { x: 20, y: 325 },
      { x: 20, y: 85 },
      { x: 50, y: 85 },
    ];

    const box = (id: string, x: number, y: number, width = 120, height = 50) => ({
      id,
      parentId: null,
      x,
      y,
      width,
      height,
      style: null,
    });

    /**
     * A group `team` holding the process `order`, a process `payment` and a note outside, and a connector from the note
     * into the group. With `withExtraNote`, `team` also holds the note `extra`.
     */
    function hierarchyMap(collapsed: boolean, withExtraNote = false): LandscapeMap {
      const order: LandscapeElement = {
        ...box('order', 50, 60),
        parentId: 'team',
        type: 'process',
        processId: 'order-process',
        fileHint: '../order-process.bpmn',
        label: null,
        shape: 'box',
      };
      const payment: LandscapeElement = {
        ...box('payment', 450, 60),
        type: 'process',
        processId: 'payment-process',
        fileHint: '../payment-process.bpmn',
        label: null,
        shape: 'box',
      };
      return {
        ...createEmptyLandscapeMap('Hierarchy'),
        elements: [
          { ...box('team', 30, 30, 400, 130), type: 'group', label: 'Team', collapsed },
          order,
          ...(withExtraNote
            ? [{ ...box('extra', 300, 60), parentId: 'team', type: 'note' as const, text: 'Extra' }]
            : []),
          payment,
          { ...box('note', 50, 300), type: 'note', text: 'Remember' },
        ],
        connectors: [
          {
            id: 'link',
            sourceId: 'note',
            targetId: 'order',
            label: 'Files',
            waypoints: LINK_WAYPOINTS,
          },
        ],
      };
    }

    let landscapeWorkspace: LandscapeWorkspace;

    const mapPath = (): string => path.join(landscapeWorkspace.landscapeFolder, MAP_FILE);
    const mapUri = (): string => `file://${mapPath()}`;
    const writeMap = (map: LandscapeMap): void => fs.writeFileSync(mapPath(), serializeLandscapeMap(map));
    const readMap = async (): Promise<LandscapeMap> => {
      const result = await parseLandscapeMap(fs.readFileSync(mapPath(), 'utf8'));
      if (!result.ok) {
        throw new Error(`${MAP_FILE} cannot be read: ${result.errors.join(' ')}`);
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
        { timeout: TIMEOUT, timeoutMsg: `${MAP_FILE} was not saved as expected` },
      );
      return map;
    };

    /** Runs `script` in the renderer with `model`, `modeler`, `registry`, `canvas` and `commandStack` in scope. */
    const onCanvas = async (script: string): Promise<unknown> =>
      studioAgent.executeInRenderer(`
      const editorDocument = bifrost.editors.getEditorDocumentByUri(${JSON.stringify(mapUri())});
      const model = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
      const modeler = model.modeler;
      const registry = modeler.get('elementRegistry');
      const canvas = modeler.get('canvas');
      const commandStack = modeler.get('commandStack');
      ${script}
    `);

    const waitForCanvas = async (script: string, description: string): Promise<void> => {
      await studioAgent.waitUntil(async () => (await onCanvas(script)) === true, {
        timeout: TIMEOUT,
        timeoutMsg: `Expected ${description}`,
      });
    };

    const openMap = async (): Promise<void> => {
      await studioAgent.openUriAsDocument(mapUri());
      await studioAgent.navigation.assertActivePage('discover/landscapes');
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
    };

    const element = (id: string): string => `${CANVAS} [data-element-id="${id}"]`;

    const save = async (): Promise<void> => {
      await studioAgent.sendKeyboardInput([SAVE], false);
    };

    const prepare = async ({
      collapsed = false,
      wideContents = false,
    }: { collapsed?: boolean; wideContents?: boolean } = {}): Promise<void> => {
      landscapeWorkspace = createWorkspace('bfw-landscape-hierarchy-');
      writeMap(hierarchyMap(collapsed, wideContents));
      await studioAgent.openSolutionFile(landscapeWorkspace.solutionFile);
    };

    it('collapses a group with a crossing connector, keeps the real ends in the file, and expands it again', async () => {
      await prepare();
      await openMap();

      await studioAgent.clickOn(element('team'));
      await studioAgent.clickOn('.djs-context-pad .entry[data-action="toggleCollapse"]');
      await waitForCanvas(
        `const link = registry.filter((shape) => shape.type === 'connector')[0];
       return registry.get('team').businessObject.collapsed === true && link.target.id === 'team' && link.source.id === 'note';`,
        'the connector to end at the collapsed group',
      );

      await save();
      const saved = await waitForFile((map) =>
        map.elements.some((entry) => entry.id === 'team' && 'collapsed' in entry && entry.collapsed),
      );
      expect(saved.connectors[0]).toMatchObject({ sourceId: 'note', targetId: 'order', waypoints: LINK_WAYPOINTS });
      expect(saved.elements.find((entry) => entry.id === 'order')?.parentId).toBe('team');
      expect(saved.elements.find((entry) => entry.id === 'team')).toMatchObject({ width: 400, height: 130 });

      await studioAgent.closeOpenEditors(DOCUMENT_TYPE);
      await openMap();
      await waitForCanvas(
        `const link = registry.filter((shape) => shape.type === 'connector')[0];
       return registry.get('team').businessObject.collapsed === true && link.target.id === 'team';`,
        'the reopened map to show the group collapsed',
      );

      await studioAgent.clickOn(element('team'));
      await studioAgent.clickOn('.djs-context-pad .entry[data-action="toggleCollapse"]');
      await waitForCanvas(
        `const link = registry.filter((shape) => shape.type === 'connector')[0];
       return registry.get('team').businessObject.collapsed === false
         && link.target.id === 'order' && registry.get('order').parent === registry.get('team')
         && link.waypoints.some((point) => point.x === 20 && point.y === 325);`,
        'the connector to end at the process again, with its bend',
      );
    });

    it('undoing a collapse puts the stored bends of the connector back', async () => {
      await prepare();
      await openMap();

      const isRestored = await onCanvas(
        `const link = registry.get('link');
       const original = JSON.stringify(link.businessObject.waypoints);
       // Moving the note re-lays the line out; once collapsed, the file element has to hold these new bends.
       modeler.get('modeling').moveElements([registry.get('note')], { x: 0, y: 20 });
       modeler.get('landscapeCollapse').toggle(registry.get('team'));
       const whileCollapsed = JSON.stringify(link.businessObject.waypoints);
       commandStack.undo();
       return whileCollapsed !== original
         && JSON.stringify(link.businessObject.waypoints) === original
         && link.target.id === 'order';`,
      );

      expect(isRestored).toBe(true);
    });

    it('expanding puts contents that were moved far away back inside the stored size', async () => {
      await prepare();
      await openMap();

      const fits = await onCanvas(
        `const team = registry.get('team');
       const order = registry.get('order');
       const collapse = modeler.get('landscapeCollapse');
       collapse.toggle(team);
       modeler.get('modeling').moveElements([order], { x: 3000, y: 2000 }, undefined, { autoResize: false });
       collapse.toggle(team);
       return team.width === 400 && team.height === 130 && team.x === 30 && team.y === 30
         && order.parent === team
         && order.x >= team.x && order.y >= team.y
         && order.x + order.width <= team.x + team.width && order.y + order.height <= team.y + team.height;`,
      );

      expect(fits).toBe(true);
    });

    it('expanding grows the group to the right and down only by the excess of wide contents', async () => {
      await prepare({ wideContents: true });
      await openMap();

      const grows = await onCanvas(
        `const team = registry.get('team');
       const order = registry.get('order');
       const extra = registry.get('extra');
       const collapse = modeler.get('landscapeCollapse');
       collapse.toggle(team);
       modeler.get('modeling').moveElements([extra], { x: 700, y: 0 }, undefined, { autoResize: false });
       const blockWidth = Math.max(order.x + order.width, extra.x + extra.width) - Math.min(order.x, extra.x);
       collapse.toggle(team);
       // The block is wider than the 380 units inside the border, so only the width grows, by the excess.
       return team.width === blockWidth + 20 && team.height === 130 && team.x === 30 && team.y === 30
         && order.parent === team && extra.parent === team && order.x === team.x + 10;`,
      );

      expect(grows).toBe(true);
    });

    it('the palette offers the band on the map but not on the plane of a group', async () => {
      await prepare();
      await openMap();
      await studioAgent.assertVisible('.djs-palette .entry[data-action="create-band"]', TIMEOUT);

      await onCanvas(
        `modeler.get('landscapeCollapse').toggle(registry.get('team'));
       modeler.get('landscapeDrilldown').open(registry.get('team'));`,
      );
      await studioAgent.assertNotVisible('.djs-palette .entry[data-action="create-band"]');
      await studioAgent.assertVisible('.djs-palette .entry[data-action="create-group"]', TIMEOUT);

      await onCanvas(`canvas.setRootElement(canvas.getRootElements().find((root) => root.group == null));`);
      await studioAgent.assertVisible('.djs-palette .entry[data-action="create-band"]', TIMEOUT);
    });

    it('a double-click on a collapsed group opens it, and the breadcrumb leads back', async () => {
      await prepare({ collapsed: true });
      await openMap();
      await waitForCanvas(`return registry.get('team').businessObject.collapsed === true;`, 'a collapsed group');

      await studioAgent.doubleClickOn(element('team'));

      await studioAgent.assertVisible('.landscape-breadcrumbs', TIMEOUT);
      await waitForCanvas(
        `return canvas.getRootElement().group === registry.get('team') && registry.get('order').parent === canvas.getRootElement();`,
        'the plane of the group on screen',
      );
      await studioAgent.assertVisible(element('order'), TIMEOUT);

      await studioAgent.clickOn('[data-test--landscape-breadcrumb="0"]');
      await waitForCanvas(`return canvas.getRootElement().group == null;`, 'the top-level map on screen');
      await waitForCanvas(
        `return canvas.getContainer().querySelector('.landscape-breadcrumbs').style.display === 'none';`,
        'the breadcrumbs to be hidden',
      );
    });

    it('undoing a collapse while drilled into the group returns to the map', async () => {
      await prepare();
      await openMap();

      await onCanvas(`modeler.get('landscapeCollapse').toggle(registry.get('team'));`);
      await waitForCanvas(
        `return registry.get('team').businessObject.collapsed === true;`,
        'the group to be collapsed',
      );
      await onCanvas(`modeler.get('landscapeDrilldown').open(registry.get('team'));`);
      await waitForCanvas(`return canvas.getRootElement().group === registry.get('team');`, 'the group to be open');

      await onCanvas(`commandStack.undo();`);

      await waitForCanvas(
        `return canvas.getRootElement().group == null
         && registry.get('team').businessObject.collapsed === false
         && registry.get('order').parent === registry.get('team');`,
        'the map on screen with the group expanded',
      );
    });

    it('a reopened collapsed group draws one line to the group, counting its relations', async () => {
      await prepare({ collapsed: true });
      await openMap();

      await waitForCanvas(
        `return registry.get(${JSON.stringify(CALL_LINE_TO_GROUP)}) != null;`,
        'the relation line to end at the group',
      );
      await waitForCanvas(
        `return registry.getGraphics(${JSON.stringify(CALL_LINE_TO_GROUP)}).querySelector('.landscape-label')?.textContent === '1';`,
        'the line to count one relation',
      );
    });

    it('level names can be added and renamed, and a group shows the name of its depth', async () => {
      await prepare();
      await openMap();
      await studioAgent.assertPaneVisible(PROPERTIES_PANE);

      await studioAgent.clickOn('[data-test--landscape-level-add]');
      await studioAgent.assertVisible('[data-test--landscape-level="0"]', TIMEOUT);
      await studioAgent.clearTextInput('[data-test--landscape-level="0"]');
      await studioAgent.sendKeyboardInput([...'Domain'.split(''), 'enter']);

      await studioAgent.clickOn(element('team'));
      await studioAgent.assertVisible('[data-test--landscape-property="level"]', TIMEOUT);
      expect(await studioAgent.getValue('[data-test--landscape-property="level"]')).toBe('Domain');

      await studioAgent.clickOn(CANVAS);
      await save();
      const saved = await waitForFile((map) => map.levels.length === 1);
      expect(saved.levels[0].name).toBe('Domain');
    });

    it('refuses a band inside a group', async () => {
      await prepare();
      await openMap();

      const isAllowed = await onCanvas(
        `const band = modeler.get('elementFactory').createShape({
         type: 'band', width: 1200, height: 240,
         businessObject: { id: 'probe', type: 'band', parentId: null, label: 'Probe', style: null },
       });
       return modeler.get('rules').allowed('shape.create', { shape: band, target: registry.get('team') });`,
      );

      expect(isAllowed).toBe(false);
    });
  });
});
