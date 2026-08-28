import * as assert from 'node:assert';
import * as path from 'path';
import { Key } from 'webdriverio';

import { OsSpecificKeystroke } from './OsSpecificKeystroke';
import type { TestContext } from './StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, StudioAgent, createAndStartStudioAgent } from './StudioAgent';

const FIT_DIAGRAM_TO_VIEWPORT = OsSpecificKeystroke('cmd-2', 'ctrl-2');

export async function createAndStartStudioAgentBpmnExtension(
  testContext: TestContext,
  solutionFixtureName?: string,
  filename?: string,
): Promise<StudioAgentBpmnExtension> {
  const additionalCliArgs: string[] = [];

  if (solutionFixtureName) {
    additionalCliArgs.push('--test-solution=' + getFixtures(solutionFixtureName));

    if (filename) {
      additionalCliArgs.push('--test-file=' + getFixturesFilename(solutionFixtureName, filename));
    }
  }

  const bpmnExtensionAgent = await createAndStartStudioAgent<StudioAgentBpmnExtension>(
    testContext,
    StudioAgentBpmnExtension,
    additionalCliArgs,
  );

  return bpmnExtensionAgent;
}

export class StudioAgentBpmnExtension extends StudioAgent {
  private async selectBpmnElementById(name: string): Promise<void> {
    await this.fitDiagramToViewport();
    await this.clickOn(`[data-element-id=${name}]`);
  }

  /*
   * This function repeats the element selection if the expected Element is not visible.
   * This is necessary because of this issue:
   * https://github.com/atlas-engine/atlasstudio/issues/339
   */
  async selectBpmnElementByIdAndWaitForElement(
    bpmnElementId: string,
    elementId?: string,
    timeout?: number,
    retryCount = 0,
  ): Promise<void> {
    await this.selectBpmnElementById(bpmnElementId);

    const selectedElements = await this.$$(`[data-element-id=${bpmnElementId}].selected`);
    if ((await selectedElements.length) === 0) {
      if (retryCount < 5) {
        return this.selectBpmnElementByIdAndWaitForElement(bpmnElementId, elementId, timeout, retryCount + 1);
      } else {
        throw new Error(`Could not select element with id ${bpmnElementId}`);
      }
    }

    if (elementId != null) {
      try {
        const timeoutToUse = timeout ? timeout / 5 : undefined;
        await this.assertVisible(elementId, timeoutToUse);
      } catch (error) {
        if (retryCount < 5) {
          return this.selectBpmnElementByIdAndWaitForElement(bpmnElementId, elementId, timeout, retryCount + 1);
        }

        throw error;
      }
    }

    await this.pause(250);
  }

  async rightClickBpmnElementById(name: string): Promise<void> {
    await this.fitDiagramToViewport();
    await this.rightClickOn(`[data-element-id=${name}]`);
  }
  async fitDiagramToViewport(): Promise<void> {
    await this.sendKeyboardInput([FIT_DIAGRAM_TO_VIEWPORT]);
  }
  /**
   * This method clicks on a BPMN element with the given `elementId` which are leaky,
   * e.g. Groups, Lanes etc.
   */
  async selectLeakyBpmnElementById(elementId: string): Promise<void> {
    const selector = `[data-element-id=${elementId}]`;
    await this.fitDiagramToViewport();
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    const element = await this.testDriver.client!.$(selector);
    const elementLocation = await element.getLocation();
    await this.testDriver.client!.performActions([
      {
        type: 'pointer',
        id: 'performMouseClick',
        actions: [
          {
            type: 'pointerMove',
            duration: 0,
            x: Math.ceil(elementLocation.x) + 2,
            y: Math.ceil(elementLocation.y) + 2,
          },
          {
            type: 'pointerDown',
            button: 0,
          },
          {
            type: 'pointerUp',
            button: 0,
          },
        ],
      },
    ]);
  }
  async selectProcessRootById(elementId: string): Promise<void> {
    const selector = `[data-element-id=${elementId}]`;
    await this.fitDiagramToViewport();
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    const element = await this.testDriver.client!.$(selector);
    const elementLocation = await element.getLocation();
    await this.testDriver.client!.performActions([
      {
        type: 'pointer',
        id: 'performMouseClick',
        actions: [
          {
            type: 'pointerMove',
            duration: 0,
            x: Math.ceil(elementLocation.x) + 60,
            y: Math.ceil(elementLocation.y) + 30,
          },
          {
            type: 'pointerDown',
            button: 0,
          },
          {
            type: 'pointerUp',
            button: 0,
          },
        ],
      },
    ]);
  }
  async selectParticipantById(elementId: string): Promise<void> {
    const selector = `[data-element-id=${elementId}]`;
    await this.fitDiagramToViewport();
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    const element = await this.testDriver.client!.$(selector);
    const elementLocation = await element.getLocation();
    await this.testDriver.client!.performActions([
      {
        type: 'pointer',
        id: 'performMouseClick',
        actions: [
          {
            type: 'pointerMove',
            duration: 0,
            x: Math.ceil(elementLocation.x) + 5,
            y: Math.ceil(elementLocation.y) + 5,
          },
          {
            type: 'pointerDown',
            button: 0,
          },
          {
            type: 'pointerUp',
            button: 0,
          },
        ],
      },
    ]);
  }
  async selectMultipleBpmnElementsByIds(elementIds: string[]): Promise<void> {
    await this.fitDiagramToViewport();
    for (const elementId of elementIds) {
      await this.assertVisible(`[data-element-id=${elementId}]`, ASSERT_VISIBLE_TIMEOUT);
      const element = await this.testDriver.client!.$(`[data-element-id=${elementId}]`);
      const elementLocation = await element.getLocation();
      await this.testDriver.client!.performActions([
        {
          type: 'key',
          id: 'performShiftDown',
          actions: [
            {
              type: 'keyDown',
              value: Key.Shift,
            },
          ],
        },
        {
          type: 'pointer',
          id: 'performMouseClick',
          actions: [
            {
              type: 'pointerMove',
              duration: 0,
              x: Math.ceil(elementLocation.x),
              y: Math.ceil(elementLocation.y),
            },
            {
              type: 'pointerDown',
              button: 0,
            },
            {
              type: 'pointerUp',
              button: 0,
            },
          ],
        },
        {
          type: 'key',
          id: 'performShiftUp',
          actions: [
            {
              type: 'keyUp',
              value: Key.Shift,
            },
          ],
        },
      ]);
    }
    const count = await this.getCountOfSelectedBpmnElements();
    assert.strictEqual(count, elementIds.length);
  }

