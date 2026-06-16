import type {
  ClickModifierKeysManager,
  CommandMediator,
  EditorMediator,
  HttpService,
  KeybindingsMediator,
  MenuBarMediator,
  MenuMediator,
  QuickJumpViewMediator,
  StatusBarMediator,
  ThemeMediator,
  ViewMediatorManager,
} from './browser';
import type {
  DialogManager,
  Environment,
  FileHandlingService,
  HelpTextManager,
  IconMediator,
  NotificationManager,
  PaneMediator,
  Performance,
  PluginService,
  RecentlyClosedMediator,
  RecentlyOpenedMediator,
  SearchActivityView,
  SettingsMediator,
  SolutionMediator,
  StudioEventService,
} from './common';
import type { SearchIndex, SymbolIndex } from './contracts';

/**
 * Studio is the entrypoint for any plugin.
 */
export declare class Studio {
  /**
   * Holds information about  the runtime environment Studio is started in.
   *
   * Check `Environment` for more information.
   */
  readonly env: Environment;

  /**
   * Holds all commands executable by Studio.
   *
   * Commands are an important building block for Studio's API model as they provide a uniform interface to
   * execute a "thing" like "focus or open the document for a given URI" or "select and zoom to given element".
   *
   * Check `CommandMediator` for more information.
   */
  readonly commands: CommandMediator;

  /**
   * Holds all combinations of keystrokes and which commands they trigger.
   *
   * Check `KeybindingsMediator` for more information.
   */
  readonly keybindings: KeybindingsMediator;

  /**
   * Holds all combinations of keystrokes and which modifiers they set for mouse clicks.
   *
   * Check `ClickModifierKeyMediator` for more information.
   */
  readonly clickModifierKeys: ClickModifierKeysManager;

  /**
   * Manages all of Studio's default settings and user-specific settings.
   *
   * Check `SettingsMediator` for more information.
   */
  readonly settings: SettingsMediator;

  /**
   * Shows native/HTML-based dialogs.
   *
   * Check `DialogView` for more information.
   */
  readonly dialog: DialogManager;

  /**
   * Shows notifications.
   *
   * Check `NotificationManager` for more information.
   */
  readonly notifications: NotificationManager;

  /**
   * Manages all registered menus and context-menus.
   *
   * Check `MenuMediator` for more information.
   */
  readonly menus: MenuMediator;

  /**
   * Manages all registered icons, their queries and aliases.
   *
   * Check `IconMediator` for more information.
   */
  readonly icons: IconMediator;

  /**
   * Manages the Studio's color theme. Provides methods for registering, switching, and querying themes.
   *
   * Check `ThemeMediator` for more information.
   */
  readonly theme: ThemeMediator;

  /**
   * Registers and re-generates all registered items for the menu bar.
   *
   * Check `MenuBarMediator` for more information.
   */
  readonly menuBar: MenuBarMediator;

  /**
   * Registers and re-generates all registered items for the status bar.
   *
   * Check `StatusBarMediator` for more information.
   */
  readonly statusBar: StatusBarMediator;

  /**
   * Manages everything surrounding the editor area in the middle of Studio: creating, saving, closing, focussing and
   * moving documents around on screen as well as managing document types.
   *
   * Check `EditorMediator` for more information.
   */
  readonly editors: EditorMediator;

  /**
   * Panes exist to keep track of several "pane areas" on screen. There are three pane areas
   * "top", "bottom" and "right", where panes can be displayed.
   *
   * Check `PaneMediator` for more information.
   */
  readonly panes: PaneMediator;

  /**
   * A ViewMediator connects a piece of logic (a view instance) with its specific representation in the DOM
   * (a React component).
   *
   * Check `ViewMediatorManager` for more information.
   */
  readonly views: ViewMediatorManager;

  /**
   * View for the Global Search pane
   */
  readonly searchView: SearchActivityView;

  /**
   * View for the general QuickJump component
   */
  readonly quickJump: QuickJumpViewMediator;

  /**
   * Provides methods for dealing with document based I/O.
   *
   * Check `FileHandlingService` for more information.
   */
  readonly files: FileHandlingService;

  /**
   * Provides methods for dealing with HTTP based I/O.
   *
   * Check `HttpService` for more information.
   */
  readonly http: HttpService;

  /**
   * Takes performance measurements.
   *
   * Check `Performance` for more information.
   */
  readonly performance: Performance;

  /**
   * Keeps track of recently opened files, solutions, commands etc.
   *
   * Check `RecentlyOpenedMediator` for more information.
   */
  readonly recentlyOpened: RecentlyOpenedMediator;

  /**
   * Keeps track of recently closed files.
   *
   * Check `RecentlyClosedMediator` for more information.
   */
  readonly recentlyClosed: RecentlyClosedMediator;

  /**
   * Provides an interface for document based indexing and searching.
   *
   * Check `SearchAndSymbolIndexMediator` for more information.
   */
  readonly searchIndex: SearchIndex;

  /**
   * Provides an interface for symbol based indexing and searching.
   *
   * Check `SymbolIndex` for more information.
   */
  readonly symbolIndex: SymbolIndex;

  /**
   * Provides methods for handling solutions.
   *
   * Check `SolutionMediator` for more information.
   */
  readonly solution: SolutionMediator;

  /**
   * Provides methods for managing help texts.
   *
   * Check `HelpTextManager` for more information.
   */
  readonly helpTexts: HelpTextManager;

  /**
   * Provides methods for subscribing to events.
   *
   * Check `StudioEventService` for more information.
   */
  readonly events: StudioEventService;

  /**
   * Provides methods for Plugins to communicate with the Studio and each other.
   */
  readonly plugins: PluginService;

  /**
   * Returns a GUID with a `prefix` (which can be used to make the id a valid DOM-Id).
   *
   *    > studio.getGuid()
   *    > studio.getGuid('my-prefix-')
   */
  getGuid(prefix?: string): string;

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
  registerSharedRessource<T = any>(name: string, moduleInstance: T, overwrite?: boolean): void;

  /**
   * Checks if a shared ressource with the given name is registered.
   *
   * @param name The shared ressource to look for.
   * @returns True, if the shared ressource is registered. False otherwise.
   */
  isSharedRessourceRegistered(name: string): boolean;

  /**
   * Gets the shared ressource registered under the given name.
   * @param name The name of the shared ressource to get.
   * @returns
   * @throws An error if the shared ressource is not registered.
   */
  getSharedRessource<T = any>(name: string): T;
}
