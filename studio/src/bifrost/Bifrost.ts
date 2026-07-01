import type { DialogOptionsStrict_OpenFile, EditorDocument } from '@evil/bifrost_fw_sdk';
import { assertNotNull } from '@evil/bifrost_fw_sdk';

import {
  EVENT_EDITOR_AREA_FOCUS_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_TITLE_UPDATED,
} from '../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_INDEX_UPDATED } from '../../../studio-sdk/src/contracts/internal/SearchEvents';
import type { ISearchIndex } from '../../../studio-sdk/src/contracts/internal/SearchTypes';
import { EVENT_SETTINGS_CHANGED } from '../../../studio-sdk/src/contracts/internal/SettingsEvents';
import { ClickModifierKeysManager } from './browser/ClickModifierKeysManager';
import { CommandMediator } from './browser/CommandMediator';
import { DiagnosticsMediator } from './browser/DiagnosticsMediator';
import { EditorMediator } from './browser/EditorMediator';
import { EditorsPanesSettingsSolutionEventMediator } from './browser/EditorsPanesSettingsSolutionEventMediator';
import { HttpService } from './browser/HttpService';
import { KeybindingsMediator } from './browser/KeybindingsMediator';
import { MenuBarMediator } from './browser/MenuBarMediator';
import { MenuMediator } from './browser/MenuMediator';
import { ModuleMediator } from './browser/ModuleMediator';
import { QuickJumpViewMediator } from './browser/QuickJumpViewMediator';
import { SearchAndSymbolIndexMediator } from './browser/SearchAndSymbolIndexMediator';
import { StatusBarMediator } from './browser/StatusBarMediator';
import { ThemeMediator } from './browser/ThemeMediator';
import { ViewMediatorManager } from './browser/ViewMediatorManager';
import { BifrostEventService } from './common/BifrostEventService';
import { DiagnosticsManager } from './common/DiagnosticsManager';
import { DialogManager } from './common/DialogManager';
import { DialogService } from './common/DialogService';
import { Environment } from './common/Environment';
import type { FileHandlingService } from './common/FileHandlingService';
import { FileHandlingServiceDefault } from './common/FileHandlingServiceDefault';
import { HelpTextManager } from './common/HelpTextManager';
import { IconMediator } from './common/IconMediator';
import { LocalStorageItem } from './common/LocalStorageItem';
import { MenuBarManager } from './common/MenuBarManager';
import { MenuManager } from './common/MenuManager';
import { ModuleManager } from './common/ModuleManager';
import { NotificationManager } from './common/NotificationManager';
import { PaneMediator } from './common/PaneMediator';
import { Performance } from './common/Performance';
import { RecentlyClosedMediator } from './common/RecentlyClosedMediator';
import { RecentlyOpenedMediator } from './common/RecentlyOpenedMediator';
import { SearchIndexStub } from './common/SearchIndexStub';
import { SettingsMediator } from './common/SettingsMediator';
import { EVENT_SOLUTION_CHANGED } from './common/SolutionManager';
import { SolutionMediator } from './common/SolutionMediator';
import { StatusBarManager } from './common/StatusBarManager';
import { SymbolIndexStub } from './common/SymbolIndexStub';
import { FileExplorerView, GlobalSearchView } from './common/activities';
import { NullPluginHost } from './common/plugin-host/NullPluginHost';
import { PluginService } from './common/plugin-host/PluginService';
import type { BifrostLocalStorage, BifrostOptions, BifrostOptionsStrict } from './contracts/BifrostTypes';
import { BifrostLocalStorageScope } from './contracts/BifrostTypes';
import { EVENT_RECENTLY_CLOSED_CHANGED, EVENT_RECENTLY_OPENED_CHANGED } from './contracts/RecentTypes';
import type { ISymbolIndex } from './contracts/SymbolTypes';

