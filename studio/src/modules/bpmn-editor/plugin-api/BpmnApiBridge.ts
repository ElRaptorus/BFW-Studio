import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { CallbackInvocationPayload, RegisterCallbackPayload } from '#bifrost/contracts/PluginHostProtocol';
import { PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';
import { EVENT_EDITOR_AREA_DOCUMENT_CLOSED } from '#bifrost/contracts/internal/EditorEvents';

import type {
  BpmnElementDetailSnapshot,
  BpmnElementEvent,
  BpmnElementSnapshot,
  OverlayContextEvent,
  OverlayFactoryOptions,
  PluginBpmnElementType,
  PluginBpmnOverlay,
} from '@elraptorus/bfw_studio_sdk';

import { EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED } from '../../../modules/bpmn-core/BpmnModelerComponentAdapter';
import type BpmnModelerComponentAdapter from '../../../modules/bpmn-core/BpmnModelerComponentAdapter';
import { pluginBpmnContributionStore } from '../../../modules/bpmn-core/PluginBpmnContributionStore';
import { pluginModuleLoader } from '../../../modules/bpmn-core/plugin-modules/PluginModuleLoader';
import type BpmnDocumentModel from '../../../modules/bpmn-editor/BpmnDocumentModel';
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
      case 'requestOverlayRefresh': {
        this.overlayStore.invalidateCache();
        this.emitPluginOverlayFactoriesChanged();
        return;
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
          this.invokeCallback(callbackId, [this.serializeElementEvent(uri, element)]);
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
          this.invokeCallback(callbackId, [this.serializeElementEvent(uri, event.element)]);
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
          this.invokeCallback(callbackId, [this.serializeElementEvent(uri, event.element)]);
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
          this.invokeCallback(callbackId, [this.serializeElementEvent(uri, event.element)]);
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
    container.className = 'bfw-plugin-overlay';

    if (descriptor.style != null) {
      container.classList.add(`bfw-plugin-overlay--${descriptor.style}`);
    }

    if (descriptor.tooltip != null) {
      container.title = descriptor.tooltip;
    }

    if (descriptor.type === 'badge') {
      container.classList.add('bfw-plugin-overlay--badge');
      const textNode = document.createTextNode(descriptor.text);
      container.appendChild(textNode);
    } else if (descriptor.type === 'icon') {
      container.classList.add('bfw-plugin-overlay--icon');
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
    const documentModel = this.resolveBpmnDocumentModel(uri);
    if (documentModel == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const snapshots = this.overlayStore.toElementSnapshots(documentModel.elements.getAllElements());
    return snapshots.map(({ id, type, name, parentId }) => ({ id, type, name, parentId }));
  }

  private handleGetElement(uri: string, elementId: string): BpmnElementDetailSnapshot | null {
    const documentModel = this.resolveBpmnDocumentModel(uri);
    if (documentModel == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const element = documentModel.elements.getById(elementId);
    if (element == null) {
      return null;
    }

    return this.overlayStore.toElementSnapshots([element])[0] ?? null;
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

  // --- Modeling operations ---

  private handleModelingUpdateProperties(uri: string, elementId: string, properties: Record<string, unknown>): void {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
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

    const modeling = adapter.getModelerComponentByName<any>('modeling');
    modeling.updateProperties(element, properties);
  }

  private handleModelingRemoveElement(uri: string, elementId: string): void {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      throw new Error(`Element '${elementId}' not found in document`);
    }

    if (element.parent == null) {
      throw new Error(`Cannot remove root element '${elementId}'`);
    }

    const modeling = adapter.getModelerComponentByName<any>('modeling');
    modeling.removeElements([element]);
  }

  private handleModelingAppendElement(
    uri: string,
    sourceElementId: string,
    newElement: { type: string; name?: string },
  ): { elementId: string } {
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const sourceElement = elementRegistry.get(sourceElementId);
    if (sourceElement == null) {
      throw new Error(`Source element '${sourceElementId}' not found in document`);
    }

    if (typeof newElement?.type !== 'string' || newElement.type.trim().length === 0) {
      throw new Error(`'type' is required and must be a non-empty string`);
    }

    const modeling = adapter.getModelerComponentByName<any>('modeling');
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
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const sourceElement = elementRegistry.get(sourceId);
    if (sourceElement == null) {
      throw new Error(`Source element '${sourceId}' not found in document`);
    }
    const targetElement = elementRegistry.get(targetId);
    if (targetElement == null) {
      throw new Error(`Target element '${targetId}' not found in document`);
    }

    const connectionType = type ?? 'bpmn:SequenceFlow';

    const modeling = adapter.getModelerComponentByName<any>('modeling');
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
    const adapter = this.resolveAdapter(uri);
    if (adapter == null) {
      throw new Error(`No BPMN document open for URI: ${uri}`);
    }

    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(elementId);
    if (element == null) {
      throw new Error(`Element '${elementId}' not found in document`);
    }

    if (!Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) {
      throw new Error(`Delta must contain finite numbers for x and y`);
    }

    const modeling = adapter.getModelerComponentByName<any>('modeling');
    modeling.moveElements([element], delta);
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

  private resolveBpmnDocumentModel(uri: string): BpmnDocumentModel | null {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
      return null;
    }

    return this.bifrost.editors.getEditorDocumentModelIfPresent(editorDocument) as BpmnDocumentModel | null;
  }

  private serializeElementEvent(uri: string, element: any): BpmnElementEvent {
    const documentModel = this.resolveBpmnDocumentModel(uri);
    const typed = element?.id != null ? documentModel?.elements.getById(element.id) : null;
    return {
      elementId: typed?.id ?? element?.id ?? '',
      elementType: (typed?.type ?? '') as PluginBpmnElementType | '',
      elementName: typed?.name ? typed.name : (element?.businessObject?.name ?? null),
    };
  }

  // ─── Renderer module channel ──────────────────────────────────────

  private handlePostToRendererModule(pluginName: string, data: unknown): void {
    const channel = pluginModuleLoader.getChannel(pluginName);
    if (channel == null) {
      throw new Error(
        `Plugin '${pluginName}' has no loaded renderer modules. ` +
          `Declare 'bpmnModules' in the manifest and request 'bpmn.renderer' permission.`,
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
