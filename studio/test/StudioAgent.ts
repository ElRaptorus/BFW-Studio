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
import PluginHost, { PLUGIN_HOST_WAIT_TIMEOUT_MS } from './StudioAgent/PluginHost';
import ScreenCapture from './StudioAgent/ScreenCapture';

function getElectronPath(): string {
  return require('electron/index') as string;
}

const QUERY_QUICK_JUMP = '[data-test--quick-jump]';
const QUERY_DIALOG = '[data-test--dialog]';
const QUERY_VISIBLE_CONTEXTMENU = '.react-contextmenu--visible[tabindex="-1"]';

const SHOW_QUICK_JUMP_COMMANDS = OsSpecificKeystroke('cmd-shift-p', 'ctrl-shift-p');
const SHOW_QUICK_JUMP = OsSpecificKeystroke('cmd-j', 'ctrl-j');
const SELECT_ALL = OsSpecificKeystroke('cmd-a', 'ctrl-a');

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

const executablePath = process.env.TEST_APP_PATH?.trim() || undefined;
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

export interface PluginHostEnvSnapshot {
  BFR_PLUGINS_DIR: string | undefined;
  BFR_SKIP_PERMISSION_DIALOG: string | undefined;
  BFR_PLUGIN_STORAGE_PATH: string | undefined;
  extraEnv: Record<string, string | undefined>;
}

export interface PluginHostStudioStartOptions {
  pluginsDirectory: string;
  skipPermissionDialog?: boolean;
  pluginStoragePath?: string;
  extraEnv?: Record<string, string>;
  waitUntilListCountAtLeast?: number;
  waitUntilLoaded?: string[];
  waitUntilCommandRegistered?: string[];
  studioAgentClass?: any;
  cliArgsForBifrost?: string[];
}