const DEFAULT_OPTIONS: BifrostOptionsStrict = {
  appKey: 'bifrost',
  instanceKey: 'instance-0',
  client: 'web',
  os: 'unknown',
  startupArgs: {},
  performanceEntries: [],
  isPackaged: false,
  addWindowErrorHandlers: true,
  autoTogglePropertyPanelOnSelection: false,
  localStorageInstance: window.localStorage,

  dialogServiceConstructor: DialogService,
  fileHandlingConstructor: FileHandlingServiceDefault,
  httpServiceConstructor: HttpService,
  menuManagerConstructor: MenuManager,
  searchIndexConstructor: SearchIndexStub,
  symbolIndexConstructor: SymbolIndexStub,
  pluginHostConstructor: NullPluginHost,
};

export class Bifrost {
  private readonly sharedRessources: Record<string, any> = {};

  /**
   * Holds information about  the runtime environment Bifrost is started in.
   *
   * Check `Environment` for more information.
   */
  public readonly env: Environment;

  // Building Blocks

  /**
   * Holds all commands executable by Bifrost.
   *
   * Commands are an important building block for Bifrost's API model as they provide a uniform interface to
   * execute a "thing" like "focus or open the document for a given URI" or "select and zoom to given element".
   *
   * Check `CommandMediator` for more information.
   */
  public readonly commands: CommandMediator;
  /**
   * Holds all combinations of keystrokes and which commands they trigger.
   *
   * Check `KeybindingsMediator` for more information.
   */
  public readonly keybindings: KeybindingsMediator;
  /**
   * Holds all combinations of keystrokes and which modifiers they set for mouse clicks.
   *
   * Check `ClickModifierKeyMediator` for more information.
   */
  public readonly clickModifierKeys: ClickModifierKeysManager;
  /**
   * Manages all of Bifrost's default settings and user-specific settings.
   *
   * Check `SettingsMediator` for more information.
   */
  public readonly settings: SettingsMediator;
  /**
   * Shows native/HTML-based dialogs.
   *
   * Check `DialogView` for more information.
   */
  public readonly dialog: DialogManager;
  /**
   * Shows notifications.
   *
   * Check `NotificationManager` for more information.
   */
  public readonly notifications: NotificationManager;
  /**
   * Manages all registered menus and context-menus.
   *
   * Check `MenuMediator` for more information.
   */
  public readonly menus: MenuMediator;
  /**
   * Manages all registered icons, their queries and aliases.
   *
   * Check `IconMediator` for more information.
   */
  public readonly icons: IconMediator;
  /**
   * Manages the Studio's color theme. Provides methods for registering, switching, and querying themes.
   *
   * Check `ThemeMediator` for more information.
   */
  public readonly theme: ThemeMediator;

  // Bars, Editors & Panes

  /**
   * Registers and re-generates all registered items for the menu bar.
   *
   * Check `MenuBarMediator` for more information.
   */
  public readonly menuBar: MenuBarMediator;
  /**
   * Registers and re-generates all registered items for the status bar.
   *
   * Check `StatusBarMediator` for more information.
   */
  public readonly statusBar: StatusBarMediator;
  /**
   * Manages everything surrounding the editor area in the middle of Bifrost: creating, saving, closing, focussing and
   * moving documents around on screen as well as managing document types.
   *
   * Check `EditorMediator` for more information.
   */
  public readonly editors: EditorMediator;
  /**
   * Panes exist to keep track of several "pane areas" on screen. There are three pane areas
   * "top", "bottom" and "right", where panes can be displayed.
   *
   * Check `PaneMediator` for more information.
   */
  public readonly panes: PaneMediator;

  // Views & View Mediators

  /**
   * A ViewMediator connects a piece of logic (a view instance) with its specific representation in the DOM
   * (a React component).
   *
   * Check `ViewMediatorManager` for more information.
   */
  public readonly views: ViewMediatorManager;

  /**
   * View for the File Explorer in the Left Pane Area
   */
  public readonly fileExplorerView: FileExplorerView;
  /**
   * View for the Search in the Left Pane Area
   */
  public readonly searchView: GlobalSearchView;
  /**
   * View for the general QuickJump component
   */
  public readonly quickJump: QuickJumpViewMediator;