  async waitForInteractiveBpmnDocument(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<true> {
    const element = await this.testDriver.client!.$('[data-test--bpmn-document-is-interactive="true"]');
    return element.waitForExist({ timeout: timeout });
  }

  async drillDownIntoSubprocess(subprocessId: string): Promise<void> {
    await this.selectBpmnElementByIdAndWaitForElement(subprocessId);
    await this.executeCommand('bpmn.editor.drillDown');
    await this.pause(500);
  }

  async drillUpFromSubprocess(): Promise<void> {
    await this.executeCommand('bpmn.editor.drillUp');
    await this.pause(500);
  }

  async clickDrilldownOverlay(subprocessId: string): Promise<void> {
    await this.fitDiagramToViewport();
    const selector = `.djs-overlays[data-container-id="${subprocessId}"] .bjs-drilldown`;
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    await this.clickOn(selector);
    await this.pause(500);
  }

  async assertBreadcrumbsVisible(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    const element = await this.testDriver.client!.$('[data-test--bpmn-breadcrumb-bar]');
    await element.waitForExist({ timeout });
  }

  async assertBreadcrumbsNotVisible(): Promise<void> {
    const items = await this.$$('[data-test--bpmn-breadcrumb-bar]');
    assert.strictEqual(await items.length, 0, 'Expected no breadcrumb bar on the root plane');
  }

  async isInsideSubprocessPlane(): Promise<boolean> {
    return (await this.testDriver.client!.execute(() => {
      const bifrost = (window as any).bifrost;
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null) {
        return false;
      }
      const model = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
      if (model == null || model.elements == null) {
        return false;
      }
      return model.elements.isInsideSubprocessPlane();
    })) as boolean;
  }

  async getBpmnCanvasRootId(): Promise<string | null> {
    return (await this.testDriver.client!.execute(() => {
      const bifrost = (window as any).bifrost;
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null) {
        return null;
      }
      const model = bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
      if (model == null) {
        return null;
      }
      return model.modelerAdapter.getCanvas().getRootElement()?.id ?? null;
    })) as string | null;
  }

  async getDrilldownOverlayCount(): Promise<number> {
    const overlays = await this.$$('.bjs-drilldown');
    return await overlays.length;
  }

  private async getCountOfSelectedBpmnElements(): Promise<number> {
    const selectorResult = await this.$$('.djs-element.djs-shape.selected');
    return await selectorResult.length;
  }
}

function getFixtures(fixtureName: string): string {
  return path.join(__dirname, 'fixtures', fixtureName);
}

function getFixturesFilename(fixtureName: string, filename: string): string {
  return path.join(__dirname, 'fixtures', fixtureName, filename);
}
