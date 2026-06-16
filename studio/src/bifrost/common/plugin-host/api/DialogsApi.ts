import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

export class DialogsApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async open(options: {
    title: string;
    content: unknown[];
    actions: { response: string; label: string; default?: boolean; cancel?: boolean; dangerous?: boolean }[];
    className?: string;
    hideCloseButton?: boolean;
  }): Promise<{ wasCancelled: boolean; response?: string; formData?: Record<string, unknown> }> {
    const payload: ApiRequestPayload = {
      namespace: 'dialogs',
      method: 'open',
      args: [this.pluginName, options],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<{
      wasCancelled: boolean;
      response?: string;
      formData?: Record<string, unknown>;
    }>;
  }

  async prompt(title: string, placeholder?: string): Promise<string | null> {
    const payload: ApiRequestPayload = {
      namespace: 'dialogs',
      method: 'prompt',
      args: [this.pluginName, title, placeholder],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string | null>;
  }

  async showOpenFile(options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string[] | null> {
    const payload: ApiRequestPayload = {
      namespace: 'dialogs',
      method: 'showOpenFile',
      args: [this.pluginName, options ?? {}],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string[] | null>;
  }

  async showOpenDirectory(): Promise<string[] | null> {
    const payload: ApiRequestPayload = {
      namespace: 'dialogs',
      method: 'showOpenDirectory',
      args: [this.pluginName],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string[] | null>;
  }

  async showSaveFile(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null> {
    const payload: ApiRequestPayload = {
      namespace: 'dialogs',
      method: 'showSaveFile',
      args: [this.pluginName, options ?? {}],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string | null>;
  }
}