  // Misc

  /**
   * Loads and manages modules.
   *
   * Check `ModuleMediator` for more information.
   */
  public readonly modules: ModuleMediator;
  /**
   * Provides methods for dealing with document based I/O.
   *
   * Check `FileHandlingService` for more information.
   */
  public readonly files: FileHandlingService;
  /**
   * Provides methods for dealing with HTTP based I/O.
   *
   * Check `HttpService` for more information.
   */
  public readonly http: HttpService;
  /**
   * Takes performance measurements.
   *
   * Check `Performance` for more information.
   */
  public readonly performance: Performance;
  /**
   * Keeps track of recently opened files, solutions, commands etc.
   *
   * Check `RecentlyOpenedMediator` for more information.
   */
  public readonly recentlyOpened: RecentlyOpenedMediator;

  /**
   * Keeps track of recently closed files.
   *
   * Check `RecentlyClosedMediator` for more information.
   */
  public readonly recentlyClosed: RecentlyClosedMediator;
  /**
   * Provides an interface for document based indexing and searching.
   *
   * Check `SearchAndSymbolIndexMediator` for more information.
   */
  public readonly searchIndex: ISearchIndex;
  /**
   * Provides an interface for symbol based indexing and searching.
   *
   * Check `SymbolIndex` for more information.
   */
  public readonly symbolIndex: ISymbolIndex;
  /**
   * Provides methods for handling solutions.
   *
   * Check `SolutionMediator` for more information.
   */
  public readonly solution: SolutionMediator;
  /**
   * Provides methods for managing help texts.
   *
   * Check `HelpTextManager` for more information.
   */
  public readonly helpTexts: HelpTextManager;

  /**
   * URI-keyed diagnostic store. Modules push errors/warnings here; the status bar
   * reads aggregated counts.
   */
  public readonly diagnostics: DiagnosticsMediator;

  /**
   * Manages the Plugin Host lifecycle: discovery, loading, refreshing,
   * and disposal of external plugins. In non-Electron targets this is
   * a NullPluginHost that no-ops all operations.
   */
  public readonly plugins: PluginService;

  public readonly events: BifrostEventService;

  private readonly searchAndSymbolIndex: SearchAndSymbolIndexMediator;
  private readonly localStorageInstance: BifrostLocalStorage;

  public isInitialized = false;

