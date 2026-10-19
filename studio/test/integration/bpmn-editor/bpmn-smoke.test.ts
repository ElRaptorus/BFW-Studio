import * as fs from 'fs';
import assert from 'node:assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const CREATE_NEW_DOCUMENT = OsSpecificKeystroke('cmd-n', 'ctrl-n');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(content: Buffer): boolean {
  return content.length > 24 && content.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(content: Buffer): boolean {
  return (
    content.length > 4 &&
    content[0] === 0xff &&
    content[1] === 0xd8 &&
    content.at(-2) === 0xff &&
    content.at(-1) === 0xd9
  );
}

function isWebp(content: Buffer): boolean {
  return (
    content.length > 12 &&
    content.toString('ascii', 0, 4) === 'RIFF' &&
    content.toString('ascii', 8, 12) === 'WEBP' &&
    content.readUInt32LE(4) + 8 === content.length
  );
}

describe('bpmn/smoke', () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    fs.mkdirSync('tmp', { recursive: true });
    studioAgent = await createAndStartStudioAgentBpmnExtension({ testName: 'setup', testFile: __filename });
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
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
    await studioAgent.closeOpenEditors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  async function exportDocumentAs(format: string, filename: string): Promise<void> {
    fs.rmSync(filename, { force: true });

    await studioAgent.openViaCommandSearch('Test: Export document as');
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...format.split(''), 'enter']);
    await studioAgent.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.sendKeyboardInput([...filename.split(''), 'enter']);
  }

  /** The file appears before it is completely written, so the content check is polled. */
  async function waitForFileContent(
    filename: string,
    isExpectedContent: (content: Buffer) => boolean,
    timeoutMessage: string,
  ): Promise<void> {
    await studioAgent.waitUntil(async () => fs.existsSync(filename) && isExpectedContent(fs.readFileSync(filename)), {
      timeout: ASSERT_VISIBLE_TIMEOUT,
      timeoutMsg: timeoutMessage,
    });
  }

  async function waitForExportHintToClose(): Promise<void> {
    await studioAgent.waitUntil(async () => (await studioAgent.$$('[data-test--dialog]').length) === 0, {
      timeout: ASSERT_VISIBLE_TIMEOUT,
      timeoutMsg: 'The export hint dialog did not close after the export',
    });
  }

  it('bpmn/smoke/export: should export PNG, JPEG and WebP images in their real formats', async () => {
    const expectedFormats = [
      { format: 'png', filename: 'tmp/test-export-bpmn-format.png', isFormat: isPng },
      { format: 'jpeg', filename: 'tmp/test-export-bpmn-format.jpg', isFormat: isJpeg },
      { format: 'webp', filename: 'tmp/test-export-bpmn-format.webp', isFormat: isWebp },
    ];

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    for (const { format, filename, isFormat } of expectedFormats) {
      await exportDocumentAs(format, filename);
      await waitForFileContent(filename, isFormat, `${filename} is not a ${format} image`);
      await waitForExportHintToClose();
    }

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/smoke/export: should export raster images at twice the size of the diagram', async () => {
    const svgFilename = 'tmp/test-export-bpmn-scale.svg';
    const pngFilename = 'tmp/test-export-bpmn-scale.png';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await exportDocumentAs('svg', svgFilename);
    await waitForFileContent(svgFilename, (content) => content.toString().includes('</svg>'), 'SVG was not written');
    await exportDocumentAs('png', pngFilename);
    await waitForFileContent(pngFilename, isPng, 'PNG was not written');

    const svg = fs.readFileSync(svgFilename, 'utf8');
    const svgWidth = Number(/<svg[^>]*\swidth="(\d+)/.exec(svg)?.[1]);
    const svgHeight = Number(/<svg[^>]*\sheight="(\d+)/.exec(svg)?.[1]);
    const png = fs.readFileSync(pngFilename);

    assert.strictEqual(png.readUInt32BE(16), svgWidth * 2, 'PNG width');
    assert.strictEqual(png.readUInt32BE(20), svgHeight * 2, 'PNG height');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/smoke/contextmenu: should show contextmenu for a call activity', async () => {
    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('CallActivity_1');
    await studioAgent.rightClickBpmnElementById('CallActivity_1');

    await studioAgent.assertContextMenuVisible(2000);

    await studioAgent.assertNoErrorsPresent();
  });

  it('bpmn/smoke/inspector: should follow the selection in every Selection Inspector column', async () => {
    const columnSelectors = [
      '#editor-inspector-selected-element',
      '#editor-inspector-selected-element-from-modeler',
      '#editor-inspector-selected-element-business-object',
    ];
    const readColumns = (): Promise<string[]> =>
      Promise.all(columnSelectors.map((selector) => studioAgent.getCodeEditorRenderedText(selector)));
    const waitForColumnsToShow = async (elementId: string, otherElementId: string): Promise<void> => {
      await studioAgent.waitUntil(
        async () =>
          (await readColumns()).every(
            (text) => text.includes(`"${elementId}"`) && !text.includes(`"${otherElementId}"`),
          ),
        { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `Selection Inspector columns did not show ${elementId}` },
      );
    };

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();
    await studioAgent.executeCommand('bpmn.workbench.openOrFocusInspector');

    await studioAgent.selectBpmnElementByIdAndWaitForElement('ReceiveTask_1');
    await waitForColumnsToShow('ReceiveTask_1', 'ReceiveTask_2');

    await studioAgent.selectBpmnElementByIdAndWaitForElement('ReceiveTask_2');
    await waitForColumnsToShow('ReceiveTask_2', 'ReceiveTask_1');

    await studioAgent.assertNoErrorsPresent();
  });
});
