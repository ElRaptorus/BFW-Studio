import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { BrowserWindow, shell } from 'electron';
import { pathToFileURL } from 'node:url';
import os from 'os';
import path from 'path';

import type { BifrostWindowSerialized } from '../contracts/BifrostTypes';
import { IPC_MESSAGE_WINDOW_NAVIGATE_TO_URL } from '../contracts/IpcEvents';

export default class BifrostWindow extends AbstractEmitter {
  public id: string;
  public instanceKey: string;
  public solutionUri?: string;
  private browserWindow: BrowserWindow;
  private userClosedWindowIntentionally: boolean = true;
  private appProtocol: string;

  constructor(bifrostWindowOptions: any, showInstantly: boolean = false) {
    super();
    this.appProtocol = bifrostWindowOptions.appProtocol;
    this.browserWindow = new BrowserWindow({
      width: bifrostWindowOptions.width,
      height: bifrostWindowOptions.height,
      x: bifrostWindowOptions.x,
      y: bifrostWindowOptions.y,
      titleBarStyle: 'default',
      show: showInstantly,
      backgroundColor: '#2f2f2f',
      webPreferences: {
        allowRunningInsecureContent: true,
        contextIsolation: false,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        webviewTag: true,
        webSecurity: false,
      },
    });
    this.instanceKey = bifrostWindowOptions.instanceKey || this.generateInstanceKey();
    this.id = this.instanceKey;

    // Only necessary for linux, because "AppImage" instances don't implicitly use the App Icon as favicon, like windows and macOS apps do.
    if (os.platform() === 'linux') {
      this.browserWindow.setIcon(path.join(__dirname, `app.png`));
    }

    const bifrostWindowOptionsWithInstanceKey = { ...bifrostWindowOptions, instanceKey: this.instanceKey };

    Object.defineProperty(this.browserWindow, 'bifrostWindowOptionsJsonReader', {
      get: () => bifrostWindowOptionsWithInstanceKey,
    });

    this.browserWindow.webContents.setWindowOpenHandler((details) => {
      const { url } = details;
      if (url != this.browserWindow.webContents.getURL()) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    if (!showInstantly) {
      this.browserWindow.once('ready-to-show', () => {
        this.browserWindow.show();
      });
    }

    this.browserWindow.on('close', this.onClose.bind(this));

    this.browserWindow.on('focus', () => this.emit('focus'));

    this.browserWindow.once('closed', () => this.emit('closed'));

    const filename = path.resolve(`${__dirname}/../electron-renderer.html`);
    const fileUrl = pathToFileURL(filename);
    const pathFromFileUrl = fileUrl.pathname;
    const url = new URL(pathFromFileUrl, `${this.appProtocol}://instance`);

    url.searchParams.append('windowOptions', JSON.stringify(bifrostWindowOptionsWithInstanceKey));

    this.browserWindow.loadURL(url.toString());

    this.browserWindow.webContents.on('will-navigate', (event: Electron.Event, url: string) => {
      const currentUrl = this.browserWindow.webContents.getURL();

      if (url !== currentUrl) {
        this.send(IPC_MESSAGE_WINDOW_NAVIGATE_TO_URL, [url]);
        event.preventDefault();
      }
    });
  }

  hide(): void {
    this.browserWindow.hide();
  }

  focus(): void {
    this.browserWindow.focus();
  }

  maximize(): void {
    this.browserWindow.maximize();
  }

  minimize(): void {
    this.browserWindow.minimize();
  }

  close(userClosedWindowIntentionally: boolean = true): void {
    this.userClosedWindowIntentionally = userClosedWindowIntentionally;
    this.browserWindow.close();
  }

  terminate(): void {
    this.browserWindow.destroy();
  }

  serialize(): BifrostWindowSerialized {
    const bounds = this.browserWindow.getBounds();

    return {
      id: this.id,
      instanceKey: this.instanceKey,
      title: this.browserWindow.getTitle(),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      solutionUri: this.solutionUri,
    };
  }

  getWebContentsId(): number {
    return this.browserWindow.webContents.id;
  }

  /**
   * Sends a `message` to the window.
   */
  send(message: string, args: any[] = []): void {
    this.browserWindow.webContents.send(message, ...args);
  }

  public finishClosing(result: boolean): void {
    this.emit('finish-close', [result]);
  }

  private generateInstanceKey(): string {
    const uid = crypto.randomUUID();

    return `window-${uid}`;
  }

  private async onClose(event): Promise<void> {
    event.preventDefault();

    const finishClose = await new Promise<boolean>((resolve) => {
      this.once('finish-close', (success) => {
        resolve(success);
      });

      this.emit('close', [this.userClosedWindowIntentionally]);
    });

    if (finishClose) {
      this.browserWindow.destroy();
    } else {
      this.userClosedWindowIntentionally = true;
    }
  }
}