  private constructor(uiRoot: HTMLElement, options: BifrostOptionsStrict) {
    this.performance = new Performance(options.performanceEntries);
    this.performance.mark('bifrost:constructor #start');

    if (options.addWindowErrorHandlers) {
      this.addWindowErrorHandlers();
    }

    this.events = new BifrostEventService();

    this.helpTexts = new HelpTextManager();

    this.localStorageInstance = options.localStorageInstance;
    this.env = new Environment(
      options.appKey,
      options.instanceKey,
      options.client,
      options.os,
      options.startupArgs,
      options.isPackaged,
      options.webviewProtocol,
    );

    this.dialog = new DialogManager(new options.dialogServiceConstructor());
    this.files = new options.fileHandlingConstructor();
    this.http = new options.httpServiceConstructor();
    this.icons = new IconMediator();
    this.notifications = new NotificationManager();
    this.diagnostics = new DiagnosticsMediator(new DiagnosticsManager());

    const settingsStorage = this.getLocalStorage('Settings');
    this.settings = new SettingsMediator(settingsStorage);
    this.settings.register({
      'workbench.general.theme': {
        type: 'string',
        label: 'Theme',
        description: 'Controls the color theme of the Studio.',
        default: 'dark',
        enum: () => this.theme.getRegisteredThemes().map((theme) => theme.id),
        enumLabels: () => Object.fromEntries(this.theme.getRegisteredThemes().map((theme) => [theme.id, theme.label])),
      },
      'workbench.propertyPanel.autoToggleOnSelection': {
        type: 'boolean',
        label: 'Auto-Toggle Property Panel on Selection',
        description: 'Automatically open or close the property panel when an element is selected.',
        default: options.autoTogglePropertyPanelOnSelection ?? false,
      },
      'workbench.editor.temporaryTabs': {
        type: 'boolean',
        label: 'Temporary Tabs',
        description: 'When enabled, single-clicked files open in a temporary tab that gets replaced by the next file.',
        default: false,
      },
      'dialog.defaultDirectory': {
        type: 'string',
        label: 'Default Dialog Directory',
        description:
          'Fallback directory for file and folder dialogs. Used when no directory was recently used for that ' +
          'kind of dialog and no solution is open. Leave empty to fall back to your home directory.',
        category: 'File Dialogs',
        default: '',
      },
      'dialog.internal.lastDirectory.openFile': {
        type: 'string',
        label: 'Last open-file directory',
        description: 'Internal: last directory used for the native open-file dialog.',
        default: '',
        hidden: true,
      },
      'dialog.internal.lastDirectory.openDirectory': {
        type: 'string',
        label: 'Last open-directory directory',
        description: 'Internal: last directory used for the native open-directory dialog.',
        default: '',
        hidden: true,
      },
      'dialog.internal.lastDirectory.saveFile': {
        type: 'string',
        label: 'Last save-file directory',
        description: 'Internal: last directory used for the native save-file dialog.',
        default: '',
        hidden: true,
      },
    });

    this.theme = new ThemeMediator(this.settings);

    this.settings.on(EVENT_SETTINGS_CHANGED, (key: string, currentValue: any, addedValue?: any) => {
      this.events.emitInternalBifrostEvent('settingsUpdate', [key, currentValue, addedValue]);
    });

    const recentlyOpenedStorage = this.getLocalStorage('RecentlyOpened');
    this.recentlyOpened = new RecentlyOpenedMediator(recentlyOpenedStorage);
    this.recentlyOpened.on(EVENT_RECENTLY_OPENED_CHANGED, () => this.menus.updateMenus());

    const recentlyClosedStorage = this.getLocalStorage('RecentlyClosed', BifrostLocalStorageScope.Instance);
    this.recentlyClosed = new RecentlyClosedMediator(recentlyClosedStorage);
    this.recentlyClosed.on(EVENT_RECENTLY_CLOSED_CHANGED, () => this.menus.updateMenus());

    const editorsStorage = this.getLocalStorage('EditorArea', BifrostLocalStorageScope.Instance);
    this.editors = new EditorMediator(editorsStorage, this);

    const panesStorage = this.getLocalStorage('Pane', BifrostLocalStorageScope.Instance);
    this.panes = new PaneMediator(panesStorage);

    this.fileExplorerView = new FileExplorerView(this, this.files);

    const solutionStorage = this.getLocalStorage('Solution', BifrostLocalStorageScope.Instance);
    this.solution = new SolutionMediator(
      this.files,
      this.performance,
      this.recentlyOpened,
      this.settings,
      this.fileExplorerView,
      solutionStorage,
    );

    this.solution.on(EVENT_SOLUTION_CHANGED, async (solution) => {
      if (solution != null) {
        await this.fileExplorerView.setSolution(solution);
      } else {
        this.fileExplorerView.clearSolution();
      }
      this.events.emitInternalBifrostEvent('solutionChanged', [solution]);
    });

    this.dialog.setPathContext({
      settings: this.settings,
      getSolutionRoot: () => {
        const solution = this.solution.getSolution();
        if (solution?.baseUri == null) {
          return null;
        }
        return this.files.getLocalFilenameForUri(solution.baseUri);
      },
    });

    this.commands = new CommandMediator(this.dialog, this.performance, this.notifications);
    this.keybindings = new KeybindingsMediator(uiRoot, this.env.isEmbbed, options.client, options.os, this.commands);
    this.clickModifierKeys = new ClickModifierKeysManager(options.client, options.os);
    this.modules = new ModuleMediator(this, new ModuleManager([this]));

    this.symbolIndex = new options.symbolIndexConstructor();
    this.searchIndex = new options.searchIndexConstructor();
    this.searchView = new GlobalSearchView(this.searchIndex);

    this.searchIndex.on(EVENT_INDEX_UPDATED, () => {
      this.searchView.refresh();
    });

    this.searchAndSymbolIndex = new SearchAndSymbolIndexMediator(
      this.performance,
      this.editors,
      this.files,
      this.solution,
      this.searchIndex,
      this.symbolIndex,
    );

    this.views = new ViewMediatorManager();

    this.quickJump = this.views.registerViewMediator(
      'std/quick-jump',
      new QuickJumpViewMediator(this, 'std-quick-jump'),
    );

    const contentEventMediator = new EditorsPanesSettingsSolutionEventMediator(
      this.panes,
      this.editors,
      this.settings,
      this.solution,
    );

    this.menus = new MenuMediator(this, new options.menuManagerConstructor(), contentEventMediator);
    this.menuBar = new MenuBarMediator(this, new MenuBarManager(), contentEventMediator);
    this.statusBar = new StatusBarMediator(this, new StatusBarManager(), contentEventMediator);

    if (options.autoTogglePropertyPanelOnSelection) {
      this.editors.on(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, (editorDocument: EditorDocument) => {
        if (editorDocument.metadata.hasSelection) {
          this.commands.executeCommand('std.workbench.showPropertyPanel');
        } else {
          this.commands.executeCommand('std.workbench.hidePropertyPanel');
        }
      });
    }

    this.plugins = new PluginService(this, new options.pluginHostConstructor(this));

    this.performance.mark('bifrost:constructor #end');
  }

