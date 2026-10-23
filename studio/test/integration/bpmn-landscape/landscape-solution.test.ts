import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { LandscapeWorkspace } from './landscapeWorkspace';
import { createLandscapeWorkspace } from './landscapeWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const CANVAS = '[data-test--landscape-canvas]';
const MAPS_TREE = '[data-test--tree="std/file-explorer/landscapes"]';
const SAVE = OsSpecificKeystroke('cmd-s', 'ctrl-s');

const box = (id: string, x: number, y: number) => ({ id, parentId: null, x, y, width: 140, height: 60, style: null });
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

describe('bpmn-landscape/landscape-solution', () => {
  let studioAgent: StudioAgent;
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

  beforeEach(async ({ task }) => {
    landscapeWorkspace = createLandscapeWorkspace('bfw-landscape-solution-');
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

  it('a missing process is greyed, Review selects it and Replace repairs it', async () => {
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
            .getAllNotifications()
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
          (element) => element.id === 'ghost' && element.type === 'process' && element.processId === 'payment-process',
        ),
      { timeout: TIMEOUT, timeoutMsg: 'The replaced process was not saved' },
    );
  });

  it('dropping a reference leaves a placeholder that keeps its connector', async () => {
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
