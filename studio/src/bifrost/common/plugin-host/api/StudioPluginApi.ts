import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';

import { CommandsApi } from './CommandsApi';
import { DiagnosticsApi } from './DiagnosticsApi';
import { DialogsApi } from './DialogsApi';
import { EditorsApi } from './EditorsApi';
import { EventsApi } from './EventsApi';
import { MenuBarApi } from './MenuBarApi';
import { MenusApi } from './MenusApi';
import { NotificationsApi } from './NotificationsApi';
import { PanesApi } from './PanesApi';
import { SettingsApi } from './SettingsApi';
import { StatusBarApi } from './StatusBarApi';
import { ThemesApi } from './ThemesApi';
import { ViewsApi } from './ViewsApi';
import { WebviewApi } from './WebviewApi';
import { WorkspaceApi } from './WorkspaceApi';

export interface PluginEnvironment {
  pluginPath: string;
  pluginName: string;
  storagePath: string;
  apiVersion: string;
}

export class StudioPluginApi {
  readonly commands: CommandsApi;
  readonly diagnostics: DiagnosticsApi;
  readonly dialogs: DialogsApi;
  readonly notifications: NotificationsApi;
  readonly settings: SettingsApi;
  readonly events: EventsApi;
  readonly webviews: WebviewApi;
  readonly editors: EditorsApi;
  readonly panes: PanesApi;
  readonly statusBar: StatusBarApi;
  readonly menuBar: MenuBarApi;
  readonly menus: MenusApi;
  readonly workspace: WorkspaceApi;
  readonly views: ViewsApi;
  readonly themes: ThemesApi;
  readonly env: Readonly<PluginEnvironment>;

  constructor(connection: PluginHostConnection, env: PluginEnvironment) {
    this.env = Object.freeze(env);
    this.commands = new CommandsApi(connection, env.pluginName);
    this.diagnostics = new DiagnosticsApi(connection, env.pluginName);
    this.dialogs = new DialogsApi(connection, env.pluginName);
    this.notifications = new NotificationsApi(connection, env.pluginName);
    this.settings = new SettingsApi(connection);
    this.events = new EventsApi(connection, env.pluginName);
    this.webviews = new WebviewApi(connection, env.pluginName);
    this.editors = new EditorsApi(connection, env.pluginName);
    this.panes = new PanesApi(connection, env.pluginName);
    this.statusBar = new StatusBarApi(connection, env.pluginName);
    this.menuBar = new MenuBarApi(connection, env.pluginName);
    this.menus = new MenusApi(connection, env.pluginName);
    this.workspace = new WorkspaceApi(connection, env.pluginName);
    this.views = new ViewsApi(connection, env.pluginName);
    this.themes = new ThemesApi(connection, env.pluginName);
  }

  dispose(): void {
    this.commands.disposeCallbacks();
    this.diagnostics.disposeCallbacks();
    this.notifications.disposeCallbacks();
    this.settings.disposeCallbacks();
    this.events.disposeCallbacks();
    this.webviews.disposeCallbacks();
    this.editors.disposeCallbacks();
    this.workspace.disposeCallbacks();
  }
}