  /**
   * Used to construct an instance of Bifrost.
   *
   * The returned instance can be initialized by calling `initialize`.
   *
   * - `uiRoot` the HTML node in which to attach Bifrost
   * - `args` the options with which to initialize Bifrost
   */
  static create(uiRoot: HTMLElement = document.body, options: BifrostOptions = {}): Bifrost {
    const bifrostOptions: BifrostOptionsStrict = {
      appKey: options.appKey ?? DEFAULT_OPTIONS.appKey,
      instanceKey: options.instanceKey ?? DEFAULT_OPTIONS.instanceKey,
      client: options.client ?? DEFAULT_OPTIONS.client,
      os: options.os ?? DEFAULT_OPTIONS.os,
      isPackaged: options.isPackaged ?? DEFAULT_OPTIONS.isPackaged,
      startupArgs: options.startupArgs ?? DEFAULT_OPTIONS.startupArgs,
      addWindowErrorHandlers: options.addWindowErrorHandlers ?? DEFAULT_OPTIONS.addWindowErrorHandlers,
      autoTogglePropertyPanelOnSelection:
        options.autoTogglePropertyPanelOnSelection ?? DEFAULT_OPTIONS.autoTogglePropertyPanelOnSelection,
      performanceEntries: options.performanceEntries ?? DEFAULT_OPTIONS.performanceEntries,
      localStorageInstance: options.localStorageInstance ?? DEFAULT_OPTIONS.localStorageInstance,
      dialogServiceConstructor: options.dialogServiceConstructor ?? DEFAULT_OPTIONS.dialogServiceConstructor,
      fileHandlingConstructor: options.fileHandlingConstructor ?? DEFAULT_OPTIONS.fileHandlingConstructor,
      httpServiceConstructor: options.httpServiceConstructor ?? DEFAULT_OPTIONS.httpServiceConstructor,
      menuManagerConstructor: options.menuManagerConstructor ?? DEFAULT_OPTIONS.menuManagerConstructor,
      searchIndexConstructor: options.searchIndexConstructor ?? DEFAULT_OPTIONS.searchIndexConstructor,
      symbolIndexConstructor: options.symbolIndexConstructor ?? DEFAULT_OPTIONS.symbolIndexConstructor,
      pluginHostConstructor: options.pluginHostConstructor ?? DEFAULT_OPTIONS.pluginHostConstructor,
      webviewProtocol: options.webviewProtocol,
    };

    return new Bifrost(uiRoot, bifrostOptions);
  }

