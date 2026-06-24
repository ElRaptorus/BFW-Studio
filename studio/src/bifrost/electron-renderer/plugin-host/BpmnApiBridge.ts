import type { Bifrost } from '#bifrost/Bifrost';
import type { CallbackInvocationPayload, RegisterCallbackPayload } from '#bifrost/contracts/PluginHostProtocol';
import { PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';

import type {
  BpmnElementDetailSnapshot,
  BpmnElementEvent,
  BpmnElementSnapshot,
  EditorDocument,
  OverlayContextEvent,
  OverlayFactoryOptions,
  PluginBpmnOverlay,
} from '@evil/bifrost_fw_sdk';
import type { AbstractSubscription } from '@evil/bifrost_fw_sdk';

import { EVENT_EDITOR_AREA_DOCUMENT_CLOSED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED } from '../../../modules/bpmn-core/BpmnModelerComponentAdapter';
import type BpmnModelerComponentAdapter from '../../../modules/bpmn-core/BpmnModelerComponentAdapter';
import { pluginBpmnContributionStore } from '../../../modules/bpmn-core/PluginBpmnContributionStore';
import type { PluginHost } from './PluginHost';
import { PluginOverlayStore } from './PluginOverlayStore';

const BPMN_DOCUMENT_TYPE = 'bpmn';

export const PLUGIN_OVERLAY_STORE_KEY = 'bpmn.pluginOverlayStore';

interface PluginOverlayEntry {
  descriptors: PluginBpmnOverlay[];
  overlayIds: string[];
}

interface EventSubscription {
  callbackId: string;
  uri: string;
  method: string;
  disposer: () => void;
}

/**
 * Renderer-side bridge for the `api.bpmn` namespace.
 * Executes BPMN API requests against real diagram-js services.
 */
export class BpmnApiBridge {
  private bifrost: Bifrost;
  private pluginHost: PluginHost;

  /** pluginName → uri → overlay tracking */
  private pluginOverlays = new Map<string, Map<string, PluginOverlayEntry>>();

  /** pluginName → callbackId → subscription */
  private eventSubscriptions = new Map<string, Map<string, EventSubscription>>();

  /** Editor close subscription for lifecycle management. */
  private editorCloseSubscription: AbstractSubscription | null = null;

  /** Store for plugin overlay factories (one per plugin, auto-render model). */
  readonly overlayStore: PluginOverlayStore;

  constructor(bifrost: Bifrost, pluginHost: PluginHost) {
    this.bifrost = bifrost;
    this.pluginHost = pluginHost;
    this.overlayStore = new PluginOverlayStore(pluginHost, bifrost);
    this.overlayStore.onRefreshRequested(() => {
      this.emitPluginOverlayFactoriesChanged();
    });
    this.bifrost.registerSharedRessource(PLUGIN_OVERLAY_STORE_KEY, this.overlayStore, true);
    this.subscribeToEditorLifecycle();
  }

  async handleApiRequest(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'setOverlays': {
        const [uri, overlays] = args as [string, PluginBpmnOverlay[]];
        return this.handleSetOverlays(uri, overlays, pluginName);
      }
      case 'clearOverlays': {
        const [uri, filter] = args as [string, { elementId?: string } | undefined];
        return this.handleClearOverlays(uri, filter, pluginName);
      }
      case 'getElements': {
        const [uri] = args as [string];
        return this.handleGetElements(uri);
      }
      case 'getElement': {
        const [uri, elementId] = args as [string, string];
        return this.handleGetElement(uri, elementId);
      }
      case 'getXml': {
        const [uri] = args as [string];
        return this.handleGetXml(uri);
      }
      case 'registerPaletteEntry': {
        const [entry] = args as [{ id: string; group?: string; icon: string; title: string; command: string }];
        pluginBpmnContributionStore.addPaletteEntry(pluginName, entry);
        return;
      }
      case 'unregisterPaletteEntry': {
        const [entryId] = args as [string];
        const removed = pluginBpmnContributionStore.removePaletteEntry(pluginName, entryId);
        if (!removed) {
          throw new Error(`Palette entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'registerContextPadEntry': {
        const [entry] = args as [
          { id: string; icon: string; title: string; command: string; elementTypes?: string[]; elementIds?: string[] },
        ];
        pluginBpmnContributionStore.addContextPadEntry(pluginName, entry);
        return;
      }
      case 'unregisterContextPadEntry': {
        const [entryId] = args as [string];
        const removed = pluginBpmnContributionStore.removeContextPadEntry(pluginName, entryId);
        if (!removed) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'updateContextPadEntry': {
        const [entryId, update] = args as [string, { elementIds?: string[] | null }];
        const updated = pluginBpmnContributionStore.updateContextPadEntry(pluginName, entryId, update);
        if (!updated) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      default:
        throw new Error(`Unknown bpmn API method: ${method}`);
    }
  }

  registerCallback(
    payload: RegisterCallbackPayload,
    getOrCreatePluginGroup: (pluginName: string) => Map<string, { disposer: () => void }>,
  ): void {
    const { callbackId, method, args, pluginName: callerName } = payload;
    const pluginName = callerName ?? '_unknown';

    if (method === 'registerOverlayFactory') {
      const [options] = args as [OverlayFactoryOptions | undefined];
      const priority = options?.priority ?? 100;

      this.overlayStore.registerFactory(pluginName, callbackId, priority);

      const disposer = (): void => {
        this.overlayStore.unregisterFactory(pluginName);
      };

      if (!this.eventSubscriptions.has(pluginName)) {
        this.eventSubscriptions.set(pluginName, new Map());
      }
      this.eventSubscriptions.get(pluginName)!.set(callbackId, { callbackId, uri: '', method, disposer });
      getOrCreatePluginGroup(pluginName).set(callbackId, { disposer });

      queueMicrotask(() => {
        this.emitPluginOverlayFactoriesChanged();
      });

      return;
    }

    const [uri] = args as [string];

    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`Cannot subscribe to bpmn.${method}: no BPMN document open for URI '${uri}'`);
    }

    let disposer: () => void;

    switch (method) {
      case 'onElementSelected': {
        const eventBusHandler = (): void => {
          const selection = adapter.getSelection();
          const selectedElements = selection.get() as any[];
          if (selectedElements.length === 0) {
            this.invokeCallback(callbackId, [{ elementId: '', elementType: '', elementName: null }]);
            return;
          }
          const element = selectedElements[0];
          this.invokeCallback(callbackId, [this.serializeElementEvent(element)]);
        };
        const eventBus = adapter.getModelerComponentByName<any>('eventBus');
        eventBus.on('selection.changed', eventBusHandler);
        disposer = () => eventBus.off('selection.changed', eventBusHandler);
        break;
      }
      case 'onElementHover': {
        const eventBusHandler = (event: any): void => {
          if (event.element == null) {
            return;
          }
          this.invokeCallback(callbackId, [this.serializeElementEvent(event.element)]);
        };
        const eventBus = adapter.getModelerComponentByName<any>('eventBus');
        eventBus.on('element.hover', eventBusHandler);
        disposer = () => eventBus.off('element.hover', eventBusHandler);
        break;
      }
      case 'onElementDoubleClick': {
        const eventBusHandler = (event: any): void => {
          if (event.element == null) {
            return;
          }
          this.invokeCallback(callbackId, [this.serializeElementEvent(event.element)]);
        };
        const eventBus = adapter.getModelerComponentByName<any>('eventBus');
        eventBus.on('element.dblclick', eventBusHandler);
        disposer = () => eventBus.off('element.dblclick', eventBusHandler);
        break;
      }
      case 'onElementContextMenu': {
        const eventBusHandler = (event: any): void => {
          if (event.element == null) {
            return;
          }
          this.invokeCallback(callbackId, [this.serializeElementEvent(event.element)]);
        };
        const eventBus = adapter.getModelerComponentByName<any>('eventBus');
        eventBus.on('element.contextmenu', eventBusHandler);
        disposer = () => eventBus.off('element.contextmenu', eventBusHandler);
        break;
      }
      case 'onOverlayContextChanged': {
        const dataUpdateHandler = (): void => {
          const event: OverlayContextEvent = { uri, reason: 'data-updated' };
          this.invokeCallback(callbackId, [event]);
        };
        const selectionHandler = (): void => {
          const event: OverlayContextEvent = { uri, reason: 'selection-changed' };
          this.invokeCallback(callbackId, [event]);
        };

        const documentModel = this.resolveBpmnDocumentModel(uri);
        if (documentModel == null) {
          throw new Error(
            `Cannot subscribe to bpmn.onOverlayContextChanged: document model not available for URI '${uri}'`,
          );
        }

        const dataSubscription: AbstractSubscription = documentModel.on('EVENT_DATA_UPDATED', dataUpdateHandler);
        const selectionSubscription: AbstractSubscription = adapter.on(
          EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED,
          selectionHandler,
        );

        disposer = () => {
          dataSubscription.dispose();
          selectionSubscription.dispose();
        };
        break;
      }
      default: {
        throw new Error(`Unknown bpmn callback method: ${method}`);
      }
    }

    const subscription: EventSubscription = { callbackId, uri, method, disposer };

    if (!this.eventSubscriptions.has(pluginName)) {
      this.eventSubscriptions.set(pluginName, new Map());
    }
    this.eventSubscriptions.get(pluginName)!.set(callbackId, subscription);

    getOrCreatePluginGroup(pluginName).set(callbackId, { disposer });
  }

  disposePlugin(pluginName: string): void {
    const overlaysByUri = this.pluginOverlays.get(pluginName);
    if (overlaysByUri != null) {
      for (const [uri, entry] of overlaysByUri) {
        this.removeOverlayIds(uri, entry.overlayIds);
      }
      this.pluginOverlays.delete(pluginName);
    }

    const subscriptions = this.eventSubscriptions.get(pluginName);
    if (subscriptions != null) {
      for (const [, subscription] of subscriptions) {
        subscription.disposer();
      }
      this.eventSubscriptions.delete(pluginName);
    }

    this.overlayStore.unregisterFactory(pluginName);
    pluginBpmnContributionStore.removePaletteEntries(pluginName);
    pluginBpmnContributionStore.removeContextPadEntries(pluginName);
  }

  dispose(): void {
    for (const [, overlaysByUri] of this.pluginOverlays) {
      for (const [uri, entry] of overlaysByUri) {
        this.removeOverlayIds(uri, entry.overlayIds);
      }
    }
    this.pluginOverlays.clear();

    for (const [, subscriptions] of this.eventSubscriptions) {
      for (const [, subscription] of subscriptions) {
        subscription.disposer();
      }
    }
    this.eventSubscriptions.clear();

    this.overlayStore.dispose();

    this.editorCloseSubscription?.dispose();
    this.editorCloseSubscription = null;
  }

  // --- Editor lifecycle ---

  private subscribeToEditorLifecycle(): void {
    this.editorCloseSubscription = this.bifrost.editors.on(
      EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
      (editorDocument: EditorDocument) => {
        if (editorDocument.documentType === BPMN_DOCUMENT_TYPE) {
          this.handleDocumentClosed(editorDocument.uri);
        }
      },
    );
  }

  private handleDocumentClosed(uri: string): void {
    for (const [pluginName, overlaysByUri] of this.pluginOverlays) {
      const entry = overlaysByUri.get(uri);
      if (entry != null) {
        overlaysByUri.delete(uri);
        if (overlaysByUri.size === 0) {
          this.pluginOverlays.delete(pluginName);
        }
      }
    }

    for (const [pluginName, subscriptions] of this.eventSubscriptions) {
      const toRemove: string[] = [];
      for (const [callbackId, subscription] of subscriptions) {
        if (subscription.uri === uri) {
          subscription.disposer();
          toRemove.push(callbackId);
        }
      }
      for (const callbackId of toRemove) {
        subscriptions.delete(callbackId);
      }
      if (subscriptions.size === 0) {
        this.eventSubscriptions.delete(pluginName);
      }
    }
  }

  // --- Plugin overlay factory refresh ---

  private emitPluginOverlayFactoriesChanged(): void {
    this.bifrost.events.emit('pluginOverlayFactoriesChanged');
  }

  // --- Overlay handling ---

  private handleSetOverlays(uri: string, overlays: PluginBpmnOverlay[], pluginName: string): void {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    if (!this.pluginOverlays.has(pluginName)) {
      this.pluginOverlays.set(pluginName, new Map());
    }
    const pluginMap = this.pluginOverlays.get(pluginName)!;

    const existing = pluginMap.get(uri);
    if (existing != null) {
      this.removeOverlayIds(uri, existing.overlayIds);
    }

    const overlayIds = this.applyOverlays(adapter, overlays, pluginName);
    pluginMap.set(uri, { descriptors: overlays, overlayIds });
  }

  private handleClearOverlays(uri: string, filter: { elementId?: string } | undefined, pluginName: string): void {
    const pluginMap = this.pluginOverlays.get(pluginName);
    if (pluginMap == null) {
      return;
    }

    const existing = pluginMap.get(uri);
    if (existing == null) {
      return;
    }

    if (filter?.elementId != null) {
      const idsToRemove: string[] = [];
      const remainingDescriptors: PluginBpmnOverlay[] = [];
      const remainingOverlayIds: string[] = [];

      for (let index = 0; index < existing.descriptors.length; index++) {
        if (existing.descriptors[index].elementId === filter.elementId) {
          const overlayId = existing.overlayIds[index];
          if (overlayId !== '') {
            idsToRemove.push(overlayId);
          }
        } else {
          remainingDescriptors.push(existing.descriptors[index]);
          remainingOverlayIds.push(existing.overlayIds[index]);
        }
      }

      this.removeOverlayIds(uri, idsToRemove);
      existing.descriptors = remainingDescriptors;
      existing.overlayIds = remainingOverlayIds;

      if (existing.descriptors.length === 0) {
        pluginMap.delete(uri);
      }
    } else {
      this.removeOverlayIds(uri, existing.overlayIds);
      pluginMap.delete(uri);
    }
  }

  private applyOverlays(
    adapter: BpmnModelerComponentAdapter,
    overlays: PluginBpmnOverlay[],
    pluginName: string,
  ): string[] {
    const overlayService = adapter.getOverlays();
    const elementRegistry = adapter.getElementRegistry();
    const ids: string[] = [];

    for (const descriptor of overlays) {
      const shape = elementRegistry.get(descriptor.elementId);
      if (shape == null) {
        ids.push('');
        continue;
      }

      const htmlElement = this.createOverlayHtmlElement(descriptor, pluginName);
      const position = this.mapPosition(descriptor.position);

      try {
        const overlayId = overlayService.add(descriptor.elementId, 'plugin-overlay', {
          position,
          html: htmlElement,
        });
        ids.push(overlayId);
      } catch {
        ids.push('');
      }
    }

    return ids;
  }

  private createOverlayHtmlElement(descriptor: PluginBpmnOverlay, pluginName: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'evil-plugin-overlay';

    if (descriptor.style != null) {
      container.classList.add(`evil-plugin-overlay--${descriptor.style}`);
    }

    if (descriptor.tooltip != null) {
      container.title = descriptor.tooltip;
    }

    if (descriptor.type === 'badge') {
      container.classList.add('evil-plugin-overlay--badge');
      const textNode = document.createTextNode(descriptor.text);
      container.appendChild(textNode);
    } else if (descriptor.type === 'icon') {
      container.classList.add('evil-plugin-overlay--icon');
      const iconElement = document.createElement('i');
      iconElement.className = descriptor.icon;
      container.appendChild(iconElement);
    }

    if ('onClickCommand' in descriptor && descriptor.onClickCommand != null) {
      container.style.pointerEvents = 'auto';
      container.style.cursor = 'pointer';

      const commandId = descriptor.onClickCommand;
      const commandArgs = ('onClickCommandArgs' in descriptor ? descriptor.onClickCommandArgs : []) ?? [];

      container.addEventListener('click', (event) => {
        event.stopPropagation();
        const fullCommandId = commandId.startsWith('plugin.') ? commandId : `plugin.${pluginName}.${commandId}`;

        if (!this.validateOverlayCommand(fullCommandId, pluginName)) {
          console.warn(
            `[BpmnApiBridge] Plugin '${pluginName}' overlay click rejected: command '${fullCommandId}' is not owned by this plugin or is not registered`,
          );
          return;
        }

        this.bifrost.commands.executeCommand(fullCommandId, commandArgs as any[]);
      });
    } else {
      container.style.pointerEvents = 'none';
    }

    return container;
  }

  private validateOverlayCommand(commandId: string, pluginName: string): boolean {
    const expectedPrefix = `plugin.${pluginName}.`;
    if (!commandId.startsWith(expectedPrefix)) {
      return false;
    }
    return this.bifrost.commands.isRegistered(commandId);
  }

  private mapPosition(position: string): { top: number; left: number; bottom?: number; right?: number } {
    switch (position) {
      case 'top-left':
        return { top: -10, left: -10 };
      case 'top-right':
        return { top: -10, left: 0, right: -10 };
      case 'middle-left':
        return { top: 20, left: -10 };
      case 'middle-right':
        return { top: 20, left: 0, right: -10 };
      case 'bottom-left':
        return { top: 0, left: -10, bottom: -10 };
      case 'bottom-right':
        return { top: 0, left: 0, bottom: -10, right: -10 };
      case 'below':
        return { top: 0, left: 0, bottom: -30 };
      default:
        return { top: -10, left: -10 };
    }
  }

  private removeOverlayIds(uri: string, overlayIds: string[]): void {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      return;
    }

    const overlayService = adapter.getOverlays();
    for (const overlayId of overlayIds) {
      if (overlayId !== '') {
        try {
          overlayService.remove(overlayId);
        } catch {
          // overlay may already have been removed (element deleted, tab closed)
        }
      }
    }
  }

  // --- Element queries ---

  private handleGetElements(uri: string): BpmnElementSnapshot[] {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const elements = elementRegistry.filter(() => true) as any[];

    return elements.map((element) => ({
      id: element.id,
      type: element.type,
      name: element.businessObject?.name ?? null,
      parentId: element.parent?.id ?? null,
    }));
  }

  private handleGetElement(uri: string, elementId: string): BpmnElementDetailSnapshot | null {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(elementId) as any;
    if (element == null) {
      return null;
    }

    const businessObject = element.businessObject;
    const properties = this.serializeBusinessObjectProperties(businessObject);
    const incoming = (businessObject?.incoming ?? []).map((flow: any) => flow.id ?? flow.$attrs?.id ?? '');
    const outgoing = (businessObject?.outgoing ?? []).map((flow: any) => flow.id ?? flow.$attrs?.id ?? '');

    return {
      id: element.id,
      type: element.type,
      name: businessObject?.name ?? null,
      parentId: element.parent?.id ?? null,
      properties,
      incoming,
      outgoing,
    };
  }

  private async handleGetXml(uri: string): Promise<string> {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    try {
      return await adapter.getXml();
    } catch {
      throw new Error(`Failed to export BPMN XML for URI: ${uri}`);
    }
  }

  // --- Helpers ---

  private resolveAdapter(uri: string): BpmnModelerComponentAdapter | null {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
      return null;
    }

    const documentModel = this.bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
    if (documentModel == null) {
      return null;
    }

    return (documentModel as any).modelerAdapter ?? null;
  }

  private resolveBpmnDocumentModel(uri: string): any | null {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
      return null;
    }

    return this.bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
  }

  private serializeElementEvent(element: any): BpmnElementEvent {
    return {
      elementId: element.id ?? '',
      elementType: element.type ?? '',
      elementName: element.businessObject?.name ?? null,
    };
  }

  private serializeBusinessObjectProperties(businessObject: any): Record<string, unknown> {
    if (businessObject == null) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(businessObject)) {
      if (key.startsWith('$') || key === 'di' || key === 'incoming' || key === 'outgoing') {
        continue;
      }
      const value = businessObject[key];
      if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      } else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
      ) {
        result[key] = value;
      }
    }
    return result;
  }

  private invokeCallback(callbackId: string, args: unknown[]): void {
    const connection = this.pluginHost.getConnection();
    if (connection == null) {
      return;
    }
    connection.request(PH_CALLBACK_INVOCATION, {
      callbackId,
      args,
    } satisfies CallbackInvocationPayload);
  }
}
