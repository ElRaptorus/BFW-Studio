import type { BpmnApi } from './BpmnApi';
import type { CommandsApi } from './CommandsApi';
import type { DiagnosticsApi } from './DiagnosticsApi';
import type { DialogsApi } from './DialogsApi';
import type { EditorsApi } from './EditorsApi';
import type { EventsApi } from './EventsApi';
import type { MenuBarApi } from './MenuBarApi';
import type { MenusApi } from './MenusApi';
import type { NotificationsApi } from './NotificationsApi';
import type { PanesApi } from './PanesApi';
import type { SettingsApi } from './SettingsApi';
import type { StatusBarApi } from './StatusBarApi';
import type { ThemesApi } from './ThemesApi';
import type { ViewsApi } from './ViewsApi';
import type { WebviewApi } from './WebviewApi';
import type { WorkspaceApi } from './WorkspaceApi';

/** Frozen environment information available to every plugin at runtime. */
export interface PluginEnvironment {
  /** Absolute path to the plugin's root directory on disk. */
  readonly pluginPath: string;
  /** The plugin's package name (from `package.json`). */
  readonly pluginName: string;
  /** Absolute path to a persistent, plugin-specific storage directory. */
  readonly storagePath: string;
  /** The Studio Plugin API version this plugin was loaded with. */
  readonly apiVersion: string;
}

/**
 * Root API object passed to a plugin's `activate(api)` entry point.
 *
 * Provides access to all Studio subsystems a plugin can interact with:
 * commands, notifications, settings, events, webviews, editors, and panes.
 *
 * All methods on sub-APIs are asynchronous because they cross the IPC
 * boundary between the Plugin Host child process and the Studio renderer.
 */
export interface StudioPluginApi {
  /** BPMN editor interaction: overlays, element events, queries. Requires 'bpmn' permission. */
  readonly bpmn: BpmnApi;
  /** Command registration and execution. */
  readonly commands: CommandsApi;
  /** Diagnostics (errors, warnings, info) contribution and observation. */
  readonly diagnostics: DiagnosticsApi;
  /** Modal dialog and native file picker API. */
  readonly dialogs: DialogsApi;
  /** Toast notification management. */
  readonly notifications: NotificationsApi;
  /** Settings read/write and change observation. */
  readonly settings: SettingsApi;
  /** Studio event subscription. */
  readonly events: EventsApi;
  /** Webview panel creation and messaging. */
  readonly webviews: WebviewApi;
  /** Editor document type registration. */
  readonly editors: EditorsApi;
  /** Layout pane registration. */
  readonly panes: PanesApi;
  /** Status bar item registration and progress indicators. */
  readonly statusBar: StatusBarApi;
  /** Menu bar item and modifier registration. */
  readonly menuBar: MenuBarApi;
  /** Application menu modification. */
  readonly menus: MenusApi;
  /** Scoped file system and workspace access. */
  readonly workspace: WorkspaceApi;
  /** Tree view registration and data push. */
  readonly views: ViewsApi;
  /** Theme contribution and management. */
  readonly themes: ThemesApi;
  /** Frozen environment information (paths, plugin name, API version). */
  readonly env: Readonly<PluginEnvironment>;
}