  /**
   * For internal use only!
   * Returns an internal version of `Bifrost`, exposing raw, internal, non-backwards compatible APIs. Use with care.
   */
  static cast(studioFromSdk: any): Bifrost {
    return studioFromSdk as Bifrost;
  }

  /**
   * Used to initialize a freshly constructed Bifrost instance.
   * Executes the given callback function with the current bifrost instance as parameter.
   *
   * The Electron-, Webapp- and Embed-Client are using this mechanism to configure client-specific
   * commands, settings, etc.
   *
   *    Bifrost.create().initialize((bifrost: Bifrost) => {
   *      // client-specific code goes here
   *    });
   *
   */
  async initialize(initializeCallbackFn?: (bifrost: Bifrost) => Promise<void>): Promise<void> {
    this.performance.mark('bifrost:initialize #start');
    if (initializeCallbackFn != null) {
      await initializeCallbackFn.apply(null, [this]);
    }
    await this.plugins.initialize();
    this.performance.mark('bifrost:initialize #end');

    this.postInitialize();

    this.isInitialized = true;
  }

  /**
   * Registers a shared ressource at Bifrost, so other modules or plugins
   * can reuse it without having to go through commands.
   *
   * For Example:
   * A module "engine-core" could register a global "EngineManager" instance every other engine module can reuse.
   *
   * Note that a shared ressource is not necessarily limited to a class instance.
   * It could be a dictionary or any other valid JavaScript object.
   *
   * @param name The name under which the shared ressource can be accessed.
   * @param moduleInstance The actual shared ressource instance.
   * @param overwrite If true: Overwrite any already existing shared ressource. Defaults to false.
   */
  registerSharedRessource<T = any>(name: string, moduleInstance: T, overwrite = false): void {
    if (this.sharedRessources[name] && !overwrite) {
      throw new Error(`Shared ressource '${name}' is already registered.`);
    }

    this.sharedRessources[name] = moduleInstance;
  }

  /**
   * Checks if a shared ressource with the given name is registered.
   *
   * @param name The shared ressource to look for.
   * @returns True, if the shared ressource is registered. False otherwise.
   */
  isSharedRessourceRegistered(name: string): boolean {
    return this.sharedRessources[name] != undefined;
  }

  /**
   * Gets the shared ressource registered under the given name.
   * @param name The name of the shared ressource to get.
   * @returns
   * @throws An error if the shared ressource is not registered.
   */
  getSharedRessource<T = any>(name: string): T {
    if (!this.sharedRessources[name]) {
      throw new Error(`Shared ressource '${name}' is not registered.`);
    }

    return this.sharedRessources[name] as T;
  }

  /**
   * Returns an abstract local key/value storage to store information in.
   *
   * Can be scoped to the whole app or just the current instance (e.g. window).
   *
   * Example:
   *
   *    > const store = bifrost.getLocalStorage("ConnectedServices")
   */
  getLocalStorage(name: string, scope: BifrostLocalStorageScope = BifrostLocalStorageScope.App): LocalStorageItem {
    const storageName =
      scope === BifrostLocalStorageScope.App
        ? `${this.env.appKey}/${name}`
        : `${this.env.appKey}/${this.env.instanceKey}/${name}`;

    return new LocalStorageItem(this.localStorageInstance, storageName);
  }

