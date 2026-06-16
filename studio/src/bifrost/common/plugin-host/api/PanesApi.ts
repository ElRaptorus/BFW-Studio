import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

export interface RegisterWebviewPaneOptions {
  id: string;
  title: string;
  area: 'left' | 'bottom' | 'right';
  groupId?: string;
  icon?: string;
  webviewOptions: {
    entryPoint: string;
    localResourceRoots?: string[];
  };
}

/**
 * Plugin-facing panes API (child process).
 * Allows plugins to register iframe-backed panes in the Studio's pane areas.
 */
export class PanesApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerWebviewPane(options: RegisterWebviewPaneOptions): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'panes',
      method: 'registerWebviewPane',
      args: [this.pluginName, options],
    } satisfies ApiRequestPayload);
  }

  async setVisible(paneId: string, visible: boolean): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'panes',
      method: 'setVisible',
      args: [this.pluginName, paneId, visible],
    } satisfies ApiRequestPayload);
  }
}
