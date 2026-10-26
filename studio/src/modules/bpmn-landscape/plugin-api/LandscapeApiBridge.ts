import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { PluginDiagramOverlayManager } from '#bifrost/common/plugin-host/PluginDiagramOverlayManager';
import type { BifrostStudioManifest } from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { CallbackInvocationPayload, RegisterCallbackPayload } from '#bifrost/contracts/PluginHostProtocol';
import { PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';
import type {
  PluginApiNamespace,
  PluginApiNamespaceContext,
  PluginCallbackGroup,
} from '#bifrost/contracts/PluginHostTypes';
import { EVENT_EDITOR_AREA_DOCUMENT_CLOSED } from '#bifrost/contracts/internal/EditorEvents';

import type {
  LandscapeCreateElementDescriptor,
  LandscapeElementSnapshot,
  LandscapeMoveDelta,
  LandscapeOverlayContextEvent,
  LandscapeOverlayFactoryOptions,
  PluginLandscapeOverlay,
} from '@elraptorus/bfw_studio_sdk';

import type LandscapeMapDocumentModel from '../LandscapeMapDocumentModel';
import { LANDSCAPE_DOCUMENT_TYPE } from '../landscapeFolder';
import type LandscapeModeler from '../modeler/LandscapeModeler';
import { LandscapeModelingOperations } from './LandscapeModelingOperations';
import { landscapeContributionStore, landscapePluginModuleLoader } from './landscapePluginModules';
import {
  elementEventOf,
  fingerprintOfSnapshot,
  snapshotLandscapeElements,
  snapshotOfCanvasElement,
} from './landscapeSnapshots';

export const PLUGIN_LANDSCAPE_OVERLAY_MANAGER_KEY = 'landscape.pluginOverlayManager';

interface DirectOverlayEntry {
  descriptors: PluginLandscapeOverlay[];
  overlayIds: string[];
  overlayService: any;
}

interface EventSubscription {
  callbackId: string;
  uri: string;
  method: string;
  disposer: () => void;
}

/** The diagram-js events whose payload carries the element a plugin callback is about. */
const ELEMENT_EVENT_BY_METHOD: Record<string, string> = {
  onElementHover: 'element.hover',
  onElementDoubleClick: 'element.dblclick',
  onElementContextMenu: 'element.contextmenu',
};

/**
 * Renderer-side bridge for the `api.landscape` namespace. Executes landscape API requests against the diagram-js
 * services of the open landscape maps (`.bfwmap`). Overlays are drawn on the plane on screen.
 */
export class LandscapeApiBridge implements PluginApiNamespace {
  readonly namespace = 'landscape';

  private readonly bifrost: Bifrost;
  private readonly pluginHost: PluginApiNamespaceContext['pluginHost'];
  private readonly modelingOperations: LandscapeModelingOperations;

  /** pluginName → uri → overlays placed with `setOverlays` */
  private readonly directOverlays = new Map<string, Map<string, DirectOverlayEntry>>();

  /** uri → removes the listener that draws the direct overlays again once the map was imported anew. */
  private readonly reapplyListeners = new Map<string, () => void>();

  /** pluginName → callbackId → subscription */
  private readonly eventSubscriptions = new Map<string, Map<string, EventSubscription>>();

  private editorCloseSubscription: AbstractSubscription | null = null;

  /** Resolves the overlay factories of all plugins and draws their result on a map. */
  readonly overlayManager: PluginDiagramOverlayManager<LandscapeElementSnapshot>;

  constructor(bifrost: Bifrost, context: PluginApiNamespaceContext) {
    this.bifrost = bifrost;
    this.pluginHost = context.pluginHost;
    this.modelingOperations = new LandscapeModelingOperations(bifrost);
    landscapePluginModuleLoader.setSendFunction(context.deliverRendererModuleMessage);
    this.overlayManager = new PluginDiagramOverlayManager<LandscapeElementSnapshot>(context.pluginHost, bifrost, {
      diagramLabel: 'Landscape',
      fingerprintOf: fingerprintOfSnapshot,
    });
    this.overlayManager.onRefreshRequested(() => this.emitOverlayFactoriesChanged());
    this.bifrost.registerSharedRessource(PLUGIN_LANDSCAPE_OVERLAY_MANAGER_KEY, this.overlayManager, true);
    this.editorCloseSubscription = this.bifrost.editors.on(
      EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
      (editorDocument: EditorDocument) => {
        if (editorDocument.documentType === LANDSCAPE_DOCUMENT_TYPE) {
          this.handleDocumentClosed(editorDocument.uri);
        }
      },
    );
  }

  async handleApiRequest(method: string, args: unknown[], pluginName: string): Promise<unknown> {
    switch (method) {
      case 'setOverlays': {
        const [uri, overlays] = args as [string, PluginLandscapeOverlay[]];
        return this.handleSetOverlays(uri, overlays, pluginName);
      }
      case 'clearOverlays': {
        const [uri, filter] = args as [string, { elementId?: string } | undefined];
        return this.handleClearOverlays(uri, filter, pluginName);
      }
      case 'getElements': {
        const [uri] = args as [string];
        return snapshotLandscapeElements(this.requireModeler(uri), uri, 'all');
      }
      case 'getElement': {
        const [uri, elementId] = args as [string, string];
        return this.handleGetElement(uri, elementId);
      }
      case 'getXml': {
        const [uri] = args as [string];
        return this.requireDocumentModel(uri).getText();
      }
      case 'requestOverlayRefresh': {
        this.overlayManager.invalidateCache();
        this.emitOverlayFactoriesChanged();
        return;
      }
      case 'registerPaletteEntry': {
        const [entry] = args as Parameters<typeof landscapeContributionStore.addPaletteEntry>[1][];
        landscapeContributionStore.addPaletteEntry(pluginName, entry);
        return;
      }
      case 'unregisterPaletteEntry': {
        const [entryId] = args as [string];
        if (!landscapeContributionStore.removePaletteEntry(pluginName, entryId)) {
          throw new Error(`Palette entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'registerContextPadEntry': {
        const [entry] = args as Parameters<typeof landscapeContributionStore.addContextPadEntry>[1][];
        landscapeContributionStore.addContextPadEntry(pluginName, entry);
        return;
      }
      case 'unregisterContextPadEntry': {
        const [entryId] = args as [string];
        if (!landscapeContributionStore.removeContextPadEntry(pluginName, entryId)) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'updateContextPadEntry': {
        const [entryId, update] = args as [string, { elementIds?: string[] | null }];
        if (!landscapeContributionStore.updateContextPadEntry(pluginName, entryId, update)) {
          throw new Error(`Context pad entry '${entryId}' not found for plugin '${pluginName}'`);
        }
        return;
      }
      case 'postToRendererModule': {
        const [data] = args;
        return this.handlePostToRendererModule(pluginName, data);
      }
      default:
        return this.handleModelingRequest(method, args);
    }
  }

  registerCallback(
    payload: RegisterCallbackPayload,
    getOrCreatePluginGroup: (pluginName: string) => PluginCallbackGroup,
  ): void {
    const { callbackId, method, args, pluginName: callerName } = payload;
    const pluginName = callerName ?? '_unknown';

    if (method === 'registerOverlayFactory') {
      const [options] = args as [LandscapeOverlayFactoryOptions | undefined];
      this.overlayManager.registerFactory(pluginName, callbackId, options?.priority ?? 100);
      this.trackSubscription(
        pluginName,
        callbackId,
        '',
        method,
        () => this.overlayManager.unregisterFactory(pluginName),
        getOrCreatePluginGroup,
      );
      queueMicrotask(() => this.emitOverlayFactoriesChanged());
      return;
    }

    if (method === 'onRendererModuleMessage') {
      this.trackSubscription(
        pluginName,
        callbackId,
        '',
        method,
        () => this.eventSubscriptions.get(pluginName)?.delete(callbackId),
        getOrCreatePluginGroup,
      );
      return;
    }

    const [uri] = args as [string];
    const modeler = this.resolveModeler(uri);
    if (modeler == null) {
      throw new Error(`Cannot subscribe to landscape.${method}: no landscape map open for URI '${uri}'`);
    }
    this.trackSubscription(
      pluginName,
      callbackId,
      uri,
      method,
      this.subscribeToModeler(method, callbackId, uri, modeler),
      getOrCreatePluginGroup,
    );
  }

  registerContributions(
    pluginName: string,
    pluginPath: string | undefined,
    manifest: BifrostStudioManifest,
  ): (() => void)[] {
    const disposers: (() => void)[] = [];
    const contributes = manifest.contributes;
    if (contributes == null) {
      return disposers;
    }
    const hasModelling =
      manifest.permissions?.includes('landscape.modelling') === true ||
      manifest.permissions?.includes('landscape.renderer') === true;

    if (hasModelling && contributes.landscapePalette != null && contributes.landscapePalette.length > 0) {
      landscapeContributionStore.setPaletteEntries(pluginName, contributes.landscapePalette);
      disposers.push(() => landscapeContributionStore.removePaletteEntries(pluginName));
    }
    if (hasModelling && contributes.landscapeContextPad != null && contributes.landscapeContextPad.length > 0) {
      landscapeContributionStore.setContextPadEntries(pluginName, contributes.landscapeContextPad);
      disposers.push(() => landscapeContributionStore.removeContextPadEntries(pluginName));
    }

    const hasRenderer = manifest.permissions?.includes('landscape.renderer') === true;
    if (
      hasRenderer &&
      contributes.landscapeModules != null &&
      contributes.landscapeModules.length > 0 &&
      pluginPath != null
    ) {
      const result = landscapePluginModuleLoader.loadPluginModules(
        pluginName,
        pluginPath,
        contributes.landscapeModules,
      );
      if (result.success) {
        this.forceReopenLandscapeEditors(pluginName, 'enabled');
        disposers.push(() => {
          landscapePluginModuleLoader.unloadPluginModules(pluginName);
          this.forceReopenLandscapeEditors(pluginName, 'disabled');
        });
      } else {
        console.error(`[LandscapeApiBridge] Plugin '${pluginName}' renderer module load failed: ${result.error}`);
        this.bifrost.notifications.open({
          type: 'error',
          content: `Plugin '${pluginName}' failed to load renderer modules: ${result.error}`,
          source: pluginName,
        });
      }
    }

    return disposers;
  }

  disposePlugin(pluginName: string): void {
    for (const [uri, entry] of this.directOverlays.get(pluginName) ?? []) {
      this.overlayManager.removeOverlays(entry.overlayService, entry.overlayIds);
      this.stopReapplyListenerWithoutOverlays(uri);
    }
    this.directOverlays.delete(pluginName);

    for (const subscription of this.eventSubscriptions.get(pluginName)?.values() ?? []) {
      subscription.disposer();
    }
    this.eventSubscriptions.delete(pluginName);

    this.overlayManager.unregisterFactory(pluginName);
    landscapeContributionStore.removePaletteEntries(pluginName);
    landscapeContributionStore.removeContextPadEntries(pluginName);
  }

  dispose(): void {
    for (const overlaysByUri of this.directOverlays.values()) {
      for (const entry of overlaysByUri.values()) {
        this.overlayManager.removeOverlays(entry.overlayService, entry.overlayIds);
      }
    }
    this.directOverlays.clear();
    this.reapplyListeners.forEach((removeListener) => removeListener());
    this.reapplyListeners.clear();
    for (const subscriptions of this.eventSubscriptions.values()) {
      subscriptions.forEach((subscription) => subscription.disposer());
    }
    this.eventSubscriptions.clear();
    this.overlayManager.dispose();
    this.editorCloseSubscription?.dispose();
    this.editorCloseSubscription = null;
  }

  /** Delivers a message from a renderer module to the plugin host; called by the plugin host bridge. */
  deliverRendererModuleMessage(pluginName: string, data: unknown): void {
    for (const subscription of this.eventSubscriptions.get(pluginName)?.values() ?? []) {
      if (subscription.method === 'onRendererModuleMessage') {
        this.invokeCallback(subscription.callbackId, [data]);
      }
    }
  }

  // ─── Event subscriptions ────────────────────────────────────────────

  private trackSubscription(
    pluginName: string,
    callbackId: string,
    uri: string,
    method: string,
    disposer: () => void,
    getOrCreatePluginGroup: (pluginName: string) => PluginCallbackGroup,
  ): void {
    if (!this.eventSubscriptions.has(pluginName)) {
      this.eventSubscriptions.set(pluginName, new Map());
    }
    this.eventSubscriptions.get(pluginName)?.set(callbackId, { callbackId, uri, method, disposer });
    getOrCreatePluginGroup(pluginName).set(callbackId, { disposer });
  }

  /** Listens on the map's event bus for what `method` reports; returns the function that stops listening. */
  private subscribeToModeler(method: string, callbackId: string, uri: string, modeler: LandscapeModeler): () => void {
    const eventBus = modeler.get('eventBus');
    const listen = (eventName: string, handler: (event: any) => void): (() => void) => {
      eventBus.on(eventName, handler);
      return () => eventBus.off(eventName, handler);
    };

    if (method === 'onElementSelected') {
      return listen('selection.changed', ({ newSelection }: { newSelection: any[] }) => {
        const selected = newSelection[0];
        const event =
          selected == null
            ? { elementId: '', elementType: '', elementName: null }
            : elementEventOf(snapshotOfCanvasElement(uri, selected));
        this.invokeCallback(callbackId, [event]);
      });
    }

    const elementEventName = ELEMENT_EVENT_BY_METHOD[method];
    if (elementEventName != null) {
      return listen(elementEventName, ({ element }: { element: any }) => {
        if (element?.parent == null || element.businessObject == null) {
          return;
        }
        this.invokeCallback(callbackId, [elementEventOf(snapshotOfCanvasElement(uri, element))]);
      });
    }

    if (method === 'onOverlayContextChanged') {
      const notify = (reason: LandscapeOverlayContextEvent['reason']) => (): void =>
        this.invokeCallback(callbackId, [{ uri, reason } satisfies LandscapeOverlayContextEvent]);
      const stops = [
        listen('commandStack.changed', notify('data-updated')),
        listen('root.set', notify('data-updated')),
        listen('selection.changed', notify('selection-changed')),
      ];
      // The map is already open: tell the plugin once, so it draws its first overlays.
      queueMicrotask(notify('document-opened'));
      return () => stops.forEach((stop) => stop());
    }

    throw new Error(`Unknown landscape callback method: ${method}`);
  }

  // ─── Overlays placed with setOverlays ───────────────────────────────

  private handleSetOverlays(uri: string, overlays: PluginLandscapeOverlay[], pluginName: string): void {
    const modeler = this.requireModeler(uri);
    if (!Array.isArray(overlays)) {
      throw new Error(`'overlays' must be an array`);
    }
    this.removeDirectOverlays(pluginName, uri);

    const target = { overlays: modeler.get('overlays'), elementRegistry: modeler.get('elementRegistry') };
    const overlayIds = overlays.map((descriptor) => this.overlayManager.addOverlay(target, descriptor, pluginName));
    if (!this.directOverlays.has(pluginName)) {
      this.directOverlays.set(pluginName, new Map());
    }
    this.directOverlays
      .get(pluginName)
      ?.set(uri, { descriptors: overlays, overlayIds, overlayService: target.overlays });
    this.ensureReapplyListener(uri, modeler);
  }

  private handleClearOverlays(uri: string, filter: { elementId?: string } | undefined, pluginName: string): void {
    const entry = this.directOverlays.get(pluginName)?.get(uri);
    if (entry == null) {
      return;
    }
    if (filter?.elementId == null) {
      this.removeDirectOverlays(pluginName, uri);
      return;
    }
    const keptIndexes = entry.descriptors.flatMap((descriptor, index) =>
      descriptor.elementId === filter.elementId ? [] : [index],
    );
    const removedIds = entry.overlayIds.filter((_overlayId, index) => !keptIndexes.includes(index));
    this.overlayManager.removeOverlays(entry.overlayService, removedIds);
    entry.descriptors = keptIndexes.map((index) => entry.descriptors[index]);
    entry.overlayIds = keptIndexes.map((index) => entry.overlayIds[index]);
    if (entry.descriptors.length === 0) {
      this.removeDirectOverlays(pluginName, uri);
    }
  }

  private removeDirectOverlays(pluginName: string, uri: string): void {
    const overlaysByUri = this.directOverlays.get(pluginName);
    const entry = overlaysByUri?.get(uri);
    if (overlaysByUri == null || entry == null) {
      return;
    }
    this.overlayManager.removeOverlays(entry.overlayService, entry.overlayIds);
    overlaysByUri.delete(uri);
    this.stopReapplyListenerWithoutOverlays(uri);
  }

  /**
   * A map that is imported anew (the file changed on disk) drops its overlays with its shapes. The import ends with
   * a `clear` of the command stack, after which the overlays of every plugin are drawn again.
   */
  private ensureReapplyListener(uri: string, modeler: LandscapeModeler): void {
    if (this.reapplyListeners.has(uri)) {
      return;
    }
    const eventBus = modeler.get('eventBus');
    const handler = ({ trigger }: { trigger?: string }): void => {
      if (trigger === 'clear') {
        this.reapplyDirectOverlays(uri, modeler);
      }
    };
    eventBus.on('commandStack.changed', handler);
    this.reapplyListeners.set(uri, () => eventBus.off('commandStack.changed', handler));
  }

  private reapplyDirectOverlays(uri: string, modeler: LandscapeModeler): void {
    const target = { overlays: modeler.get('overlays'), elementRegistry: modeler.get('elementRegistry') };
    for (const [pluginName, overlaysByUri] of this.directOverlays) {
      const entry = overlaysByUri.get(uri);
      if (entry != null) {
        entry.overlayIds = entry.descriptors.map((descriptor) =>
          this.overlayManager.addOverlay(target, descriptor, pluginName),
        );
        entry.overlayService = target.overlays;
      }
    }
  }

  private stopReapplyListenerWithoutOverlays(uri: string): void {
    const stillUsed = [...this.directOverlays.values()].some((overlaysByUri) => overlaysByUri.has(uri));
    if (!stillUsed) {
      this.reapplyListeners.get(uri)?.();
      this.reapplyListeners.delete(uri);
    }
  }

  private handleDocumentClosed(uri: string): void {
    for (const [pluginName, overlaysByUri] of this.directOverlays) {
      overlaysByUri.delete(uri);
      if (overlaysByUri.size === 0) {
        this.directOverlays.delete(pluginName);
      }
    }
    this.reapplyListeners.get(uri)?.();
    this.reapplyListeners.delete(uri);

    for (const [pluginName, subscriptions] of this.eventSubscriptions) {
      for (const [callbackId, subscription] of subscriptions) {
        if (subscription.uri === uri) {
          subscription.disposer();
          subscriptions.delete(callbackId);
        }
      }
      if (subscriptions.size === 0) {
        this.eventSubscriptions.delete(pluginName);
      }
    }
    this.overlayManager.clearForUri(uri);
  }

  private emitOverlayFactoriesChanged(): void {
    this.bifrost.events.emit('pluginLandscapeOverlayFactoriesChanged');
  }

  // ─── Element queries and modeling ───────────────────────────────────

  private handleGetElement(uri: string, elementId: string): LandscapeElementSnapshot | null {
    const element = this.requireModeler(uri).get('elementRegistry').get(elementId);
    if (element?.parent == null || element.businessObject == null) {
      return null;
    }
    return snapshotOfCanvasElement(uri, element);
  }

  private handleModelingRequest(method: string, args: unknown[]): unknown {
    switch (method) {
      case 'modeling.updateProperties': {
        const [uri, elementId, properties] = args as [string, string, Record<string, unknown>];
        return this.modelingOperations.updateProperties(uri, this.requireModeler(uri), elementId, properties);
      }
      case 'modeling.removeElement': {
        const [uri, elementId] = args as [string, string];
        return this.modelingOperations.removeElement(this.requireModeler(uri), elementId);
      }
      case 'modeling.createElement': {
        const [uri, newElement] = args as [string, LandscapeCreateElementDescriptor];
        return this.modelingOperations.createElement(uri, this.requireModeler(uri), newElement);
      }
      case 'modeling.appendElement': {
        const [uri, sourceElementId, newElement] = args as [
          string,
          string,
          Omit<LandscapeCreateElementDescriptor, 'position'>,
        ];
        return this.modelingOperations.appendElement(uri, this.requireModeler(uri), sourceElementId, newElement);
      }
      case 'modeling.createConnection': {
        const [uri, sourceId, targetId] = args as [string, string, string];
        return this.modelingOperations.createConnection(this.requireModeler(uri), sourceId, targetId);
      }
      case 'modeling.moveElement': {
        const [uri, elementId, delta] = args as [string, string, LandscapeMoveDelta];
        return this.modelingOperations.moveElement(this.requireModeler(uri), elementId, delta);
      }
      default:
        throw new Error(`Unknown landscape API method: ${method}`);
    }
  }

  // ─── Renderer module channel ────────────────────────────────────────

  private handlePostToRendererModule(pluginName: string, data: unknown): void {
    const channel = landscapePluginModuleLoader.getChannel(pluginName);
    if (channel == null) {
      throw new Error(
        `Plugin '${pluginName}' has no loaded renderer modules. ` +
          `Declare 'landscapeModules' in the manifest and request 'landscape.renderer' permission.`,
      );
    }
    channel.deliverMessage(data);
  }

  private forceReopenLandscapeEditors(pluginName: string, change: 'enabled' | 'disabled'): void {
    const landscapeDocuments = this.bifrost.editors
      .getOpenEditorDocuments()
      .filter((document) => document.documentType === LANDSCAPE_DOCUMENT_TYPE);
    if (landscapeDocuments.length === 0) {
      return;
    }
    const uris = landscapeDocuments.map((document) => document.uri);

    void (async () => {
      for (const document of landscapeDocuments) {
        await this.bifrost.editors.closeEditorDocument(document, false, true);
      }
      for (const uri of uris) {
        this.bifrost.editors.focusOrOpenEditorDocument(uri);
      }
      this.bifrost.notifications.open({
        type: 'info',
        content: `Plugin '${pluginName}' ${change}. Landscape maps have been reloaded.`,
        source: 'Plugins',
      });
    })();
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private resolveDocumentModel(uri: string): LandscapeMapDocumentModel | null {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(uri);
    if (editorDocument == null || editorDocument.documentType !== LANDSCAPE_DOCUMENT_TYPE) {
      return null;
    }
    return this.bifrost.editors.getEditorDocumentModelIfPresent(editorDocument) as LandscapeMapDocumentModel | null;
  }

  private resolveModeler(uri: string): LandscapeModeler | null {
    return this.resolveDocumentModel(uri)?.getModeler() ?? null;
  }

  private requireDocumentModel(uri: string): LandscapeMapDocumentModel {
    const documentModel = this.resolveDocumentModel(uri);
    if (documentModel == null) {
      throw new Error(`No landscape map open for URI: ${uri}`);
    }
    return documentModel;
  }

  /** The canvas of an open map; a map that cannot be read has none. */
  private requireModeler(uri: string): LandscapeModeler {
    const modeler = this.requireDocumentModel(uri).getModeler();
    if (modeler == null) {
      throw new Error(`The landscape map '${uri}' cannot be read, so it has no elements`);
    }
    return modeler;
  }

  private invokeCallback(callbackId: string, args: unknown[]): void {
    const connection = this.pluginHost.getConnection();
    if (connection == null) {
      return;
    }
    connection.request(PH_CALLBACK_INVOCATION, { callbackId, args } satisfies CallbackInvocationPayload);
  }
}