  private postInitialize(): void {
    const maybe = (tryableFn: () => void): void => {
      try {
        tryableFn();
      } catch (error) {
        this.deferError(error, `during postInitialize: ${tryableFn.toString()}`);
      }
    };

    maybe(() => this.panes.restoreFromLastSession());
    maybe(() => this.editors.restoreFromLastSession());

    maybe(() => this.menus.updateMenus());
    maybe(() => this.menuBar.updateMenuBarItems());
    maybe(() => this.statusBar.updateStatusBarItems());

    maybe(async () => {
      const solution = this.solution.getSolution();
      if (solution == null) {
        return;
      }

      const uriToRestore = solution.solutionFileUri ?? solution.baseUri;
      const localPath = this.files.getLocalFilenameForUri(uriToRestore);
      const doesNotExist = !(await this.files.doesFileOrDirectoryExist(localPath));
      if (doesNotExist) {
        throw new Error(`The previously opened solution '${uriToRestore}' could not be located.`);
      }

      if (localPath.endsWith('.essln')) {
        await this.solution.openSolutionFile(uriToRestore);
      } else {
        this.solution.openDirectoryAsSolution(uriToRestore);
      }
    });

    maybe(() => {
      this.editors.on(EVENT_EDITOR_AREA_FOCUS_UPDATED, () => this.updateWindowTitleIfElectron());
      this.editors.on(EVENT_EDITOR_DOCUMENT_TITLE_UPDATED, () => this.updateWindowTitleIfElectron());
      this.solution.on(EVENT_SOLUTION_CHANGED, () => this.updateWindowTitleIfElectron());
      this.updateWindowTitleIfElectron();
    });

    maybe(() => {
      let argumentsOnCommandLine = this.env.startupArgs._ ?? [];

      if (process.env.APP_TEST == 'true') {
        argumentsOnCommandLine = [];

        const testSolution = this.env.startupArgs['test-solution'];
        const testFile = this.env.startupArgs['test-file'];
        if (testSolution != null) {
          argumentsOnCommandLine.push(testSolution);
        }
        if (testFile != null) {
          argumentsOnCommandLine.push(testFile);
        }
      }

      this.openDocumentsAndSolutionsGivenOnCommandLine(argumentsOnCommandLine);
    });

    const userThemeId = this.settings.get('workbench.general.theme') ?? 'dark';
    if (!this.theme.getTheme(userThemeId)) {
      this.theme.setTheme('dark');
    } else {
      this.theme.setTheme(userThemeId);
    }

    this.events.on('unspecifiedGlobalUpdate', () => {
      maybe(() => this.menus.updateMenus());
      maybe(() => this.menuBar.updateMenuBarItems());
      maybe(() => this.statusBar.updateStatusBarItems());
    });

    this.performance.mark('bifrost:ready #start');
    this.events.emitInternalBifrostEvent('ready', []);
    this.performance.mark('bifrost:ready #end');
  }

  private openDocumentsAndSolutionsGivenOnCommandLine(argumentsOnCommandLine: string[]): void {
    try {
      const filesAndDirectoriesGivenOnCommandLine = argumentsOnCommandLine.filter((argument) =>
        this.files.doesFileOrDirectoryExist(this.files.getLocalFilenameForUri(this.files.getUriForFilename(argument))),
      );
      this.focusOrOpenEditorDocumentOrDirectoryAsSolution(filesAndDirectoriesGivenOnCommandLine);
    } catch (error) {
      this.deferError(error);
    }
  }

  private deferError(error: Error, message?: string): void {
    setTimeout(() => {
      if (message) {
        console.error(`Defered Error (${message})`);
      }
      throw error;
    }, 10);
  }

