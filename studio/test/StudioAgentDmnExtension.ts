import * as path from 'path';

import { OsSpecificKeystroke } from './OsSpecificKeystroke';
import type { TestContext } from './StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, StudioAgent, createAndStartStudioAgent } from './StudioAgent';

const FIT_DIAGRAM_TO_VIEWPORT = OsSpecificKeystroke('cmd-2', 'ctrl-2');

function getFixtures(fixtureName: string): string {
  return path.join(__dirname, 'fixtures', fixtureName);
}

function getFixturesFilename(fixtureName: string, filename: string): string {
  return path.join(__dirname, 'fixtures', fixtureName, filename);
}

export async function createAndStartStudioAgentDmnExtension(
  testContext: TestContext,
  solutionFixtureName?: string,
  filename?: string,
): Promise<StudioAgentDmnExtension> {
  const additionalCliArgs: string[] = [];

  if (solutionFixtureName) {
    additionalCliArgs.push('--test-solution=' + getFixtures(solutionFixtureName));

    if (filename) {
      additionalCliArgs.push('--test-file=' + getFixturesFilename(solutionFixtureName, filename));
    }
  }

  const dmnExtensionAgent = await createAndStartStudioAgent<StudioAgentDmnExtension>(
    testContext,
    StudioAgentDmnExtension,
    additionalCliArgs,
  );

  return dmnExtensionAgent;
}

export class StudioAgentDmnExtension extends StudioAgent {
  async waitForInteractiveDmnDocument(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<true> {
    const element = this.testDriver.client!.$('[data-test--dmn-document-is-interactive="true"]');
    return element.waitForExist({ timeout: timeout });
  }

  async assertViewSwitcherVisible(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    await this.assertVisible('.dmn-view-switcher', timeout);
  }

  async assertBackToDrdButtonVisible(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    await this.assertVisible('[data-test--dmn-view-switcher-back]', timeout);
  }

  async assertBackToDrdButtonNotPresent(): Promise<void> {
    const elements = await this.testDriver.client!.$$('[data-test--dmn-view-switcher-back]');
    if (elements.length > 0) {
      throw new Error('Expected "Back to DRD" button to not be present, but it was found');
    }
  }

  async getViewSwitcherItemCount(): Promise<number> {
    const elements = await this.testDriver.client!.$$('[data-test--dmn-view-switcher-item]');
    return elements.length;
  }

  async fitDiagramToViewport(): Promise<void> {
    await this.sendKeyboardInput([FIT_DIAGRAM_TO_VIEWPORT]);
    await this.pause(200);
  }

  async selectDmnElementById(elementId: string): Promise<void> {
    await this.fitDiagramToViewport();
    await this.clickOn(`[data-element-id=${elementId}]`);
  }

  async selectDmnElementByIdAndWaitForElement(
    elementId: string,
    waitForSelector?: string,
    timeout?: number,
    retryCount = 0,
  ): Promise<void> {
    await this.selectDmnElementById(elementId);

    const selectedElements = await this.$$(`[data-element-id=${elementId}].selected`);
    if ((await selectedElements.length) === 0) {
      if (retryCount < 5) {
        return this.selectDmnElementByIdAndWaitForElement(elementId, waitForSelector, timeout, retryCount + 1);
      } else {
        throw new Error(`Could not select DMN element with id ${elementId}`);
      }
    }

    if (waitForSelector != null) {
      try {
        const timeoutToUse = timeout ? timeout / 5 : undefined;
        await this.assertVisible(waitForSelector, timeoutToUse);
      } catch (error) {
        if (retryCount < 5) {
          return this.selectDmnElementByIdAndWaitForElement(elementId, waitForSelector, timeout, retryCount + 1);
        }
        throw error;
      }
    }

    await this.pause(250);
  }

  async clickOnDrdCanvas(): Promise<void> {
    await this.fitDiagramToViewport();
    await this.clickOn('.dmn-drd-container .djs-container');
    await this.pause(300);
  }

  async drillDownIntoDecisionTable(decisionElementId: string): Promise<void> {
    await this.clickOnViewSwitcherItem(decisionElementId);
    await this.assertBackToDrdButtonVisible();
  }

  async navigateBackToDrd(): Promise<void> {
    await this.clickOn('[data-test--dmn-view-switcher-back]');
    await this.pause(500);
  }

  async clickOnViewSwitcherItem(viewId: string, timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    const selector = `[data-test--dmn-view-switcher-item="${viewId}"]`;
    await this.assertVisible(selector, timeout);
    await this.clickOn(selector);
    await this.pause(300);
  }

  async getActiveViewType(): Promise<string | null> {
    return (await this.testDriver.client!.execute(() => {
      const editorDocument = (window as any).bifrost?.editors?.getFocusedEditorDocument?.();
      if (!editorDocument) {
        return null;
      }
      const model = (window as any).bifrost?.editors?.getEditorDocumentModelSync?.(editorDocument);
      return model?.getActiveViewType?.() ?? null;
    })) as string | null;
  }

  async getDmnPropertyValue(dataTestAttribute: string): Promise<string> {
    const selector = `[${dataTestAttribute}]`;
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    return this.getValue(selector);
  }

  async setDmnPropertyValue(dataTestAttribute: string, newValue: string): Promise<void> {
    const selector = `[${dataTestAttribute}]`;
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    await this.clearTextInput(selector);
    await this.sendKeyboardInput([...newValue.split('')]);
    await this.sendKeyboardInput(['Tab'], false);
    await this.pause(200);
  }

  async getDmnPropertyText(dataTestAttribute: string): Promise<string> {
    const selector = `[${dataTestAttribute}]`;
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    const value = await this.getValue(selector);
    if (value != null && value !== '') {
      return value;
    }
    return this.getText(selector);
  }

  async selectDmnDropdownOption(selectHtmlId: string, optionValue: string): Promise<void> {
    const controlSelector = `#${selectHtmlId} .react-select__control`;
    await this.assertVisible(controlSelector, ASSERT_VISIBLE_TIMEOUT);
    await this.clickOn(controlSelector);
    await this.pause(300);

    const optionSelector = `[data-test-option-value="${optionValue}"]`;
    await this.assertVisible(optionSelector, ASSERT_VISIBLE_TIMEOUT);
    await this.clickOn(optionSelector);
    await this.pause(300);
  }

  async getDmnSelectValue(selectHtmlId: string): Promise<string> {
    const valueSelector = `#${selectHtmlId} .react-select__single-value`;
    await this.assertVisible(valueSelector, ASSERT_VISIBLE_TIMEOUT);
    return this.getText(valueSelector);
  }

  async waitForPaneVisible(paneId: string, timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    await this.assertVisible(`[data-test--pane="${paneId}"]`, timeout);
  }

  async waitForPaneNotVisible(paneId: string): Promise<void> {
    const elements = await this.testDriver.client!.$$(`[data-test--pane="${paneId}"]`);
    for (const element of elements) {
      const displayed = await element.isDisplayed();
      if (displayed) {
        throw new Error(`Expected pane "${paneId}" to not be visible, but it was`);
      }
    }
  }
}
