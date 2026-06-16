import { ipcMain } from 'electron';

import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type { BifrostWindowSerialized } from '../contracts/BifrostTypes';
import {
  IPC_MESSAGE_RELOAD_RECENTLY_OPENED,
  IPC_MESSAGE_RELOAD_SETTINGS,
  IPC_MESSAGE_RESOLVE_WINDOW_CLOSING_PROMISE_WITH_RESULT,
  IPC_MESSAGE_WARN_ABOUT_UNSAVED_EDITOR_DOCUMENTS_BEFORE_CLOSING,
  IPC_MESSAGE_WINDOW_CLOSED_BY_USER,
  IPC_MESSAGE_WINDOW_CLOSED_BY_USER_PROMISE,
} from '../contracts/IpcEvents';
import type { ISerializable } from '../contracts/SerializableTypes';
import BifrostWindow from './BifrostWindow';
import BifrostWindowLookup from './BifrostWindowLookup';

export const EVENT_NEW_WINDOW = 'EVENT_NEW_WINDOW';
export const EVENT_FOCUS_WINDOW = 'EVENT_FOCUS_WINDOW';
export const EVENT_CLOSE_WINDOW = 'EVENT_CLOSE_WINDOW';
export const EVENT_APP_STATE_CHANGED = 'EVENT_APP_STATE_CHANGED';
export const EVENT_LAST_WINDOW_WILL_CLOSE = 'EVENT_LAST_WINDOW_WILL_CLOSE';

const notInTestRun = process.env.APP_TEST !== 'true';

/**
 * This class controls and manages all Bifrost windows in the Electron version.
 */
export default class BifrostAppManager extends AbstractEmitter implements ISerializable {
  private appKey: string;
  private appProtocol: string;
  private newWindowBaseArgs: any;
  private initialStartupArgs: any;
  private windowLookup: BifrostWindowLookup;
  private onLastWindowCloseCallbacks: (() => void | Promise<void>)[] = [];
  // unexpected means if the computer shuts down or the autoupdater quits the app
  private appWillQuitUnexpected: boolean = false;

  constructor(appKey: string, newWindowBaseArgs: any, appProtocol: string) {
    super();
    this.appKey = appKey;
    this.appProtocol = appProtocol;

    this.newWindowBaseArgs = newWindowBaseArgs;
    const hasStartArgs = this.newWindowBaseArgs.args != null;
    if (hasStartArgs) {
      this.initialStartupArgs = { args: this.newWindowBaseArgs.args };
      delete this.newWindowBaseArgs.args;
    }

    this.windowLookup = new BifrostWindowLookup();
  }

  // Internal: used to restore state from serialized dump
  deserialize(dump: any): void {
    if (dump == null) {
      this.initializeWithoutRestore();
      return;
    }

    const deepCopy = JSON.parse(JSON.stringify(dump));
    const restoredWindows = deepCopy.windows || [];

    if (restoredWindows.length === 0) {
      this.initializeWithoutRestore();
    } else {
      this.restoreWindowsFromLastSession(restoredWindows);
    }
  }

  // Internal: used to create serialized dump of internal state
  serialize(): any {
    return {
      windows: this.getWindows(),
    };
  }

  onLastWindowClose(callback: () => void | Promise<void>) {
    this.onLastWindowCloseCallbacks.push(callback);
  }

  closeFocusedWindow(): void {
    const bifrostWindow = this.windowLookup.getFocussedWindow();
    if (bifrostWindow == null) {
      throw new Error('Could not get focused BifrostWindow.');
    }

    this.closeWindow(bifrostWindow.id);
  }

  closeWindow(windowId: string): void {
    const bifrostWindow = this.windowLookup.getWindowById(windowId);

    bifrostWindow.close();
  }

  hideFocusedWindow(windowId?: string): void {
    const bifrostWindow = windowId ? this.windowLookup.getWindowById(windowId) : this.windowLookup.getFocussedWindow();
    if (bifrostWindow == null) {
      throw new Error('Could not get focused BifrostWindow.');
    }

    bifrostWindow.hide();
  }

  setAppWillQuitUnexpected(value: boolean): void {
    this.appWillQuitUnexpected = value;
  }

  maximizeFocusedWindow(): void {
    const bifrostWindow = this.windowLookup.getFocussedWindow();
    if (bifrostWindow == null) {
      throw new Error('Could not get focused BifrostWindow.');
    }

    bifrostWindow.maximize();
  }

  minimizeFocusedWindow(): void {
    const bifrostWindow = this.windowLookup.getFocussedWindow();
    if (bifrostWindow == null) {
      throw new Error('Could not get focused BifrostWindow.');
    }

    bifrostWindow.minimize();
  }

  focusWindow(windowId: string): void {
    const bifrostWindow = this.windowLookup.getWindowById(windowId);
    bifrostWindow.focus();

    this.onFocusWindow(bifrostWindow);
  }

  getWindows(): BifrostWindowSerialized[] {
    const bifrostWindowIds = this.windowLookup.getWindowIds();

    return bifrostWindowIds.map((id: string) => {
      const bifrostWindow = this.windowLookup.getWindowById(id);

      return bifrostWindow.serialize();
    });
  }

