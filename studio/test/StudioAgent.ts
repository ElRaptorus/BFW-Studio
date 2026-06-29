import * as fs from 'fs';
import * as assert from 'node:assert';
import * as os from 'os';
import * as path from 'path';
import type { ChainablePromiseArray } from 'webdriverio';
import { Key } from 'webdriverio';

import type { StartPaths } from './Driver/TestDriver';
import TestDriver from './Driver/TestDriver';
import { OsSpecificKeystroke } from './OsSpecificKeystroke';
import InputSimulator from './StudioAgent/InputSimulator';
import LeftMenuBar from './StudioAgent/LeftMenuBar';
import LogCapture from './StudioAgent/LogCapture';
import ScreenCapture from './StudioAgent/ScreenCapture';

function getElectronPath(): string {
  return require('electron/index') as string;
}

const QUERY_QUICK_JUMP = '[data-test--quick-jump]';
const QUERY_DIALOG = '[data-test--dialog]';
const QUERY_VISIBLE_CONTEXTMENU = '.react-contextmenu--visible[tabindex="-1"]';

const SHOW_QUICK_JUMP_COMMANDS = OsSpecificKeystroke('cmd-shift-p', 'ctrl-shift-p');
const SHOW_QUICK_JUMP = OsSpecificKeystroke('cmd-j', 'ctrl-j');

const ILLEGAL_FILENAME_CHARS_REGEX = /[^a-z0-9-_.]/gi;

export interface TestContext {
  testName: string;
  testFile: string;
  state?: 'passed' | 'failed';
  error?: Error;
}

export const ASSERT_VISIBLE_TIMEOUT = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ]);
}

const webdriverLogPath = path.join(__dirname, '..', 'tmp', 'logs', 'webdriver');
const studioAgentLogPath = path.join(__dirname, '..', 'tmp', 'logs', 'studioagent');

const executablePath = process.env.TEST_APP_PATH;
const electronBundlePath = path.join(__dirname, '..', 'out', 'bundle-electron-main.js');

let isRetryOnStartupError = false;

export async function createAndStartStudioAgent<T extends StudioAgent>(
  testContext: TestContext,
  studioAgentClass: any = StudioAgent,
  cliArgsForBifrost: string[] = [],
): Promise<T> {
  let studioAgent: T | null = null;

  try {
    const studioCliArgs = [...cliArgsForBifrost];

    const paths = {
      executable: executablePath,
      electron: executablePath ? '' : getElectronPath(),
      electronBundle: electronBundlePath,
    };

    studioAgent = await StudioAgent.start<T>(testContext, paths, studioCliArgs, studioAgentClass);

    return studioAgent;
  } catch (error: any) {
    console.error('Failed to Start Studio Agent:', error);

    if (
      (error.type === 'RuntimeError' || error.message.includes('Failed to create session')) &&
      !isRetryOnStartupError
    ) {
      isRetryOnStartupError = true;
      if (studioAgent != null) {
        await studioAgent?.stopAndRecordErrors();
      }

      return await createAndStartStudioAgent(testContext, studioAgentClass, cliArgsForBifrost);
    }

    throw error;
  }
}

export class StudioAgent {
  public leftMenuBar: LeftMenuBar;

  protected testDriver: TestDriver;

  private screenCapture: ScreenCapture;
  private inputSimulator: InputSimulator;
  private logCapture: LogCapture;
  private timeStampForTestDataBackups = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  private testContext: TestContext;

  constructor(testContext: TestContext, testDriver: TestDriver) {
    this.testContext = testContext;
    this.testDriver = testDriver;
    this.screenCapture = new ScreenCapture(this, this.testDriver, './tmp/', `${new Date().getTime()}`);
    this.logCapture = new LogCapture(this, this.testDriver, './tmp/logs/', `${new Date().getTime()}`);
    this.inputSimulator = new InputSimulator(this.testDriver);

    this.leftMenuBar = new LeftMenuBar(this);

    this.testDriver.client!.addLocatorStrategy('querySelectorAll', (selector: any) => {
      const result = document.querySelectorAll(selector);
      return result as any;
    });
  }

