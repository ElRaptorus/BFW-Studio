import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

import type { MenuBarItem, MenuBarItemArea } from '../../../contracts/MenuBarTypes';

export interface MenuBarItemModifierConfig {
  insertAfter?: string;
  insertBefore?: string;
  items: MenuBarItem[];
}

/**
 * Plugin-facing menu bar API (child process).
 *
 * Mirrors {@link MenuBarMediator} with static item arrays and
 * declarative modifier configs instead of closures.
 */
export class MenuBarApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerMenuBarItem(area: MenuBarItemArea, items: MenuBarItem[]): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'menuBar',
      method: 'registerMenuBarItem',
      args: [this.pluginName, area, items],
    } satisfies ApiRequestPayload);
  }

  async registerMenuBarItemModifier(config: MenuBarItemModifierConfig): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'menuBar',
      method: 'registerMenuBarItemModifier',
      args: [this.pluginName, config],
    } satisfies ApiRequestPayload);
  }

  async isVisible(): Promise<boolean> {
    return (await this.connection.request(PH_API_REQUEST, {
      namespace: 'menuBar',
      method: 'isVisible',
      args: [],
    } satisfies ApiRequestPayload)) as boolean;
  }
}
