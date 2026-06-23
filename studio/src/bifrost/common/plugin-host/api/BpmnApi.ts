import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type ApiRequestPayload,
  PH_API_REQUEST,
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import { randomUUID } from 'crypto';

import type {
  BpmnElementDetailSnapshot,
  BpmnElementEvent,
  BpmnElementSnapshot,
  OverlayContextEvent,
  PluginBpmnOverlay,
} from '@evil/bifrost_fw_sdk';

import { registerGlobalCallback, unregisterGlobalCallback } from '../callbackRegistry';

type BpmnEventMethod =
  | 'onElementSelected'
  | 'onElementHover'
  | 'onElementDoubleClick'
  | 'onElementContextMenu'
  | 'onOverlayContextChanged';

interface RegisteredEventCallback {
  callbackId: string;
  callback: (...args: any[]) => void;
}

export class BpmnApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private eventListeners = new Map<string, RegisteredEventCallback[]>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async setOverlays(uri: string, overlays: PluginBpmnOverlay[]): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'setOverlays',
      args: [uri, overlays],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async clearOverlays(uri: string, filter?: { elementId?: string }): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'clearOverlays',
      args: [uri, filter],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async onElementSelected(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.registerEventCallback('onElementSelected', uri, callback);
  }

  async offElementSelected(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.unregisterEventCallback('onElementSelected', uri, callback);
  }

  async onElementHover(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.registerEventCallback('onElementHover', uri, callback);
  }

  async offElementHover(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.unregisterEventCallback('onElementHover', uri, callback);
  }

  async onElementDoubleClick(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.registerEventCallback('onElementDoubleClick', uri, callback);
  }

  async offElementDoubleClick(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.unregisterEventCallback('onElementDoubleClick', uri, callback);
  }

  async onElementContextMenu(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.registerEventCallback('onElementContextMenu', uri, callback);
  }

  async offElementContextMenu(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void> {
    await this.unregisterEventCallback('onElementContextMenu', uri, callback);
  }

  async onOverlayContextChanged(uri: string, callback: (event: OverlayContextEvent) => void): Promise<void> {
    await this.registerEventCallback('onOverlayContextChanged', uri, callback);
  }

  async offOverlayContextChanged(uri: string, callback: (event: OverlayContextEvent) => void): Promise<void> {
    await this.unregisterEventCallback('onOverlayContextChanged', uri, callback);
  }

  async getElements(uri: string): Promise<BpmnElementSnapshot[]> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'getElements',
      args: [uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<BpmnElementSnapshot[]>;
  }

  async getElement(uri: string, elementId: string): Promise<BpmnElementDetailSnapshot | null> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'getElement',
      args: [uri, elementId],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<BpmnElementDetailSnapshot | null>;
  }

  async getXml(uri: string): Promise<string> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'getXml',
      args: [uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string>;
  }

  disposeCallbacks(): void {
    for (const [, entries] of this.eventListeners) {
      for (const { callbackId } of entries) {
        unregisterGlobalCallback(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      }
    }
    this.eventListeners.clear();
  }

  private async registerEventCallback(
    method: BpmnEventMethod,
    uri: string,
    callback: (...args: any[]) => void,
  ): Promise<void> {
    const callbackId = randomUUID();
    const key = `${method}:${uri}`;

    registerGlobalCallback(callbackId, callback);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'bpmn',
      method,
      args: [uri],
    };

    try {
      await this.connection.request(PH_REGISTER_CALLBACK, payload);
    } catch (error) {
      unregisterGlobalCallback(callbackId);
      throw error;
    }

    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key)!.push({ callbackId, callback });
  }

  private async unregisterEventCallback(
    method: BpmnEventMethod,
    uri: string,
    callback: (...args: any[]) => void,
  ): Promise<void> {
    const key = `${method}:${uri}`;
    const entries = this.eventListeners.get(key);
    if (entries == null) {
      return;
    }

    const index = entries.findIndex((entry) => entry.callback === callback);
    if (index === -1) {
      return;
    }

    const { callbackId } = entries.splice(index, 1)[0];
    unregisterGlobalCallback(callbackId);
    this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
  }
}