  private addWindowErrorHandlers(): void {
    const showErrorNotification = (content: string): void => {
      this.commands.executeCommand('std.notifications.showError', [content, 'window']);
    };

    window.addEventListener('error', (event: ErrorEvent) => {
      // there is a problem with React Error Boundaries leading to error events being thrown twice
      // https://github.com/facebook/react/issues/11499 (marked as "wontfix")
      // we circumvent this by utilizing `event.error` to store whether we have already seen this error or not

      if (event?.error?.bifrostHandledInWindowErrorHandler != null) {
        return false;
      }
      if (event && event.error) {
        event.error.bifrostHandledInWindowErrorHandler = true;
        showErrorNotification(event.error);
      }
    });
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      showErrorNotification(event.reason);
    });
  }

  /**
   * Internal: Used when the user closes a window in the desktop app intentionally, using the 'x' in the titlebar.
   *
   * Clears all persistent information relating to this specific instance of Bifrost.
   */
  clearInstance(): void {
    this.editors.clearInstance();
    this.panes.clearInstance();
    this.solution.clearInstance();
    this.recentlyClosed.clearInstance();
  }

  /**
   * Returns a GUID with a `prefix` (which can be used to make the id a valid DOM-Id).
   *
   *    > bifrost.getGuid()
   *    > bifrost.getGuid('my-prefix-')
   */
  getGuid(prefix: string = 'g'): string {
    return prefix + crypto.randomUUID();
  }

  /**
   * Internal: Shows a typical "Open File" dialog to open a file/folder.
   */
  async showOpenFileDialogAndFocusOrOpenFileOrDirectory(): Promise<void> {
    const properties: DialogOptionsStrict_OpenFile['properties'] = ['openFile'];
    if (process.platform === 'darwin') {
      properties.push('openDirectory');
    }

    const dialogArgs = {
      properties,
      filters: [
        { name: 'BPMN', extensions: ['bpmn'] },
        { name: 'Bifrost Forge World Solution', extensions: ['essln'] },
      ],
    };

    const filenames = await this.dialog.showOpenFile(dialogArgs);
    if (filenames == null) {
      return;
    }

    this.focusOrOpenEditorDocumentOrDirectoryAsSolution(filenames);
  }

  private async focusOrOpenEditorDocumentOrDirectoryAsSolution(localFilenames: string[]): Promise<void> {
    for (const filename of localFilenames) {
      const uri = this.files.getUriForFilename(filename);

      if (filename.endsWith('.essln')) {
        this.commands.executeCommand('std.solution.openDirectory', [uri]);
      } else if (await this.files.isDirectory(uri)) {
        this.commands.executeCommand('std.solution.openDirectory', [uri]);
      } else {
        this.editors.focusOrOpenEditorDocument(uri);
      }
    }
  }

  /**
   * Internal: Shows a native dialog to open a folder (or, on macOS, also an
   * `.essln` file) as a solution. macOS supports combined file+directory
   * pickers; Linux and Windows do not, so they get a directory-only dialog.
   */
  async showOpenDirectoryDialogAndOpenDirectoryAsSolution(): Promise<void> {
    let selected: string[] | null;

    if (process.platform === 'darwin') {
      selected = await this.dialog.showOpenFile({
        title: 'Open Solution',
        properties: ['openFile', 'openDirectory'],
        filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
      });
    } else {
      selected = await this.dialog.showOpenDirectory();
    }

    if (selected == null || selected.length === 0) {
      return;
    }

    const uri = this.files.getUriForFilename(selected[0]);

    this.commands.executeCommand('std.solution.openDirectory', [uri]);
  }

  private updateWindowTitleIfElectron(): void {
    if (!this.env.isElectron) {
      return;
    }

    let title = this.env.productNameWithReleaseChannel;
    const editorDocumentLabel = this.editors.getFocusedEditorDocument()?.label;

    if (editorDocumentLabel != null) {
      title = editorDocumentLabel;
    }

    if (this.solution.hasOpenSolution()) {
      const solution = this.solution.getSolution();
      assertNotNull(solution, 'solution');

      let solutionLabel: string;
      if (solution.solutionFileUri != null) {
        solutionLabel = this.files.getFilename(solution.solutionFileUri).replace(/\.essln$/, '');
      } else {
        solutionLabel = this.files.getFilename(solution.baseUri);
      }

      title = title === '' ? solutionLabel : `${title} — ${solutionLabel}`;
    }

    window.document.title = title;
  }
}
