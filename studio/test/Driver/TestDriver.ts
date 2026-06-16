import { startWdioSession } from '@wdio/electron-service';
import * as path from 'path';

const electronChromedriverBinary = path.join(
  path.dirname(require.resolve('electron-chromedriver/chromedriver')),
  'bin',
  'chromedriver',
);

export type StartOptions = {
  paths: StartPaths;
  args: string[];
  env: Record<string, any>;
  webdriverLogPath: string;
};

export type StartPaths = {
  executable?: string;
  electron: string;
  electronBundle: string;
};

export default class TestDriver {
  private webdriver?: WebdriverIO.Browser;

  private running = false;
  private started = false;

  private startOptions: StartOptions;

  constructor(startOptions: StartOptions) {
    this.startOptions = startOptions;
    this.startOptions.env.APP_TEST = 'true';
  }

  public get client(): WebdriverIO.Browser | undefined {
    return this.webdriver!;
  }

  public async start() {
    if (this.started) {
      return;
    }

    this.started = true;

    await this.createClient();

    this.running = true;
  }

  private async createClient() {
    const args: string[] = [...this.startOptions.args];

    if (process.env.APPVEYOR) {
      args.push('no-sandbox');
    }

    if (this.startOptions.env && Object.keys(this.startOptions.env).length > 0) {
      for (const [key, value] of Object.entries(this.startOptions.env)) {
        process.env[key] = value;
      }
    }

    const executablePathGiven = this.startOptions.paths.executable != undefined;

    const electronServiceOptions: Record<string, any> = {
      appArgs: args,
    };

    if (executablePathGiven) {
      electronServiceOptions.appBinaryPath = this.startOptions.paths.executable;
    } else {
      electronServiceOptions.appEntryPoint = this.startOptions.paths.electronBundle;
    }

    const capabilities: Record<string, any> = {
      browserName: 'electron',
      'wdio:electronServiceOptions': electronServiceOptions,
      'wdio:chromedriverOptions': {
        binary: electronChromedriverBinary,
      },
      'goog:chromeOptions': {
        binary: executablePathGiven ? this.startOptions.paths.executable : this.startOptions.paths.electron,
      },
    };

    this.webdriver = await startWdioSession([capabilities]);
    this.addCommands();
  }

  private addCommands() {
    this.webdriver!.addCommand('waitUntilTextExists', (selector, text, timeout) => {
      return this.webdriver!.waitUntil(async () => {
        const elem = await this.webdriver!.$(selector);
        const exists = await elem.isExisting();
        if (!exists) {
          return false;
        }

        const selectorText = await elem.getText();
        return Array.isArray(selectorText)
          ? selectorText.some((selector) => selector.includes(text))
          : selectorText.includes(text);
      }, timeout).then(
        () => {},
        (error) => {
          error.message = 'waitUntilTextExists ' + error.message;
          throw error;
        },
      );
    });

    this.webdriver!.addCommand('waitUntilWindowLoaded', (timeout) => {
      return this.webdriver!.waitUntil(async () => {
        return !(await this.webdriver!.isLoading());
      }, timeout).then(
        () => {},
        (error) => {
          error.message = 'waitUntilWindowLoaded ' + error.message;
          throw error;
        },
      );
    });

    this.webdriver!.addCommand('getWindowCount', () => {
      return this.webdriver!.getWindowHandles().then((handles) => {
        return handles.length;
      });
    });

    this.webdriver!.addCommand('windowByIndex', (index) => {
      return this.webdriver!.getWindowHandles().then((handles) => {
        return this.webdriver!.switchToWindow(handles[index]);
      });
    });

    this.webdriver!.addCommand('getSelectedText', () => {
      return this.webdriver!.execute(() => {
        return window.getSelection()!.toString();
      });
    });

    this.webdriver!.addCommand('getRenderProcessLogs', () => {
      return this.webdriver!.getLogs('browser');
    });
  }

  public isRunning() {
    return this.running;
  }

  public waitForReady() {
    return this.waitUntilStarted();
  }

  public async maximizeWindow() {
    await this.client!.execute(() => {
      const remote = require('@electron/remote');
      remote.getCurrentWindow().maximize();
    });
    await this.pause(500);
  }

  public async captureScreenshot() {
    const image = await this.webdriver!.takeScreenshot();
    return Buffer.from(image, 'base64');
  }

  public async stop() {
    if (!this.started) {
      return;
    }

    try {
      await this.webdriver!.deleteSession();
    } catch {
      // Session may already be terminated (e.g. by the quit command)
    }

    this.running = false;
    this.started = false;
  }

  private async waitUntilStarted(): Promise<void> {
    try {
      let retries = 0;
      while (!(await this.checkReadiness())) {
        if (retries++ > 40) {
          throw new Error('Application failed to start');
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error('Application failed to start', error);
      this.stop();
      process.exit(1);
    }
  }

  private checkReadiness(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const checkTimeout = setTimeout(() => {
        resolve(false);
      }, 250);

      if (!this.running) {
        return resolve(false);
      }

      const result = true;

      clearTimeout(checkTimeout);

      resolve(result);
    });
  }

  private async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, timeInMilliseconds));
  }
}
