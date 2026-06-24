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

  async requestOverlayRefresh(): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'requestOverlayRefresh',
      args: [],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async registerPaletteEntry(entry: {
    id: string;
    group?: string;
    icon: string;
    title: string;
    command: string;
  }): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'registerPaletteEntry',
      args: [entry],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async unregisterPaletteEntry(entryId: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'unregisterPaletteEntry',
      args: [entryId],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async registerContextPadEntry(entry: {
    id: string;
    icon: string;
    title: string;
    command: string;
    elementTypes?: string[];
    elementIds?: string[];
  }): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'registerContextPadEntry',
      args: [entry],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async unregisterContextPadEntry(entryId: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'unregisterContextPadEntry',
      args: [entryId],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async updateContextPadEntry(entryId: string, update: { elementIds?: string[] | null }): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'updateContextPadEntry',
      args: [entryId, update],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  // ─── Modeling sub-API ─────────────────────────────────────────────────────

  readonly modeling = {
    updateProperties: async (uri: string, elementId: string, properties: Record<string, unknown>): Promise<void> => {
      const payload: ApiRequestPayload = {
        namespace: 'bpmn',
        method: 'modeling.updateProperties',
        args: [uri, elementId, properties],
      };
      await this.connection.request(PH_API_REQUEST, payload);
    },

    removeElement: async (uri: string, elementId: string): Promise<void> => {
      const payload: ApiRequestPayload = {
        namespace: 'bpmn',
        method: 'modeling.removeElement',
        args: [uri, elementId],
      };
      await this.connection.request(PH_API_REQUEST, payload);
    },

    appendElement: async (
      uri: string,
      sourceElementId: string,
      newElement: { type: string; name?: string },
    ): Promise<{ elementId: string }> => {
      const payload: ApiRequestPayload = {
        namespace: 'bpmn',
        method: 'modeling.appendElement',
        args: [uri, sourceElementId, newElement],
      };
      return this.connection.request(PH_API_REQUEST, payload) as Promise<{ elementId: string }>;
    },

    createConnection: async (
      uri: string,
      sourceId: string,
      targetId: string,
      type?: string,
    ): Promise<{ connectionId: string }> => {
      const payload: ApiRequestPayload = {
        namespace: 'bpmn',
        method: 'modeling.createConnection',
        args: [uri, sourceId, targetId, type],
      };
      return this.connection.request(PH_API_REQUEST, payload) as Promise<{ connectionId: string }>;
    },

    moveElement: async (uri: string, elementId: string, delta: { x: number; y: number }): Promise<void> => {
      const payload: ApiRequestPayload = {
        namespace: 'bpmn',
        method: 'modeling.moveElement',
        args: [uri, elementId, delta],
      };
      await this.connection.request(PH_API_REQUEST, payload);
    },
  };

  async onRendererModuleMessage(callback: (data: unknown) => void): Promise<void> {
    const callbackId = randomUUID();
    const key = 'onRendererModuleMessage:_global';

    registerGlobalCallback(callbackId, callback);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'bpmn',
      method: 'onRendererModuleMessage',
      args: [],
      pluginName: this.pluginName,
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

  async postToRendererModule(data: unknown): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'bpmn',
      method: 'postToRendererModule',
      args: [data],
    };
    await this.connection.request(PH_API_REQUEST, payload);
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
