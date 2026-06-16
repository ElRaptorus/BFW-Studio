import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

export interface PluginThemeDefinition {
  id: string;
  label: string;
  type: 'dark' | 'light';
  tokens: Record<string, string>;
}

export class ThemesApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async register(definition: PluginThemeDefinition): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'themes',
      method: 'register',
      args: [definition],
      pluginName: this.pluginName,
    } satisfies ApiRequestPayload);
  }

  async unregister(themeId: string): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'themes',
      method: 'unregister',
      args: [themeId],
      pluginName: this.pluginName,
    } satisfies ApiRequestPayload);
  }

  async getActiveTheme(): Promise<string> {
    return this.connection.request(PH_API_REQUEST, {
      namespace: 'themes',
      method: 'getActiveTheme',
      args: [],
    } satisfies ApiRequestPayload) as Promise<string>;
  }
}
