import type { ISearchIndex } from '#bifrost/contracts/internal/SearchTypes';

import type { HttpService } from '../browser/HttpService';
import type { DialogService } from '../common/DialogService';
import type { FileHandlingService } from '../common/FileHandlingService';
import type { MenuManager } from '../common/MenuManager';
import type { IPluginHost } from './PluginHostTypes';
import type { ISymbolIndex } from './SymbolTypes';

export type BifrostOptions = {
  appKey?: string;
  instanceKey?: string;
  client?: BifrostClient;
  os?: BifrostOperatingSystem;
  startupArgs?: BifrostStartupArgs;
  performanceEntries?: any[];
  isPackaged?: boolean;

  addWindowErrorHandlers?: boolean;
  autoTogglePropertyPanelOnSelection?: boolean;

  localStorageInstance?: BifrostLocalStorage;

  dialogServiceConstructor?: new () => DialogService;
  fileHandlingConstructor?: new () => FileHandlingService;
  httpServiceConstructor?: new () => HttpService;
  menuManagerConstructor?: new () => MenuManager;
  searchIndexConstructor?: new () => ISearchIndex;
  symbolIndexConstructor?: new () => ISymbolIndex;
  pluginHostConstructor?: new (bifrost: any) => IPluginHost;
  webviewProtocol?: string;
};

export type BifrostOptionsStrict = {
  appKey: string;
  instanceKey: string;
  client: BifrostClient;
  os: BifrostOperatingSystem;
  startupArgs: BifrostStartupArgs;
  performanceEntries: any[];
  isPackaged: boolean;

  addWindowErrorHandlers: boolean;
  autoTogglePropertyPanelOnSelection: boolean;

  localStorageInstance: BifrostLocalStorage;

  dialogServiceConstructor: new () => DialogService;
  fileHandlingConstructor: new () => FileHandlingService;
  httpServiceConstructor: new () => HttpService;
  menuManagerConstructor: new () => MenuManager;
  searchIndexConstructor: new () => ISearchIndex;
  symbolIndexConstructor: new () => ISymbolIndex;
  pluginHostConstructor: new (bifrost: any) => IPluginHost;
  webviewProtocol?: string;
};

export type BifrostClient = 'web' | 'electron' | 'embed';

export type BifrostOperatingSystem = 'linux' | 'macos' | 'windows' | 'unknown';

export type BifrostLocalStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export enum BifrostLocalStorageScope {
  /**
   * The LocalStorageItem will belong to Bifrost, e.g. the stored information will be available
   * to all windows in the Electron app.
   */
  App = 'app',
  /**
   * The LocalStorageItem will belong to the current instance of Bifrost, e.g. the stored information will only
   * be available to the current window in the Electron app.
   */
  Instance = 'instance',
}

export type BifrostWindowSerialized = {
  readonly id: string;
  readonly instanceKey: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly isCurrentWindow?: boolean;
  readonly solutionUri?: string;
};

export type BifrostEventListener = (...args: any[]) => void;

export type BifrostEventSubscription = {
  dispose: () => void;
};

export type BifrostStartupArgs = { [name: string]: any };