  async newWindow(bifrostWindowOptions: any = {}, showInstantly: boolean = false): Promise<void> {
    const bifrostWindow = new BifrostWindow(
      {
        ...this.newWindowBaseArgs,
        appKey: this.appKey,
        appProtocol: this.appProtocol,
        width: 1024,
        height: 768,
        ...bifrostWindowOptions,
      },
      showInstantly,
    );

    bifrostWindow.on('close', async (closedByUser) => await this.onCloseWindow(bifrostWindow, closedByUser));
    bifrostWindow.on('focus', () => this.onFocusWindow(bifrostWindow));

    this.windowLookup.register(bifrostWindow.id, bifrostWindow);

    this.emit(EVENT_NEW_WINDOW, [bifrostWindow]);
  }

  reloadSettings(appKey: string, instanceKey: string, settingsName: string, settingsValue: any): void {
    this.sendToAllWindows(IPC_MESSAGE_RELOAD_SETTINGS, [appKey, instanceKey, settingsName, settingsValue]);
  }

  reloadRecentlyOpened(appKey: string, instanceKey: string): void {
    this.sendToAllWindows(IPC_MESSAGE_RELOAD_RECENTLY_OPENED, [appKey, instanceKey]);
  }

  setSolutionUri(instanceKey: string, solutionUri: string): void {
    const window = this.windowLookup.getWindowById(instanceKey);
    window.solutionUri = solutionUri;
    this.emit(EVENT_APP_STATE_CHANGED, []);
  }

  clearSolutionUri(instanceKey: string): void {
    const window = this.windowLookup.getWindowById(instanceKey);
    window.solutionUri = undefined;
    this.emit(EVENT_APP_STATE_CHANGED, []);
  }

  sendToAllWindows(message: string, args: any[]): void {
    const bifrostWindowIds = this.windowLookup.getWindowIds();
    bifrostWindowIds.forEach((id) => {
      const bifrostWindow = this.windowLookup.getWindowById(id);
      bifrostWindow.send(message, args);
    });
  }

  relayToOtherWindows(message: string, args: any[], senderWebContentsId: number): void {
    const bifrostWindowIds = this.windowLookup.getWindowIds();
    bifrostWindowIds.forEach((id) => {
      const bifrostWindow = this.windowLookup.getWindowById(id);
      if (bifrostWindow.getWebContentsId() !== senderWebContentsId) {
        bifrostWindow.send(message, args);
      }
    });
  }

  async gracefulShutdown(): Promise<void> {
    const closePromises = this.getWindows().map((window: any) => {
      return new Promise((resolve) => {
        const bifrostWindow: BifrostWindow = this.windowLookup.getWindowById(window.id);

        bifrostWindow.on('closed', resolve);

        bifrostWindow.close(false);
      });
    });

    await Promise.all(closePromises);
  }

  terminate(): void {
    this.getWindows().forEach((window: any) => {
      const bifrostWindow: BifrostWindow = this.windowLookup.getWindowById(window.id);

      bifrostWindow.terminate();
    });
  }

  private onFocusWindow(bifrostWindow: BifrostWindow): void {
    this.windowLookup.focus(bifrostWindow.id);

    this.emit(EVENT_FOCUS_WINDOW, [bifrostWindow]);
  }

  private async onCloseWindow(bifrostWindow: BifrostWindow, closedByUser?: boolean): Promise<void> {
    let success = true;

    if (notInTestRun) {
      success = await this.warnAboutUnsavedEditorDocuments(bifrostWindow.id);

      if (!success) {
        bifrostWindow.finishClosing(false);
        return;
      }
    }

    const isLastWindow = this.windowLookup.getWindowIds().length === 1;
    if (isLastWindow) {
      for (const cb of this.onLastWindowCloseCallbacks) {
        await cb();
      }
    }

    if (!this.appWillQuitUnexpected && closedByUser) {
      const currentWindowCount = this.windowLookup.getWindowIds().length;
      const closedPromise = new Promise<void>((resolve) => {
        ipcMain.once(
          `${IPC_MESSAGE_WINDOW_CLOSED_BY_USER_PROMISE}_${bifrostWindow.id}`,
          (event: Electron.IpcMainEvent) => {
            return resolve();
          },
        );
      });
      bifrostWindow.send(IPC_MESSAGE_WINDOW_CLOSED_BY_USER, [currentWindowCount]);
      await closedPromise;
    }

    if (!this.appWillQuitUnexpected) {
      this.emit(EVENT_CLOSE_WINDOW, [bifrostWindow]);
    }

    this.windowLookup.remove(bifrostWindow.id);
    bifrostWindow.finishClosing(true);
  }

  private initializeWithoutRestore(): void {
    this.newWindow({ ...this.initialStartupArgs });
  }

  private restoreWindowsFromLastSession(windows: any[]): void {
    windows.reverse().forEach((windowOptions: any, index) => {
      let bifrostWindowOptions = {
        ...windowOptions,
      };

      if (index === windows.length - 1) {
        bifrostWindowOptions = { ...bifrostWindowOptions, ...this.initialStartupArgs };
      }
      this.newWindow(bifrostWindowOptions, true);
    });
  }

  private warnAboutUnsavedEditorDocuments(windowId: string): Promise<boolean> {
    const bifrostWindow = this.windowLookup.getWindowById(windowId);

    return new Promise<boolean>((resolve) => {
      ipcMain.once(
        `${IPC_MESSAGE_RESOLVE_WINDOW_CLOSING_PROMISE_WITH_RESULT}_${windowId}`,
        (event: Electron.IpcMainEvent, success: boolean) => {
          return resolve(success);
        },
      );

      bifrostWindow.send(IPC_MESSAGE_WARN_ABOUT_UNSAVED_EDITOR_DOCUMENTS_BEFORE_CLOSING);
    });
  }
}
