import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import { type ApiRequestPayload, PH_API_REQUEST } from '#bifrost/contracts/PluginHostProtocol';

import type { StatusBarItem, StatusBarItemArea } from '../../../contracts/StatusBarTypes';

export interface PluginProgressHandle {
  update(label: string): void;
  done(): void;
}

/**
 * Plugin-facing status bar API (child process).
 *
 * Mirrors {@link StatusBarMediator} with static item arrays instead
 * of factory functions. The bridge wraps the POJOs into factories.
 */
export class StatusBarApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerStatusBarItem(
    area: StatusBarItemArea,
    id: string,
    items: StatusBarItem[],
    priority?: number,
  ): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'statusBar',
      method: 'registerStatusBarItem',
      args: [this.pluginName, area, id, items, priority],
    } satisfies ApiRequestPayload);
  }

  async updateStatusBarItem(id: string, items: StatusBarItem[]): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'statusBar',
      method: 'updateStatusBarItem',
      args: [this.pluginName, id, items],
    } satisfies ApiRequestPayload);
  }

  async unregisterStatusBarItem(id: string): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'statusBar',
      method: 'unregisterStatusBarItem',
      args: [this.pluginName, id],
    } satisfies ApiRequestPayload);
  }

  async showProgress(label: string): Promise<PluginProgressHandle> {
    const handleId = (await this.connection.request(PH_API_REQUEST, {
      namespace: 'statusBar',
      method: 'showProgress',
      args: [this.pluginName, label],
    } satisfies ApiRequestPayload)) as string;

    return {
      update: (newLabel: string) => {
        this.connection.send(PH_API_REQUEST, {
          namespace: 'statusBar',
          method: 'progressUpdate',
          args: [handleId, newLabel],
        } satisfies ApiRequestPayload);
      },
      done: () => {
        this.connection.send(PH_API_REQUEST, {
          namespace: 'statusBar',
          method: 'progressDone',
          args: [this.pluginName, handleId],
        } satisfies ApiRequestPayload);
      },
    };
  }

  async isVisible(): Promise<boolean> {
    return (await this.connection.request(PH_API_REQUEST, {
      namespace: 'statusBar',
      method: 'isVisible',
      args: [],
    } satisfies ApiRequestPayload)) as boolean;
  }
}
