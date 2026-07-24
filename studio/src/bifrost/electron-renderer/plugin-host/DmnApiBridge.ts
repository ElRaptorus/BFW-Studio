import type { Bifrost } from '#bifrost/Bifrost';
import type { CallbackInvocationPayload, RegisterCallbackPayload } from '#bifrost/contracts/PluginHostProtocol';
import { PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';

import type {
  DmnElementDetailSnapshot,
  DmnElementEvent,
  DmnElementSnapshot,
  DmnOverlayContextEvent,
  DmnOverlayFactoryOptions,
  DmnViewChangedEvent,
  DmnViewType,
  EditorDocument,
  PluginDmnOverlay,
} from '@evil/bifrost_fw_sdk';
import type { AbstractSubscription } from '@evil/bifrost_fw_sdk';

import { EVENT_EDITOR_AREA_DOCUMENT_CLOSED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import type DmnModelerComponentAdapter from '../../../modules/dmn-core/DmnModelerComponentAdapter';
import {
  EVENT_DMN_ADAPTER_SELECTION_CHANGED,
  EVENT_DMN_ADAPTER_VIEW_CHANGED,
  EVENT_DMN_ADAPTER_XML_CHANGED,
} from '../../../modules/dmn-core/DmnModelerComponentAdapter';
import { pluginDmnContributionStore } from '../../../modules/dmn-core/PluginDmnContributionStore';
import { pluginDmnModuleLoader } from '../../../modules/dmn-core/plugin-modules/PluginDmnModuleLoader';
import { DmnPluginOverlayManager } from '../../../modules/dmn-editor/DmnPluginOverlayManager';
import type { PluginHost } from './PluginHost';

const DMN_DOCUMENT_TYPE = 'dmn';

export const PLUGIN_DMN_OVERLAY_MANAGER_KEY = 'dmn.pluginOverlayManager';

interface PluginOverlayEntry {
  descriptors: PluginDmnOverlay[];
  overlayIds: string[];
}

interface EventSubscription {
  callbackId: string;
  uri: string;
  method: string;
  disposer: () => void;
}

/**
 * Renderer-side bridge for the `api.dmn` namespace.
 * Executes DMN API requests against real dmn-js DRD diagram-js services.
 *
 * All operations are scoped to the DRD (Decision Requirements Diagram) view.
 * When a document's active view is not DRD, overlay/element/modeling
 * operations are no-ops (or throw for mutating operations) — see the
 * DRD-gating checks on each handler.
 */
export class DmnApiBridge {
  private bifrost: Bifrost;
  private pluginHost: PluginHost;

  /** pluginName → uri → overlay tracking (direct setOverlays/clearOverlays API) */
  private pluginOverlays = new Map<string, Map<string, PluginOverlayEntry>>();

  /** uri → subscription that re-applies deferred direct overlays once the DRD view reactivates. */
  private deferredOverlayReapplySubscriptions = new Map<string, AbstractSubscription>();

  /** pluginName → callbackId → subscription */
  private eventSubscriptions = new Map<string, Map<string, EventSubscription>>();

  /** Editor close subscription for lifecycle management. */
  private editorCloseSubscription: AbstractSubscription | null = null;

  /** Manages registered overlay factories and renders their output directly onto the DRD view. */
  readonly overlayManager: DmnPluginOverlayManager;

  constructor(bifrost: Bifrost, pluginHost: PluginHost) {
    this.bifrost = bifrost;
    this.pluginHost = pluginHost;
    this.overlayManager = new DmnPluginOverlayManager(pluginHost, bifrost);
    this.overlayManager.onRefreshRequested(() => {
      this.emitPluginOverlayFactoriesChanged();
    });
    this.bifrost.registerSharedRessource(PLUGIN_DMN_OVERLAY_MANAGER_KEY, this.overlayManager, true);
    this.subscribeToEditorLifecycle();
  }

  async handleApiRequest(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'setOverlays': {
        const [uri, overlays] = args as [string, PluginDmnOverlay[]];
        return this.handleSetOverlays(uri, overlays, pluginName);
      }
      case 'clearOverlays': {
        const [uri, filter] = args as [string, { elementId?: string } | undefined];
        return this.handleClearOverlays(uri, filter, pluginName);
      }
      case 'getActiveView': {
        const [uri] = args as [string];
        return this.handleGetActiveView(uri);
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
      case 'requestOverlayRefresh': {
        this.overlayManager.invalidateCache();
        this.emitPluginOverlayFactoriesChanged();
        return;
      }
      case 'registerPaletteEntry': {
        const [entry] = args as [{ id: string; group?: string; icon: string; title: string; command: string }];
        pluginDmnContributionStore.addPaletteEntry(pluginName, entry);
        return;
      }
      case 'unregisterPaletteEntry': {
        const [entryId] = args as [string];
        const removed = pluginDmnContributionStore.removePaletteEntry(pluginName, entryId);
        if (!removed) {
          throw new Error(`Palette entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'registerContextPadEntry': {
        const [entry] = args as [
          { id: string; icon: string; title: string; command: string; elementTypes?: string[]; elementIds?: string[] },
        ];
        pluginDmnContributionStore.addContextPadEntry(pluginName, entry);
        return;
      }
      case 'unregisterContextPadEntry': {
        const [entryId] = args as [string];
        const removed = pluginDmnContributionStore.removeContextPadEntry(pluginName, entryId);
        if (!removed) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'updateContextPadEntry': {
        const [entryId, update] = args as [string, { elementIds?: string[] | null }];
        const updated = pluginDmnContributionStore.updateContextPadEntry(pluginName, entryId, update);
        if (!updated) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      // ─── Modeling sub-API ─────────────────────────────────────────────
      case 'modeling.updateProperties': {
        const [uri, elementId, properties] = args as [string, string, Record<string, unknown>];
        return this.handleModelingUpdateProperties(uri, elementId, properties);
      }
      case 'modeling.removeElement': {
        const [uri, elementId] = args as [string, string];
        return this.handleModelingRemoveElement(uri, elementId);
      }
      case 'modeling.appendElement': {
        const [uri, sourceElementId, newElement] = args as [string, string, { type: string; name?: string }];
        return this.handleModelingAppendElement(uri, sourceElementId, newElement);
      }
      case 'modeling.createElement': {
        const [uri, newElement] = args as [string, { type: string; name?: string; position: { x: number; y: number } }];
        return this.handleModelingCreateElement(uri, newElement);
      }
      case 'modeling.createConnection': {
        const [uri, sourceId, targetId, type] = args as [string, string, string, string | undefined];
        return this.handleModelingCreateConnection(uri, sourceId, targetId, type);
      }
      case 'modeling.moveElement': {
        const [uri, elementId, delta] = args as [string, string, { x: number; y: number }];
        return this.handleModelingMoveElement(uri, elementId, delta);
      }
      // ─── Renderer module channel ────────────────────────────────────────
      case 'postToRendererModule': {
        const [data] = args;
        return this.handlePostToRendererModule(pluginName, data);
      }
      default:
        throw new Error(`Unknown dmn API method: ${method}`);
    }
  }

  registerCallback(
    payload: RegisterCallbackPayload,
    getOrCreatePluginGroup: (pluginName: string) => Map<string, { disposer: () => void }>,
  ): void {
    const { callbackId, method, args, pluginName: callerName } = payload;
    const pluginName = callerName ?? '_unknown';

    if (method === 'registerOverlayFactory') {
      const [options] = args as [DmnOverlayFactoryOptions | undefined];
      const priority = options?.priority ?? 100;

      this.overlayManager.registerFactory(pluginName, callbackId, priority);

      const disposer = (): void => {
        this.overlayManager.unregisterFactory(pluginName);
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

    if (method === 'onRendererModuleMessage') {
      const disposer = (): void => {
        this.eventSubscriptions.get(pluginName)?.delete(callbackId);
      };

      if (!this.eventSubscriptions.has(pluginName)) {
        this.eventSubscriptions.set(pluginName, new Map());
      }
      this.eventSubscriptions.get(pluginName)!.set(callbackId, { callbackId, uri: '', method, disposer });
      getOrCreatePluginGroup(pluginName).set(callbackId, { disposer });
      return;
    }

    const [uri] = args as [string];

    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`Cannot subscribe to dmn.${method}: no DMN document open for URI '${uri}'`);
    }

    let disposer: () => void;

    switch (method) {
      case 'onElementSelected': {
        const eventBusHandler = (): void => {
          const selection = adapter.getDrdSelection();
          const selectedElements = selection.get() as any[];
          if (selectedElements.length === 0) {
            this.invokeCallback(callbackId, [{ elementId: '', elementType: '', elementName: null }]);
            return;
          }
          const element = selectedElements[0];
          this.invokeCallback(callbackId, [this.serializeElementEvent(element)]);
        };
        const eventBus = adapter.getDrdEventBus();
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
        const eventBus = adapter.getDrdEventBus();
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
        const eventBus = adapter.getDrdEventBus();
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
        const eventBus = adapter.getDrdEventBus();
        eventBus.on('element.contextmenu', eventBusHandler);
        disposer = () => eventBus.off('element.contextmenu', eventBusHandler);
        break;
      }
      case 'onOverlayContextChanged': {
        const xmlChangedHandler = (): void => {
          const event: DmnOverlayContextEvent = { uri, reason: 'data-updated' };
          this.invokeCallback(callbackId, [event]);
        };
        const selectionHandler = (): void => {
          const event: DmnOverlayContextEvent = { uri, reason: 'selection-changed' };
          this.invokeCallback(callbackId, [event]);
        };
        const viewChangedHandler = (): void => {
          const event: DmnOverlayContextEvent = { uri, reason: 'view-changed' };
          this.invokeCallback(callbackId, [event]);
        };

        const xmlSubscription: AbstractSubscription = adapter.on(EVENT_DMN_ADAPTER_XML_CHANGED, xmlChangedHandler);
        const selectionSubscription: AbstractSubscription = adapter.on(
          EVENT_DMN_ADAPTER_SELECTION_CHANGED,
          selectionHandler,
        );
        const viewSubscription: AbstractSubscription = adapter.on(EVENT_DMN_ADAPTER_VIEW_CHANGED, viewChangedHandler);

        disposer = () => {
          xmlSubscription.dispose();
          selectionSubscription.dispose();
          viewSubscription.dispose();
        };
        break;
      }
      case 'onViewChanged': {
        const eventHandler = (): void => {
          this.invokeCallback(callbackId, [this.serializeViewEvent(uri, adapter)]);
        };
        const subscription: AbstractSubscription = adapter.on(EVENT_DMN_ADAPTER_VIEW_CHANGED, eventHandler);
        disposer = () => subscription.dispose();
        break;
      }
      default: {
        throw new Error(`Unknown dmn callback method: ${method}`);
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

    this.overlayManager.unregisterFactory(pluginName);
    pluginDmnContributionStore.removePaletteEntries(pluginName);
    pluginDmnContributionStore.removeContextPadEntries(pluginName);
  }

  dispose(): void {
    for (const [, overlaysByUri] of this.pluginOverlays) {
      for (const [uri, entry] of overlaysByUri) {
        this.removeOverlayIds(uri, entry.overlayIds);
      }
    }
    this.pluginOverlays.clear();

    for (const [, subscription] of this.deferredOverlayReapplySubscriptions) {
      subscription.dispose();
    }
    this.deferredOverlayReapplySubscriptions.clear();

    for (const [, subscriptions] of this.eventSubscriptions) {
      for (const [, subscription] of subscriptions) {
        subscription.disposer();
      }
    }
    this.eventSubscriptions.clear();

    this.overlayManager.dispose();

    this.editorCloseSubscription?.dispose();
    this.editorCloseSubscription = null;
  }

  // --- Editor lifecycle ---

  private subscribeToEditorLifecycle(): void {
    this.editorCloseSubscription = this.bifrost.editors.on(
      EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
      (editorDocument: EditorDocument) => {
        if (editorDocument.documentType === DMN_DOCUMENT_TYPE) {
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
    this.disposeDeferredOverlayReapplyListener(uri);

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

    this.overlayManager.clearForUri(uri);
  }

  // --- Plugin overlay factory refresh ---

  private emitPluginOverlayFactoriesChanged(): void {
    this.bifrost.events.emit('pluginDmnOverlayFactoriesChanged');
  }

  // --- View awareness ---

  private handleGetActiveView(uri: string): DmnViewChangedEvent | null {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      return null;
    }
    return this.serializeViewEvent(uri, adapter);
  }

  private serializeViewEvent(uri: string, adapter: DmnModelerComponentAdapter): DmnViewChangedEvent {
    const viewType = (adapter.getActiveViewType() ?? 'drd') as DmnViewType;
    const isDrd = viewType === 'drd';
    const decisionId = isDrd ? null : (adapter.getActiveView()?.element?.id ?? null);
    return { uri, viewType, isDrd, decisionId };
  }

  // --- Overlay handling (direct setOverlays/clearOverlays) ---

  private handleSetOverlays(uri: string, overlays: PluginDmnOverlay[], pluginName: string): void {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No DMN document open for URI: ${uri}`);
    }

    if (!this.pluginOverlays.has(pluginName)) {
      this.pluginOverlays.set(pluginName, new Map());
    }
    const pluginMap = this.pluginOverlays.get(pluginName)!;

    const existing = pluginMap.get(uri);
    if (existing != null) {
      this.removeOverlayIds(uri, existing.overlayIds);
    }

    if (!adapter.isDrdActive()) {
      // Store the request but defer rendering — re-applied once DRD reactivates, see
      // ensureDeferredOverlayReapplyListener(). Never silently dropped.
      pluginMap.set(uri, { descriptors: overlays, overlayIds: overlays.map(() => '') });
      this.ensureDeferredOverlayReapplyListener(uri, adapter);
      return;
    }

    const overlayIds = this.applyOverlays(adapter, overlays, pluginName);
    pluginMap.set(uri, { descriptors: overlays, overlayIds });
  }

  /**
   * Ensures a single view-change listener is active for this uri that re-renders any
   * deferred (DRD-inactive) direct overlays from every plugin once the DRD view reactivates.
   */
  private ensureDeferredOverlayReapplyListener(uri: string, adapter: DmnModelerComponentAdapter): void {
    if (this.deferredOverlayReapplySubscriptions.has(uri)) {
      return;
    }

    const handler = (): void => {
      if (!adapter.isDrdActive()) {
        return;
      }
      this.reapplyDeferredOverlays(uri, adapter);
    };

    const subscription: AbstractSubscription = adapter.on(EVENT_DMN_ADAPTER_VIEW_CHANGED, handler);
    this.deferredOverlayReapplySubscriptions.set(uri, subscription);
  }

  private reapplyDeferredOverlays(uri: string, adapter: DmnModelerComponentAdapter): void {
    for (const [pluginName, overlaysByUri] of this.pluginOverlays) {
      const entry = overlaysByUri.get(uri);
      if (entry == null || entry.descriptors.length === 0) {
        continue;
      }
      // Deferred entries carry only empty-string overlayIds; a non-empty id means
      // this entry was already rendered (e.g. set while DRD was active) and needs no reapply.
      const isDeferred = entry.overlayIds.every((overlayId) => overlayId === '');
      if (!isDeferred) {
        continue;
      }
      const overlayIds = this.applyOverlays(adapter, entry.descriptors, pluginName);
      overlaysByUri.set(uri, { descriptors: entry.descriptors, overlayIds });
    }
  }

  private disposeDeferredOverlayReapplyListener(uri: string): void {
    const subscription = this.deferredOverlayReapplySubscriptions.get(uri);
    if (subscription != null) {
      subscription.dispose();
      this.deferredOverlayReapplySubscriptions.delete(uri);
    }
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
      const remainingDescriptors: PluginDmnOverlay[] = [];
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
    adapter: DmnModelerComponentAdapter,
    overlays: PluginDmnOverlay[],
    pluginName: string,
  ): string[] {
    const overlayService = adapter.getDrdOverlays();
    const elementRegistry = adapter.getDrdElementRegistry();
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

  private createOverlayHtmlElement(descriptor: PluginDmnOverlay, pluginName: string): HTMLElement {
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
    } else if (descriptor.type === 'icon' || descriptor.type === 'action') {
      container.classList.add('evil-plugin-overlay--icon');
      const iconElement = document.createElement('i');
      iconElement.className = descriptor.icon;
      container.appendChild(iconElement);
    } else if (descriptor.type === 'status') {
      container.classList.add('evil-plugin-overlay--icon');
      if (descriptor.icon != null) {
        const iconElement = document.createElement('i');
        iconElement.className = descriptor.icon;
        container.appendChild(iconElement);
      }
      if (descriptor.text != null) {
        container.appendChild(document.createTextNode(descriptor.text));
      }
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
            `[DmnApiBridge] Plugin '${pluginName}' overlay click rejected: command '${fullCommandId}' is not owned by this plugin or is not registered`,
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
    if (adapter == null || !adapter.isDrdActive()) {
      return;
    }

    const overlayService = adapter.getDrdOverlays();
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

  // --- Element queries (DRD-only) ---

  private handleGetElements(uri: string): DmnElementSnapshot[] {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No DMN document open for URI: ${uri}`);
    }
    if (!adapter.isDrdActive()) {
      return [];
    }

    return this.buildElementDetailSnapshots(adapter).map((snapshot) => ({
      id: snapshot.id,
      type: snapshot.type,
      name: snapshot.name,
      parentId: snapshot.parentId,
    }));
  }

  private handleGetElement(uri: string, elementId: string): DmnElementDetailSnapshot | null {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No DMN document open for URI: ${uri}`);
    }
    if (!adapter.isDrdActive()) {
      return null;
    }

    const elementRegistry = adapter.getDrdElementRegistry();
    const element = elementRegistry.get(elementId) as any;
    if (element == null) {
      return null;
    }

    return this.buildElementDetailSnapshot(element);
  }

  private async handleGetXml(uri: string): Promise<string> {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No DMN document open for URI: ${uri}`);
    }

    try {
      return await adapter.getXml();
    } catch {
      throw new Error(`Failed to export DMN XML for URI: ${uri}`);
    }
  }

  // --- Modeling operations (DRD-only) ---

  private handleModelingUpdateProperties(uri: string, elementId: string, properties: Record<string, unknown>): void {
    const adapter = this.assertDrdActiveAdapter(uri);

    const elementRegistry = adapter.getDrdElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      throw new Error(`Element '${elementId}' not found in document`);
    }

    const blockedKeys = new Set(['$parent', '$type', 'di', '$attrs', '$descriptor', 'id']);
    for (const key of Object.keys(properties)) {
      if (blockedKeys.has(key)) {
        throw new Error(`Property '${key}' cannot be set via modeling API (internal/structural property)`);
      }
      const value = properties[key];
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        throw new Error(`Property '${key}' must be a primitive or array-of-primitives, got object`);
      }
      if (Array.isArray(value)) {
        const allPrimitive = value.every(
          (item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
        );
        if (!allPrimitive) {
          throw new Error(`Property '${key}' array contains non-primitive values`);
        }
      }
    }

    const modeling = adapter.getDrdModeling();
    modeling.updateProperties(element, properties);
  }

  private handleModelingRemoveElement(uri: string, elementId: string): void {
    const adapter = this.assertDrdActiveAdapter(uri);

    const elementRegistry = adapter.getDrdElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      throw new Error(`Element '${elementId}' not found in document`);
    }

    if (element.parent == null) {
      throw new Error(`Cannot remove root element '${elementId}'`);
    }

    const modeling = adapter.getDrdModeling();
    modeling.removeElements([element]);
  }

  private handleModelingCreateElement(
    uri: string,
    newElement: { type: string; name?: string; position: { x: number; y: number } },
  ): { elementId: string } {
    const adapter = this.assertDrdActiveAdapter(uri);

    if (typeof newElement?.type !== 'string' || newElement.type.trim().length === 0) {
      throw new Error(`'type' is required and must be a non-empty string`);
    }
    if (!Number.isFinite(newElement?.position?.x) || !Number.isFinite(newElement?.position?.y)) {
      throw new Error(`'position' must contain finite numbers for x and y`);
    }

    const modeling = adapter.getDrdModeling();
    const elementFactory = adapter.getModelerComponentByName<any>('elementFactory');
    const canvas = adapter.getDrdCanvas();

    const shape = elementFactory.createShape({ type: newElement.type });
    if (newElement.name != null) {
      shape.businessObject.name = newElement.name;
    }

    const rootElement = canvas.getRootElement();
    const created = modeling.createShape(shape, newElement.position, rootElement);

    return { elementId: created.id };
  }

  private handleModelingAppendElement(
    uri: string,
    sourceElementId: string,
    newElement: { type: string; name?: string },
  ): { elementId: string } {
    const adapter = this.assertDrdActiveAdapter(uri);

    const elementRegistry = adapter.getDrdElementRegistry();
    const sourceElement = elementRegistry.get(sourceElementId);
    if (sourceElement == null) {
      throw new Error(`Source element '${sourceElementId}' not found in document`);
    }

    if (typeof newElement?.type !== 'string' || newElement.type.trim().length === 0) {
      throw new Error(`'type' is required and must be a non-empty string`);
    }

    const modeling = adapter.getDrdModeling();
    const elementFactory = adapter.getModelerComponentByName<any>('elementFactory');

    const shape = elementFactory.createShape({ type: newElement.type });
    if (newElement.name != null) {
      shape.businessObject.name = newElement.name;
    }

    const position = {
      x: sourceElement.x + sourceElement.width + 130,
      y: sourceElement.y + sourceElement.height / 2,
    };

    const appended = modeling.appendShape(sourceElement, shape, position, sourceElement.parent);

    return { elementId: appended.id };
  }

  private handleModelingCreateConnection(
    uri: string,
    sourceId: string,
    targetId: string,
    type?: string,
  ): { connectionId: string } {
    const adapter = this.assertDrdActiveAdapter(uri);

    const elementRegistry = adapter.getDrdElementRegistry();
    const sourceElement = elementRegistry.get(sourceId);
    if (sourceElement == null) {
      throw new Error(`Source element '${sourceId}' not found in document`);
    }
    const targetElement = elementRegistry.get(targetId);
    if (targetElement == null) {
      throw new Error(`Target element '${targetId}' not found in document`);
    }

    const connectionType = type ?? 'dmn:InformationRequirement';

    const modeling = adapter.getDrdModeling();
    const elementFactory = adapter.getModelerComponentByName<any>('elementFactory');

    const connection = elementFactory.createConnection({
      type: connectionType,
      source: sourceElement,
      target: targetElement,
    });

    const created = modeling.createConnection(sourceElement, targetElement, connection, sourceElement.parent);

    return { connectionId: created.id };
  }

  private handleModelingMoveElement(uri: string, elementId: string, delta: { x: number; y: number }): void {
    const adapter = this.assertDrdActiveAdapter(uri);

    const elementRegistry = adapter.getDrdElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      throw new Error(`Element '${elementId}' not found in document`);
    }

    if (!Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) {
      throw new Error(`Delta must contain finite numbers for x and y`);
    }

    const modeling = adapter.getDrdModeling();
    modeling.moveElements([element], delta);
  }

  // --- Helpers ---

  private resolveAdapter(uri: string): DmnModelerComponentAdapter | null {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null || editorDocument.documentType !== DMN_DOCUMENT_TYPE) {
      return null;
    }

    const documentModel = this.bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
    if (documentModel == null) {
      return null;
    }

    return (documentModel as any).modelerAdapter ?? null;
  }

  /** Resolves the adapter for a modeling operation, rejecting when no document is open or the DRD view is not active. */
  private assertDrdActiveAdapter(uri: string): DmnModelerComponentAdapter {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No DMN document open for URI: ${uri}`);
    }
    if (!adapter.isDrdActive()) {
      throw new Error(`Cannot perform modeling operation on URI '${uri}': the DRD view is not active`);
    }
    return adapter;
  }

  private serializeElementEvent(element: any): DmnElementEvent {
    return {
      elementId: element.id ?? '',
      elementType: element.type ?? '',
      elementName: element.businessObject?.name ?? null,
    };
  }

  private buildElementDetailSnapshots(adapter: DmnModelerComponentAdapter): DmnElementDetailSnapshot[] {
    const elementRegistry = adapter.getDrdElementRegistry();
    const elements = elementRegistry.filter(() => true) as any[];
    return elements.map((element) => this.buildElementDetailSnapshot(element));
  }

  private buildElementDetailSnapshot(element: any): DmnElementDetailSnapshot {
    const businessObject = element.businessObject;
    const properties = this.serializeBusinessObjectProperties(businessObject);

    const incoming: string[] = [];
    const outgoing: string[] = [];

    for (const requirement of businessObject?.informationRequirement ?? []) {
      if (requirement.requiredDecision?.id != null) {
        incoming.push(requirement.requiredDecision.id);
      }
      if (requirement.requiredInput?.id != null) {
        incoming.push(requirement.requiredInput.id);
      }
    }
    for (const requirement of businessObject?.knowledgeRequirement ?? []) {
      if (requirement.requiredKnowledge?.id != null) {
        incoming.push(requirement.requiredKnowledge.id);
      }
    }
    for (const requirement of businessObject?.authorityRequirement ?? []) {
      if (requirement.requiredAuthority?.id != null) {
        incoming.push(requirement.requiredAuthority.id);
      }
      if (requirement.requiredDecision?.id != null) {
        incoming.push(requirement.requiredDecision.id);
      }
      if (requirement.requiredInput?.id != null) {
        incoming.push(requirement.requiredInput.id);
      }
    }

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

  private serializeBusinessObjectProperties(businessObject: any): Record<string, unknown> {
    if (businessObject == null) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(businessObject)) {
      if (
        key.startsWith('$') ||
        key === 'di' ||
        key === 'informationRequirement' ||
        key === 'knowledgeRequirement' ||
        key === 'authorityRequirement'
      ) {
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

  // ─── Renderer module channel ──────────────────────────────────────

  private handlePostToRendererModule(pluginName: string, data: unknown): void {
    const channel = pluginDmnModuleLoader.getChannel(pluginName);
    if (channel == null) {
      throw new Error(
        `Plugin '${pluginName}' has no loaded renderer modules. ` +
          `Declare 'dmnModules' in the manifest and request 'dmn.renderer' permission.`,
      );
    }
    channel.deliverMessage(data);
  }

  /**
   * Deliver a message from a renderer module to the plugin host.
   * Called by PluginHostBridge when it receives a PH_RENDERER_MODULE_MESSAGE.
   */
  deliverRendererModuleMessage(pluginName: string, data: unknown): void {
    const subscriptions = this.eventSubscriptions.get(pluginName);
    if (subscriptions == null) {
      return;
    }
    for (const [, subscription] of subscriptions) {
      if (subscription.method === 'onRendererModuleMessage') {
        this.invokeCallback(subscription.callbackId, [data]);
      }
    }
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
