import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

export interface TreeViewOptions {
  id: string;
  title: string;
  area: 'left' | 'right' | 'bottom';
  groupId?: string;
  icon?: string;
}

export interface PluginTreeItem {
  id: string;
  type: 'directory' | 'file' | 'section' | 'property';
  label: string;
  sublabel?: string;
  icon?: string;
  expanded?: boolean;
  children?: PluginTreeItem[];
  command?: string;
  badges?: unknown[];
  contextMenuId?: string;
  metadata?: unknown;
}

export class ViewsApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerTreeView(options: TreeViewOptions): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'views',
      method: 'registerTreeView',
      args: [this.pluginName, options],
    } satisfies ApiRequestPayload);
  }

  async updateTreeData(viewId: string, items: PluginTreeItem[]): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'views',
      method: 'updateTreeData',
      args: [this.pluginName, viewId, items],
    } satisfies ApiRequestPayload);
  }
}