function restoreEnvKey(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

export function capturePluginHostEnv(extraEnvKeys: string[] = []): PluginHostEnvSnapshot {
  const extraEnv: Record<string, string | undefined> = {};
  for (const key of extraEnvKeys) {
    extraEnv[key] = process.env[key];
  }

  return {
    BFR_PLUGINS_DIR: process.env.BFR_PLUGINS_DIR,
    BFR_SKIP_PERMISSION_DIALOG: process.env.BFR_SKIP_PERMISSION_DIALOG,
    BFR_PLUGIN_STORAGE_PATH: process.env.BFR_PLUGIN_STORAGE_PATH,
    extraEnv,
  };
}

export function restorePluginHostEnv(snapshot: PluginHostEnvSnapshot): void {
  restoreEnvKey('BFR_PLUGINS_DIR', snapshot.BFR_PLUGINS_DIR);
  restoreEnvKey('BFR_SKIP_PERMISSION_DIALOG', snapshot.BFR_SKIP_PERMISSION_DIALOG);
  restoreEnvKey('BFR_PLUGIN_STORAGE_PATH', snapshot.BFR_PLUGIN_STORAGE_PATH);
  for (const [key, value] of Object.entries(snapshot.extraEnv)) {
    restoreEnvKey(key, value);
  }
}

const pluginHostEnvSnapshots = new WeakMap<StudioAgent, PluginHostEnvSnapshot>();

export async function createAndStartStudioAgentForPluginHost<T extends StudioAgent = StudioAgent>(
  testContext: TestContext,
  options: PluginHostStudioStartOptions,
): Promise<T> {
  const snapshot = capturePluginHostEnv(Object.keys(options.extraEnv ?? {}));

  process.env.BFR_PLUGINS_DIR = options.pluginsDirectory;
  if (options.skipPermissionDialog !== false) {
    process.env.BFR_SKIP_PERMISSION_DIALOG = '1';
  }
  if (options.pluginStoragePath) {
    process.env.BFR_PLUGIN_STORAGE_PATH = options.pluginStoragePath;
  }
  if (options.extraEnv) {
    Object.assign(process.env, options.extraEnv);
  }

  let studioAgent: T | undefined;

  try {
    studioAgent = await createAndStartStudioAgent<T>(
      testContext,
      options.studioAgentClass ?? StudioAgent,
      options.cliArgsForBifrost ?? [],
    );
    pluginHostEnvSnapshots.set(studioAgent, snapshot);

    if (options.waitUntilListCountAtLeast != null) {
      await studioAgent.pluginHost.waitUntilListCountAtLeast(options.waitUntilListCountAtLeast);
    }
    for (const pluginName of options.waitUntilLoaded ?? []) {
      await studioAgent.pluginHost.waitUntilStatus(pluginName, 'loaded');
    }
    for (const commandId of options.waitUntilCommandRegistered ?? []) {
      await studioAgent.pluginHost.waitUntilCommandRegistered(commandId);
    }

    return studioAgent;
  } catch (error) {
    if (studioAgent != null) {
      await stopPluginHostStudioAgent(studioAgent, false);
    } else {
      restorePluginHostEnv(snapshot);
    }
    throw error;
  }
}

export async function stopPluginHostStudioAgent(
  studioAgent: StudioAgent | undefined,
  warnAboutAppNotRunning: boolean = false,
): Promise<void> {
  if (studioAgent == null) {
    return;
  }

  const snapshot = pluginHostEnvSnapshots.get(studioAgent);
  await studioAgent.stopAndRecordErrors(warnAboutAppNotRunning);
  if (snapshot != null) {
    restorePluginHostEnv(snapshot);
    pluginHostEnvSnapshots.delete(studioAgent);
  }
}

export class StudioAgent {
  public leftMenuBar: LeftMenuBar;
  public pluginHost: PluginHost;

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
    this.pluginHost = new PluginHost(this);

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

  async waitUntil(
    condition: () => Promise<boolean> | boolean,
    options: { timeout: number; timeoutMsg: string },
  ): Promise<void> {
    await this.testDriver.client!.waitUntil(condition, options);
  }

  async waitUntilEditorDocumentTypePlaceholderGone(): Promise<void> {
    await this.waitUntil(
      async () => {
        const envelope = (await this.testDriver.client!.execute(() => ({
          value: document.querySelector('[data-test--editor-doctype-placeholder]') == null,
        }))) as { value: boolean };

        return envelope.value;
      },
      {
        timeout: PLUGIN_HOST_WAIT_TIMEOUT_MS,
        timeoutMsg: 'Placeholder never swapped for the real markdown editor',
      },
    );
  }

  async waitUntilDialogActive(timeoutMsg: string = 'Dialog did not open in time'): Promise<void> {
    await this.waitUntil(
      async () => {
        const envelope = (await this.testDriver.client!.execute(() => ({
          value: (window as any).bifrost.dialog.isActive(),
        }))) as { value: boolean };

        return envelope.value === true;
      },
      { timeout: 5_000, timeoutMsg },
    );
  }

  async submitActiveDialog(response: string, formData: Record<string, unknown> = {}): Promise<void> {
    await this.testDriver.client!.execute(
      (dialogResponse: string, dialogFormData: Record<string, unknown>) => {
        (window as any).bifrost.dialog.submit(dialogResponse, dialogFormData);
      },
      response,
      formData,
    );
  }

  async closeActiveDialog(): Promise<void> {
    await this.testDriver.client!.execute(() => {
      (window as any).bifrost.dialog.close();
    });
  }

  async executeCommandWithoutBlocking(commandId: string, args: unknown[] = []): Promise<void> {
    await this.testDriver.client!.execute(
      (id: string, commandArgs: unknown[]) => {
        (window as any).__unblockedCommandResult = null;
        (window as any).bifrost.commands.executeCommand(id, commandArgs).then((result: unknown) => {
          (window as any).__unblockedCommandResult = result;
        });
      },
      commandId,
      args,
    );
  }

  async waitUntilUnblockedCommandResult(timeoutMsg: string = 'Command result was not received'): Promise<unknown> {
    await this.waitUntil(
      async () => {
        const envelope = (await this.testDriver.client!.execute(() => ({
          value: (window as any).__unblockedCommandResult != null,
        }))) as { value: boolean };

        return envelope.value === true;
      },
      { timeout: 5_000, timeoutMsg },
    );

    const envelope = (await this.testDriver.client!.execute(() => ({
      value: (window as any).__unblockedCommandResult,
    }))) as { value: unknown };

    return envelope.value;
  }

  async isDialogActive(): Promise<boolean> {
    const envelope = (await this.testDriver.client!.execute(() => ({
      value: (window as any).bifrost.dialog.isActive(),
    }))) as { value: boolean };

    return envelope.value === true;
  }

  async getStatusBarViewData(): Promise<any> {
    const envelope = (await this.testDriver.client!.execute(() => ({
      value: (window as any).bifrost.statusBar.getViewData(),
    }))) as { value: any };

    return envelope.value;
  }

  async getMenuBarViewData(): Promise<any> {
    const envelope = (await this.testDriver.client!.execute(() => ({
      value: (window as any).bifrost.menuBar.getViewData(),
    }))) as { value: any };

    return envelope.value;
  }

  async getApplicationMenu(menuId: string = 'std/application/main'): Promise<any[]> {
    const envelope = (await this.testDriver.client!.execute(
      async (id: string) => ({
        value: await (window as any).bifrost.menus.getMenu(id, [(window as any).bifrost]),
      }),
      menuId,
    )) as { value: any[] };

    return envelope.value;
  }

  async isPaneRegistered(paneId: string): Promise<boolean> {
    const envelope = (await this.testDriver.client!.execute(
      (id: string) => ({
        value: (window as any).bifrost.panes.alreadyRegistered(id),
      }),
      paneId,
    )) as { value: boolean };

    return envelope.value === true;
  }

  async getPaneShouldBeDisplayed(paneId: string, editorDocument: unknown = null): Promise<boolean | null> {
    const envelope = (await this.testDriver.client!.execute(
      (id: string, documentModel: unknown) => {
        const provider = (window as any).bifrost.panes.getPaneProvider(id);
        if (provider?.shouldBeDisplayed == null) {
          return { value: null };
        }

        return { value: provider.shouldBeDisplayed(documentModel, null, (window as any).bifrost) };
      },
      paneId,
      editorDocument,
    )) as { value: boolean | null };

    return envelope.value;
  }

  async getDiagnosticCount(): Promise<{ errors: number; warnings: number }> {
    const envelope = (await this.testDriver.client!.execute(() => ({
      value: (window as any).bifrost.diagnostics.getCount(),
    }))) as { value: { errors: number; warnings: number } };

    return envelope.value;
  }

  async maximize(): Promise<void> {
    await this.testDriver.maximizeWindow();
  }

  /**
   * Focuses a host CodeMirror 6 or FEEL editor inside `parentSelector` and
   * clears it. CodeMirror inserts at the caret; tests that type a replacement
   * must start from an empty document (Monaco often overwrote on first key).
   */
  async clickOnCodeEditor(parentSelector: string): Promise<void> {
    await this.clickOn(`${parentSelector} .cm-content`);
    await this.sendKeyboardInput([SELECT_ALL], false);
    await this.sendKeyboardInput([Key.Backspace], false);
  }

  /**
   * Clears a code editor inside `parentSelector`. Same as `clickOnCodeEditor`.
   */
  async clearCodeEditor(parentSelector: string): Promise<void> {
    await this.clickOnCodeEditor(parentSelector);
  }

  /**
   * Returns the visible text of a code editor inside `parentSelector`,
   * trimmed of leading/trailing whitespace.
   */
  async getCodeEditorText(parentSelector: string): Promise<string> {
    return (await this.getText(`${parentSelector} .cm-content`)).trim();
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

  /**
   * Evaluates an arbitrary script in the renderer and returns its result.
   *
   * Caution: the script must not return an object with a top-level `error` property —
   * WebdriverIO's response parser would misread it as a WebDriver protocol error and throw
   * `WebDriverError(<error>)` instead of returning the value. Wrap such results in an
   * envelope (e.g. `{ value: ... }`) and unwrap on this side, as `executeCommand` does.
   */
  async executeInRenderer(script: string): Promise<unknown> {
    return this.testDriver.client!.execute(script);
  }

  /**
   * Executes a Bifrost command in the renderer and returns its result.
   *
   * The result is wrapped in a `{ value }` envelope inside the page and unwrapped here.
   * This is NOT cosmetic: WebdriverIO's response parser treats a returned object that has
   * a top-level `error` property as a WebDriver protocol error and re-throws it as
   * `WebDriverError(<error>)`. Plugin commands commonly return `{ success: false, error }`,
   * which would otherwise be swallowed and resurface as an opaque `WebDriverError` whose
   * message is the caller's own data. Do not remove the envelope.
   *
   * See `docs/architecture/common-pitfalls.md` §`client.execute` cannot return an object
   * with a top-level `error` property.
   */
  async executeCommand<T = any>(commandId: string, args: any[] = []): Promise<T> {
    const envelope = (await this.testDriver.client!.execute(
      async (cmd: string, cmdArgs: any[]) => ({
        value: await (window as any).bifrost.commands.executeCommand(cmd, cmdArgs),
      }),
      commandId,
      args,
    )) as { value: any };

    return envelope.value;
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

  async isCommandEnabled(commandName: string, commandArgs: unknown[] = []): Promise<boolean> {
    const envelope = (await this.testDriver.client!.execute(
      (name: string, args: unknown[]) => ({
        value: (window as any).bifrost.commands.isCommandEnabled(name, args),
      }),
      commandName,
      commandArgs,
    )) as { value: boolean };

    return envelope.value;
  }

  async waitUntilCommandEnabled(
    commandName: string,
    commandArgs: unknown[] = [],
    timeoutInMilliseconds: number = 10_000,
  ): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutInMilliseconds) {
      if (await this.isCommandEnabled(commandName, commandArgs)) {
        return;
      }
      await this.pause(200);
    }
    throw new Error(
      `Command ${commandName} was not enabled within ${timeoutInMilliseconds}ms (args: ${JSON.stringify(commandArgs)})`,
    );
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

  /**
   * Double clicks on the element identified by the given CSS `selector`.
   *
   * **IMPORTANT:** If the query results in more than one element, the first element is clicked.
   */
  async doubleClickOn(selector: string): Promise<void> {
    await this.scrollIntoViewIfNeeded(selector);
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);

    await this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.doubleClick());
  }

  /**
   * Moves the mouse over the element identified by the given CSS `selector`, triggering hover.
   *
   * **IMPORTANT:** If the query results in more than one element, the first element is targeted.
   */
  async hoverOn(selector: string): Promise<void> {
    await this.scrollIntoViewIfNeeded(selector);
    await this.assertVisible(selector, ASSERT_VISIBLE_TIMEOUT);

    await this.testDriver
      .client!.$(selector)
      .getElement()
      .then((element) => element.moveTo());
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
    await this.assertNotVisible(
      '[data-test--react-error-boundary]',
      async (selectionPromise: Promise<WebdriverIO.Element[]>): Promise<string> => {
        // `assertNotVisible` hands over a multi-element selection, so the attribute has to be read
        // per element — calling `getAttribute` on the selection itself throws and hides the very
        // error message this function exists to produce.
        const elements = await selectionPromise;
        const attributes = await Promise.all(
          Array.from(elements).map(async (element) => element.getAttribute('data-test--react-error-boundary')),
        );

        return `Shown error boundary:\n\n${attributes.join(',\n\n')}`;
      },
    );
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
   * Clicks the CreatableSelect clear **X** and waits until the search input is empty.
   * The X disappearing only means the selected option is gone. `clearValue()`
   * does not reset `inputValue`, so typing without this wait can append leftover
   * search text (`error code` + `new error code` → `error codenew error code`).
   */
  async clearSuggestionSelect(propertySelector: string): Promise<void> {
    const clearSelector = `${propertySelector} .react-select__clear-indicator`;
    const inputSelector = `${propertySelector} .react-select__input-container input`;
    await this.clickOn(clearSelector);
    await this.waitForNotVisible(clearSelector);
    await this.poll(
      async () => this.getValue(inputSelector),
      (value: string) => value === '' || value == null,
      `waiting for suggestion select input to be empty: ${inputSelector}`,
    );
  }

  /**
   * Commits a CreatableSelect "Use …" create option by clicking it.
   * Type the new value first without Enter. Enter alone used to hang because
   * `PropertyValueWithSuggestions` overwrote react-select's Input `onKeyDown`.
   */
  async commitSuggestionCreateOption(propertySelector: string, createdValue: string): Promise<void> {
    const optionSelector = `${propertySelector} [data-test-option-value="${createdValue}"]`;
    await this.assertVisible(optionSelector, ASSERT_VISIBLE_TIMEOUT);
    await this.clickOn(optionSelector);
    await this.waitForNotVisible('.react-select__control--menu-is-open');
  }

  /**
   * Reads the committed CreatableSelect value after the menu has closed.
   * The selected option displays as `.react-select__single-value`; the search
   * input stays empty so the menu is unfiltered. Fall back to the input only
   * while a value is still being typed.
   */
  async getSuggestionSelectValue(propertySelector: string): Promise<string> {
    const singleValueSelector = `${propertySelector} .react-select__single-value`;
    const inputSelector = `${propertySelector} .react-select__input-container input`;
    let selectedValue = '';

    await this.poll(
      async () => {
        const openMenus = await this.$$('.react-select__control--menu-is-open');
        if (openMenus.length > 0) {
          return '';
        }

        const singleValueElements = await this.$$(singleValueSelector);
        if (singleValueElements.length > 0) {
          try {
            const singleValueText = await this.getText(singleValueSelector);
            if (typeof singleValueText === 'string' && singleValueText.trim() !== '') {
              selectedValue = singleValueText;
              return selectedValue;
            }
          } catch {
            return '';
          }
        }

        const inputValue = await this.getValue(inputSelector);
        selectedValue = inputValue ?? '';
        return selectedValue;
      },
      (value: string) => typeof value === 'string' && value.trim() !== '',
      `waiting for suggestion select value: ${propertySelector}`,
    );

    return selectedValue;
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
    return (await elements.length) > 0;
  }

  async isBpmnMergeResolverVisible(): Promise<boolean> {
    const elements = await this.$$('[data-test--bpmn-merge-ours]');
    return (await elements.length) > 0;
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