  static async start<T = StudioAgent>(
    testContext: TestContext,
    startPaths: StartPaths,
    studioCliArgs: string[],
    StudioAgentClass: any = StudioAgent,
  ): Promise<T> {
    if (!fs.existsSync(webdriverLogPath)) {
      fs.mkdirSync(webdriverLogPath, { recursive: true });
    }

    if (!fs.existsSync(studioAgentLogPath)) {
      fs.mkdirSync(studioAgentLogPath, { recursive: true });
    }

    const testDriver = new TestDriver({
      paths: startPaths,
      args: [...studioCliArgs, '---'],
      env: process.env,
      webdriverLogPath: webdriverLogPath,
    });

    await testDriver.start();

    const studioAgent = new StudioAgentClass(testContext, testDriver);

    await studioAgent.awaitReadyness();
    return studioAgent as T;
  }

  appIsRunning(): boolean {
    return this.testDriver.isRunning();
  }

  getTestDriver(): TestDriver {
    return this.testDriver;
  }

  getTestContext(): TestContext {
    return this.testContext;
  }

  getNormalizedTestTitle(): string {
    const testTitle = `_${path.basename(this.testContext.testFile)}__${this.testContext.testName}`;
    const filenameSuffix = testTitle.replace(ILLEGAL_FILENAME_CHARS_REGEX, '-');

    return filenameSuffix;
  }

  updateTestContext(testContext: TestContext): void {
    this.testContext = testContext;
  }

  async stop(warnAboutAppNotRunning: boolean = true): Promise<void> {
    if (this.appIsRunning()) {
      await this.stopApp();
    } else if (warnAboutAppNotRunning) {
      console.warn('Unexpected state: App is not running');
    }
    await this.cleanup();
  }

  async stopAndRecordErrors(warnAboutAppNotRunning: boolean = true): Promise<void> {
    if (this.appIsRunning()) {
      await this.recordErrors();
      await this.stopApp();
    } else if (warnAboutAppNotRunning) {
      console.warn('Unexpected state: App is not running');
    }
    await this.cleanup();
  }

  async recordErrors(): Promise<void> {
    if (this.testContext.state !== 'failed') {
      return;
    }

    await this.snapshotCurrentTestdata();

    try {
      const screenshotFilename = await withTimeout(this.screenCapture.image(), 10_000);
      console.error(`\nScreenshot saved: ${screenshotFilename}\n`);
    } catch {
      console.error('\nFailed to capture screenshot (session may be dead)\n');
    }

    try {
      await withTimeout(this.logCapture.log(), 10_000);
    } catch {
      console.error('Failed to capture logs (session may be dead)');
    }
  }

  async awaitReadyness(): Promise<void> {
    await this.testDriver.waitForReady();
    await (this.testDriver.client! as any).waitUntilWindowLoaded();
    const element = await this.testDriver.client!.$('.bifrost');
    await element.waitForDisplayed({ timeout: ASSERT_VISIBLE_TIMEOUT });
  }

  async maximize(): Promise<void> {
    this.testDriver.maximizeWindow();
  }

