import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

import type { MenuItem } from '@evil/bifrost_fw_sdk';

export type MenuModifierPosition =
  | { type: 'append' }
  | { type: 'prepend' }
  | { type: 'appendToSubmenu'; submenuId: string }
  | { type: 'prependToSubmenu'; submenuId: string }
  | { type: 'insertAfter'; id: string }
  | { type: 'insertBefore'; id: string };

export interface MenuModifierConfig {
  items: MenuItem[];
  position?: MenuModifierPosition;
}

/**
 * Plugin-facing menus API (child process).
 *
 * Mirrors {@link MenuMediator.registerMenuModifier} with a declarative config.
 */
export class MenusApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerMenuModifier(menuId: string, config: MenuModifierConfig): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'menus',
      method: 'registerMenuModifier',
      args: [this.pluginName, menuId, config],
    } satisfies ApiRequestPayload);
  }
}