  async openViaCommandSearch(query: string, assertNotVisibleAfterwards: boolean = true): Promise<void> {
    await this.waitForNotVisible(QUERY_QUICK_JUMP);
    await this.sendKeyboardInput([SHOW_QUICK_JUMP_COMMANDS]);
    await this.assertVisible(QUERY_QUICK_JUMP, ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...query.split(''), 'enter']);
    if (assertNotVisibleAfterwards) {
      await this.waitForNotVisible(QUERY_QUICK_JUMP);
    }
  }

  async openFixturesDirectoryAsSolution(fixtureName: string): Promise<void> {
    await this.openDirectoryAsSolution(path.join('test', 'fixtures', fixtureName));
  }

  async openDirectoryAsSolution(directory: string): Promise<void> {
    await this.openViaCommandSearch('Test: Open URI as solution');
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await this.sendKeyboardInput([...`file://${directory}`.split(''), 'enter'], false);

    await this.assertVisible('[data-test--tree="std/file-explorer/open-solution"]', ASSERT_VISIBLE_TIMEOUT);
    await this.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  }

  async openSolutionFileFromFixtures(esslnFilename: string): Promise<void> {
    const esslnUri = 'file://' + path.join(__dirname, 'fixtures', esslnFilename);
    await this.openViaCommandSearch('Test: Open URI as solution');
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await this.sendKeyboardInput([...esslnUri.split(''), 'enter'], false);

    await this.assertVisible('[data-test--tree="std/file-explorer/open-solution"]', ASSERT_VISIBLE_TIMEOUT);
    await this.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  }

  async getSolutionProjectCount(): Promise<number> {
    return (await this.testDriver.client!.execute(
      `return bifrost.solution.getSolution()?.projects?.length ?? 0`,
    )) as number;
  }

  async getSolutionFileUri(): Promise<string | null> {
    return (await this.testDriver.client!.execute(`return bifrost.solution.getSolution()?.solutionFileUri ?? null`)) as
      string | null;
  }

  async addFolderToSolutionViaApi(directoryUri: string): Promise<void> {
    await this.openViaCommandSearch('Test: Add folder to solution', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...directoryUri.split(''), 'enter'], false);
    await this.pause(500);
    await this.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  }

  async removeFolderFromSolutionViaApi(projectId: string): Promise<void> {
    await this.openViaCommandSearch('Test: Remove folder from solution', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...projectId.split(''), 'enter'], false);
    await this.pause(500);
    await this.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  }

  async getSolutionProjectIds(): Promise<string[]> {
    return (await this.testDriver.client!.execute(
      `return (bifrost.solution.getSolution()?.projects ?? []).map(p => p.id)`,
    )) as string[];
  }

  async getProjectEntryCount(): Promise<number> {
    return this.getElementCount(
      '[data-test--tree="std/file-explorer/open-solution"] [data-test--tree-entry-type="project"]',
    );
  }

  async executeInRenderer(script: string): Promise<unknown> {
    return this.testDriver.client!.execute(script);
  }

  async executeCommand(commandId: string, args: unknown[] = []): Promise<unknown> {
    return this.testDriver.client!.execute(
      (cmd: string, cmdArgs: unknown[]) => (window as any).bifrost.commands.executeCommand(cmd, cmdArgs),
      commandId,
      args,
    );
  }

  async renameSolutionProjectViaApi(projectBaseUri: string, newName: string): Promise<void> {
    await this.openViaCommandSearch('Test: Rename project in solution', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...projectBaseUri.split(''), 'enter'], false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...newName.split(''), 'enter'], false);
    await this.pause(500);
    await this.waitForNotVisible(
      '[data-test--tree="std/file-explorer/open-solution"] .treeview__entry--loading-indicator',
    );
  }

  async closeSolutionViaApi(): Promise<void> {
    await this.openViaCommandSearch('Test: Close solution');
    await this.pause(500);
  }

  async isSolutionDirty(): Promise<boolean> {
    return (await this.testDriver.client!.execute(`return bifrost.solution.isSolutionDirty()`)) as boolean;
  }

  async isExplicitSolution(): Promise<boolean> {
    return (await this.testDriver.client!.execute(
      `return bifrost.solution.getSolution()?.isExplicitSolution === true`,
    )) as boolean;
  }

  async hasOpenSolution(): Promise<boolean> {
    return (await this.testDriver.client!.execute(`return bifrost.solution.hasOpenSolution()`)) as boolean;
  }

  async isCommandEnabled(commandName: string): Promise<boolean> {
    return (await this.testDriver.client!.execute(
      `return bifrost.commands.isCommandEnabled('${commandName}')`,
    )) as boolean;
  }

  async getProjectBaseUri(index: number = 0): Promise<string | null> {
    return (await this.testDriver.client!.execute(
      `return bifrost.solution.getSolution()?.projects?.[${index}]?.baseUri ?? null`,
    )) as string | null;
  }

  async getFocusedDocumentUri(): Promise<string> {
    return (await this.testDriver.client!.execute(
      `return document.querySelector('[data-test--editors--focused-uri]')?.getAttribute('data-test--editors--focused-uri') ?? ''`,
    )) as string;
  }

  getFixturesAbsolutePath(fixtureName: string): string {
    return path.join(__dirname, 'fixtures', fixtureName);
  }

  getFixturesAbsoluteFileUri(fixtureName: string): string {
    return 'file://' + path.join(__dirname, 'fixtures', fixtureName);
  }

  async openFile(uri: string): Promise<void> {
    await this.openViaCommandSearch('Test: Open URI as document');
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await this.sendKeyboardInput([...uri.split(''), 'enter']);
  }

  async openViaQuickJump(query: string): Promise<void> {
    await this.waitForNotVisible(QUERY_QUICK_JUMP);
    await this.sendKeyboardInput([SHOW_QUICK_JUMP]);
    await this.assertVisible(QUERY_QUICK_JUMP, ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...query.split(''), 'enter'], false);
    await this.waitForNotVisible(QUERY_QUICK_JUMP);
  }

  async openUriAsDocument(uri: string): Promise<void> {
    await this.openViaCommandSearch('Test: Open URI as document');
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);

    await this.sendKeyboardInput([...uri.split(''), 'enter']);

    const uriForSelector = await this.getUriForSelector(uri);
    await this.assertVisible(`[data-test--editors--focused-uri="${uriForSelector}"]`, ASSERT_VISIBLE_TIMEOUT);
  }

  async openFixturesDirectoryAsSolutionAndJumpToFile(fixtureName: string, filename: string): Promise<void> {
    const fixtureUri = this.getFixturesFileUri(fixtureName, filename);

    await this.openFixturesDirectoryAsSolution(fixtureName);

    await this.jumpToFileInSolution(filename);

    const uriForSelector = await this.getUriForSelector(fixtureUri);
    await this.assertVisible(`[data-test--editors--focused-uri="${uriForSelector}"]`, ASSERT_VISIBLE_TIMEOUT);
  }

  async jumpToFileInSolution(filename: string, expectedDocumentType: string = 'bpmn'): Promise<void> {
    await this.assertVisible(`.treeview__label=${filename}`, ASSERT_VISIBLE_TIMEOUT);
    await this.openViaQuickJump(filename);

    await this.assertVisible(
      `[data-test--editors--focused-document-type="${expectedDocumentType}"]`,
      ASSERT_VISIBLE_TIMEOUT,
    );
  }

  async openFileFromFixturesDirectory(fixtureName: string, filename: string): Promise<void> {
    const fixtureUri = this.getFixturesFileUri(fixtureName, filename);

    await this.openUriAsDocument(fixtureUri);

    await this.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

    const uriForSelector = await this.getUriForSelector(fixtureUri);
    await this.assertVisible(`[data-test--editors--focused-uri="${uriForSelector}"]`, ASSERT_VISIBLE_TIMEOUT);
  }

  async closeOpenEditors(expectedDocumentType: string = 'bpmn'): Promise<void> {
    const selector = `[data-test--editors--focused-document-type="${expectedDocumentType}"]`;

    await this.poll(
      async () => {
        await this.openViaCommandSearch('Test: Close all');
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
      // TODO: technically, this does not prove visibility in a visual sense
      async () => {
        const result = await this.$$(selector).length;
        return result === 0;
      },
      `waiting for there to be no elements: ${selector}`,
      10,
    );
  }

  async navigateBack(): Promise<void> {
    await this.testDriver.client!.execute(
      `bifrost.commands.executeCommand('std.editor.navigateToPreviousEditorDocumentInHistory')`,
    );
  }

  async navigateForward(): Promise<void> {
    await this.testDriver.client!.execute(
      `bifrost.commands.executeCommand('std.editor.navigateToNextEditorDocumentInHistory')`,
    );
  }

  getFixturesFileUri(fixtureName: string, filename: string): string {
    const uri = 'file://' + path.join(__dirname, 'fixtures', fixtureName, filename);

    return uri;
  }

  async getUriForSelector(uri: string): Promise<string> {
    const result = (await this.testDriver.client!.executeAsync(
      ((uri: string, done: (arg: string) => void) => {
        done(CSS.escape(uri));
      }) as any,
      uri,
    )) as string;

    return result;
  }

  async waitForText(selector: string, timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<void> {
    await this.testDriver.client!.waitUntil(
      async () => {
        const element = await this.testDriver.client!.$(selector);
        const text = await element.getText();

        return text.trim() !== '';
      },
      { timeout: timeout },
    );
  }

  /**
   * Clicks on the element identified by the given CSS `selector`.
   *
   * **IMPORTANT:** If the query results in more than one element, the first element is clicked.
   */
  async clickOn(selector: string): Promise<void> {
    await this.performClick(selector, 'left');
  }

  /**
   * Right clicks on the element identified by the given CSS `selector`.
   *
   * **IMPORTANT:** If the query results in more than one element, the first element is clicked.
   */
  async rightClickOn(selector: string): Promise<void> {
    await this.performClick(selector, 'right');
  }

  async clickOnMenubarButtonForCommand(commandName: string): Promise<void> {
    await this.clickOn(`[data-test--menubar--button-for-command="${commandName}"]`);
  }

  async getAttribute(selector: string, attributeName: string): Promise<any> {
    return this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.getAttribute(attributeName));
  }

  async getElementCount(selector: string): Promise<number> {
    const result = await this.$$(selector);

    return result.length;
  }

  async getHtml(selector: string): Promise<any> {
    return this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.getHTML());
  }

  async getText(selector: string): Promise<any> {
    return this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.getText());
  }

  async getValue(selector: string): Promise<any> {
    return this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.getValue());
  }

  async clearTextInput(selector: string): Promise<any> {
    const value = await this.getValue(selector);
    const text = await this.getText(selector);

    // If the selector is a MultiLineCodeEditor we need to get the text instead of the value.
    const stringToUse = value ?? text;
    await this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.click());
    const backspaceArray = stringToUse.split('').map(() => Key.Backspace);
    const deleteArray = stringToUse.split('').map(() => Key.Delete);

    // We need to hit the delete key to ensure the input is definitely clear.
    // The clickOn function clicks on the middle of the input element so the cursor is not always at the end.
    await this.sendKeyboardInput([...backspaceArray, ...deleteArray], false);
  }

  async sendKeyboardInput(keys: string[], simulateHumanTyping: boolean = true): Promise<void> {
    let typingPause = 20;
    if (process.env.BIFROST_TEST_TYPING_PAUSE) {
      typingPause = parseInt(process.env.BIFROST_TEST_TYPING_PAUSE);
    }
    const pauseOnWindowsAfterEachKey = simulateHumanTyping ? typingPause : 40;
    const pauseOnMacAfterEachKey = simulateHumanTyping ? typingPause : 20;
    const pauseAfterEachKey = process.platform !== 'darwin' ? pauseOnWindowsAfterEachKey : pauseOnMacAfterEachKey;

    await this.inputSimulator.sendKeyboardInput(keys, pauseAfterEachKey);
  }

  async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, timeInMilliseconds));
  }

  async assertDocumentIsFocused(editorDocumentUri: string, timeout?: number): Promise<boolean> {
    const uriForSelector = await this.getUriForSelector(editorDocumentUri);
    return this.assertVisible(`[data-test--editors--focused-uri="${uriForSelector}"]`, timeout);
  }

  async assertVisible(selector: string, timeout?: number): Promise<boolean> {
    await this.scrollIntoViewIfNeeded(selector);

    return (await this.testDriver.client!.$(selector)).waitForDisplayed({ timeout: timeout });
  }

  /**
   * Asserts that the given `selector` has no result at this moment of invocation.
   */
  async assertNotVisible(
    selector: string,
    messageSuffixFn?: (selectionPromise: any) => Promise<string>,
  ): Promise<void> {
    // TODO: technically, this does not prove visibility in a visual sense
    const selectorResult = await this.$$(selector);

    const assertWillFail = (await selectorResult.length) != 0;

    const callMessageSuffixFn = assertWillFail && messageSuffixFn != null;
    const text = callMessageSuffixFn ? await messageSuffixFn(this.$$(selector)) : '';
    const message = `There should be no results for selector '${selector}', but got ${selectorResult.length}.\n\n${text}`;

    assert.equal(selectorResult.length, 0, message);
  }

  async assertPaneVisible(paneId: string): Promise<void> {
    await this.assertVisible(`[data-test--pane="${paneId}"]`, ASSERT_VISIBLE_TIMEOUT);
  }

  async assertPaneNotVisible(paneId: string): Promise<void> {
    await this.assertNotVisible(`[data-test--pane="${paneId}"]`);
  }

  async switchToPaneGroup(groupId: string): Promise<void> {
    const selector = `[data-test--pane-group-tab="${groupId}"]`;
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);
    await this.clickOn(selector);
    await this.pause(250);
  }

  async assertContextMenuVisible(timeout?: number): Promise<void> {
    await this.assertVisible(QUERY_VISIBLE_CONTEXTMENU, timeout);
    const text = await this.getText(QUERY_VISIBLE_CONTEXTMENU);

    assert.notStrictEqual(text, '', 'Context Menu should contain menu items');
  }

  async assertContextMenuNotVisible(timeout?: number): Promise<void> {
    await this.assertNotVisible(QUERY_VISIBLE_CONTEXTMENU);
  }

  /**
   * Asserts that no errors are apparent and that the user interface is in an completely idle state, i.e.
   * no open quick jump, dangling context menus or active dialogs.
   */
  async assertNoErrorsPresentAndIdle(): Promise<void> {
    await this.assertNoErrorsPresent();

    await this.assertNotVisible(QUERY_DIALOG);
    await this.assertNotVisible(QUERY_VISIBLE_CONTEXTMENU);
    await this.assertNotVisible(QUERY_QUICK_JUMP);
  }

  async assertNoErrorsPresent(): Promise<void> {
    await this.assertNoReactErrorBoundariesVisible();
    await this.assertNoErrorOrWarningNotificationsVisible();
  }

  async assertNoErrorOrWarningNotificationsVisible(): Promise<void> {
    await this.assertNotVisible(
      '[data--test--unexpected-notifications]',
      async (selectionPromise: Promise<WebdriverIO.Element[]>): Promise<string> => {
        const elements = await selectionPromise;
        if (!elements || elements.length === 0) {
          return 'No error notifications shown';
        }
        const mappedElementsPromise = elements.map(async (element) => element.getHTML());
        // TODO - BUG:
        // Sometimes "mappedElementsPromise" is not an array but just an object.
        // No clue how that's even possible, given the nature of "map" and that "elmenets" is ALWAYS an array at this point.
        // Maybe an issue with webdriver.io?
        const result = await Promise.all(
          Array.isArray(mappedElementsPromise) ? mappedElementsPromise : [mappedElementsPromise],
        );
        const html = result.join(',\n\n');

        return `Shown notifications:\n\n${html}`;
      },
    );
  }

  async assertNoReactErrorBoundariesVisible(): Promise<void> {
    await this.assertNotVisible('[data-test--react-error-boundary]', async (selectionPromise: any): Promise<string> => {
      const html = await selectionPromise.getAttribute('data-test--react-error-boundary');

      return `Shown error boundary:\n\n${html}`;
    });
  }

  async waitForSolutionEntryCountChanged(previousCount: number): Promise<void> {
    await this.poll(
      async () => {
        const result = await this.$$('[data-test--tree="std/file-explorer/open-solution"] .treeview__entry');
        return result.length;
      },
      (count: number) => {
        return count !== previousCount;
      },
      'The solution entry count has not changed till the timeout',
    );
  }

  /**
   * Waits for the given `selector` to have no result.
   */
  public async waitForNotVisible(selector: string): Promise<void> {
    await this.poll(
      async () => {
        const result = await this.$$(selector);
        return result;
      },
      // TODO: technically, this does not prove visibility in a visual sense
      (list: any[]) => list.length === 0,
      `waiting for there to be no elements: ${selector}`,
    );
  }

  async assertFileWasCreatedAndIsNotEmpty(filename: string): Promise<void> {
    await this.poll(
      () => fs.existsSync(filename),
      (fileExists: boolean) => fileExists,
      `File was not created: ${filename}`,
    );
    const stat = fs.statSync(filename);
    assert.ok(stat.size > 0);
  }

  /**
   *
   * @param selector Must be a CSS selector
   * @returns ChainablePromiseArray
   */
  $$(selector: string): ChainablePromiseArray {
    return this.testDriver.client!.custom$$('querySelectorAll', selector);
  }

  private async snapshotCurrentTestdata(): Promise<void> {
    const testFolderPath = path.join(os.homedir(), '.evil', 'studio-tests');
    const backupFolderPath = path.join(
      os.homedir(),
      '.evil',
      `studio-tests-backup-${this.timeStampForTestDataBackups}`,
    );

    if (!fs.existsSync(testFolderPath)) {
      return;
    }

    if (!fs.existsSync(backupFolderPath)) {
      fs.mkdirSync(backupFolderPath);
    }

    fs.cpSync(testFolderPath, path.join(backupFolderPath, this.getNormalizedTestTitle()), {
      dereference: true,
      recursive: true,
      force: true,
    });
  }

  private async cleanup(): Promise<void> {
    const testFolderPath = path.join(os.homedir(), '.evil', 'studio-tests');

    if (!fs.existsSync(testFolderPath)) {
      return;
    }

    try {
      fs.rmSync(testFolderPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.error('Failed to cleanup testdata: ', error);
    }
  }

  private async stopApp(): Promise<void> {
    let pluginHostPid: number | null = null;

    try {
      pluginHostPid = await withTimeout(
        this.testDriver.client!.execute(`return window.__pluginHostPid ?? null`),
        3_000,
      );
    } catch {
      // Session may already be dead — we'll fall through to quit
    }

    try {
      await withTimeout(this.testDriver.client!.execute(`bifrost.commands.executeCommand('std.window.quit')`), 5_000);
    } catch {
      // Expected: quit closes the browser before a response arrives,
      // or the session is already dead and the timeout fired.
    }

    try {
      await withTimeout(this.testDriver.stop(), 5_000);
    } catch {
      // Session cleanup timed out — the old process may be orphaned but
      // beforeEach creates a fresh session anyway.
    }

    if (pluginHostPid != null) {
      this.killOrphanedProcess(pluginHostPid);
    }
  }

  private killOrphanedProcess(pid: number): void {
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already dead — good
        }
      }, 2_000);
    } catch {
      // Process already exited — nothing to do
    }
  }

  private async performClick(selector: string, mouseButton: 'left' | 'right'): Promise<void> {
    await this.scrollIntoViewIfNeeded(selector);
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);

    await this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.click({ button: mouseButton }));
  }

  private async scrollIntoViewIfNeeded(selector: string): Promise<void> {
    await this.testDriver.client!.executeAsync(
      ((elementSelector: string, done: () => void) => {
        try {
          const domElement = document.querySelector<any>(elementSelector);
          if (domElement != null) {
            domElement.scrollIntoViewIfNeeded();
          }
        } catch {
          // do nothing
        }
        done();
      }) as any,
      selector,
    );
  }

  async assertGitPaneVisible(): Promise<void> {
    await this.assertVisible('[data-test--git-pane]', ASSERT_VISIBLE_TIMEOUT);
  }

  async getGitPaneBranchLabel(): Promise<string> {
    return this.getText('[data-test--git-pane] .pane-info-bar__item-label');
  }

  async getGitPaneSectionCount(): Promise<number> {
    return this.getElementCount('[data-test--git-pane] .treeview__entry--section');
  }

  async stageFileViaApi(relativePath: string): Promise<void> {
    await this.openViaCommandSearch('Test: Git Stage File', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...relativePath.split(''), 'enter'], false);
    await this.pause(1500);
  }

  async unstageFileViaApi(relativePath: string): Promise<void> {
    await this.openViaCommandSearch('Test: Git Unstage File', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...relativePath.split(''), 'enter'], false);
    await this.pause(1500);
  }

  async commitAllStagedViaApi(message: string): Promise<void> {
    await this.openViaCommandSearch('Test: Git Commit All Staged', false);
    await this.assertVisible('[data-test--dialog]', ASSERT_VISIBLE_TIMEOUT);
    await this.sendKeyboardInput([...message.split(''), 'enter'], false);
    await this.pause(1500);
  }

  async openMergeResolver(): Promise<void> {
    await this.executeCommand('git.test.openMergeResolver');
    await this.assertVisible('[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]', ASSERT_VISIBLE_TIMEOUT);
  }

  async assertMergeResolverVisible(): Promise<void> {
    await this.assertVisible('[data-test--bpmn-merge-ours], [data-test--dmn-merge-ours]', ASSERT_VISIBLE_TIMEOUT);
  }

  async isDmnMergeResolverVisible(): Promise<boolean> {
    const elements = await this.$$('[data-test--dmn-merge-ours]');
    return elements.length > 0;
  }

  async isBpmnMergeResolverVisible(): Promise<boolean> {
    const elements = await this.$$('[data-test--bpmn-merge-ours]');
    return elements.length > 0;
  }

  async getMergeResolverTitle(): Promise<string> {
    return this.getText('.editor-title__text');
  }

  async getGitPaneConflictCount(): Promise<number> {
    // Conflicted files live in the "Merge Conflicts" section of the git pane.
    // They have type="file" in the tree, so we count entries inside the first
    // section (conflicts) that are typed as files.
    return this.getElementCount('[data-test--git-pane] [data-test--tree-entry-type="file"]');
  }

  async assertMergeConflictBannerVisible(): Promise<void> {
    await this.assertVisible('[data-test--bpmn-conflict-banner]', ASSERT_VISIBLE_TIMEOUT);
  }

  async clickMergeToolbarButton(label: string): Promise<void> {
    const buttons = await this.$$('.editor-toolbar__button');
    for (const btn of buttons) {
      const text = await btn.getText();
      if (text.includes(label)) {
        await btn.click();
        return;
      }
    }
    throw new Error(`Merge toolbar button "${label}" not found`);
  }

  private async poll(
    pollFn: () => any,
    acceptFn: (arg: any) => boolean | Promise<boolean>,
    timeoutMessage: string,
    retryInterval: number = 200,
    maxRetries: number = 200,
  ): Promise<void> {
    let retries = 0;
    let lastError = timeoutMessage;

    while (true) {
      if (retries > maxRetries) {
        console.error(`Polling Timeout: ${timeoutMessage}`);
        console.error(lastError);

        throw new Error(`Polling Timeout: ${timeoutMessage} after ${maxRetries * retryInterval} ms.`);
      }

      let result: any;
      try {
        result = await pollFn();

        if (await acceptFn(result)) {
          return result;
        } else {
          lastError = 'Polling acceptance condition was not fulfilled';
        }
      } catch (e: any) {
        lastError = `${e.message}:  ${Array.isArray(e.stack) ? e.stack.join('\n') : e.stack}`;
      }

      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      retries++;
    }
  }
}
