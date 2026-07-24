import type { Bifrost } from '#bifrost/Bifrost';
import { type CallbackInvocationPayload, PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';

import type { DmnElementDetailSnapshot, DmnOverlayDescriptor, DmnOverlayFactoryContext } from '@evil/bifrost_fw_sdk';
import { PluginDmnOverlayPosition } from '@evil/bifrost_fw_sdk';

import type { PluginHost } from '../../bifrost/electron-renderer/plugin-host/PluginHost';
import type DmnModelerComponentAdapter from '../dmn-core/DmnModelerComponentAdapter';

const FACTORY_TIMEOUT_MS = 500;

interface RegisteredFactory {
  callbackId: string;
  pluginName: string;
  priority: number;
}

interface TrackedOverlay {
  overlayId: string;
}

/**
 * Manages registered DMN DRD overlay factory callbacks from plugins and
 * renders the resolved overlay descriptors directly onto the DRD overlays
 * service via raw DOM elements.
 *
 * Unlike BPMN (which layers plugin overlays on top of a rich Studio-owned
 * internal overlay set rendered through React — see `PluginOverlayStore` and
 * `BpmnElementOverlayManager`), the DMN DRD view has no built-in overlay
 * decorations for plugins to merge with. This class therefore combines
 * factory-chain resolution (mirroring `PluginOverlayStore.resolve`) with
 * direct rendering (mirroring `BpmnApiBridge`'s raw-DOM overlay methods) in
 * a single component, instantiated once by `DmnApiBridge`.
 */
export class DmnPluginOverlayManager {
  private pluginHost: PluginHost;
  private bifrost: Bifrost;
  private factories = new Map<string, RegisteredFactory>();
  private cachedFingerprintByUri = new Map<string, string>();
  private cachedResultByUri = new Map<string, DmnOverlayDescriptor[]>();
  private renderedOverlaysByUri = new Map<string, TrackedOverlay[]>();

  private refreshRequestCallback: (() => void) | null = null;

  constructor(pluginHost: PluginHost, bifrost: Bifrost) {
    this.pluginHost = pluginHost;
    this.bifrost = bifrost;
  }

  /**
   * Register (or replace) the overlay factory for a plugin.
   * Only one factory per plugin is allowed — re-registration replaces the previous.
   */
  registerFactory(pluginName: string, callbackId: string, priority: number): void {
    const existing = this.factories.get(pluginName);
    if (existing != null) {
      console.warn(
        `[DmnPluginOverlayManager] Plugin '${pluginName}' tried to register multiple DMN Overlay factories. ` +
          'By design, only ONE factory may be active per plugin. The previously registered factory has been replaced. ' +
          'This indicates a bug in your plugin code, please check it out.',
      );
    }
    this.factories.set(pluginName, { callbackId, pluginName, priority });
    this.invalidateCache();
  }

  /** Unregister the factory for a plugin and trigger a refresh. */
  unregisterFactory(pluginName: string): void {
    if (this.factories.delete(pluginName)) {
      this.invalidateCache();
      this.refreshRequestCallback?.();
    }
  }

  getFactoryCallbackId(pluginName: string): string | undefined {
    return this.factories.get(pluginName)?.callbackId;
  }

  /** Set the callback that triggers an overlay refresh on all open DMN documents. */
  onRefreshRequested(callback: () => void): void {
    this.refreshRequestCallback = callback;
  }

  hasFactories(): boolean {
    return this.factories.size > 0;
  }

  invalidateCache(): void {
    this.cachedFingerprintByUri.clear();
    this.cachedResultByUri.clear();
  }

  /**
   * Resolve the factory chain for the given DRD element set and render the
   * result directly onto the adapter's DRD overlays service.
   *
   * No-op while the DRD view is not active — clears any previously rendered
   * overlays for this URI instead, since they would be invisible/stale.
   */
  async refresh(adapter: DmnModelerComponentAdapter, elements: DmnElementDetailSnapshot[], uri: string): Promise<void> {
    if (!adapter.isDrdActive() || this.factories.size === 0) {
      this.clearRenderedOverlays(adapter, uri);
      return;
    }

    const descriptors = await this.resolve(elements, uri);
    this.render(adapter, uri, descriptors);
  }

  /**
   * Resolve all plugin overlay factories at the descriptor level.
   * Factories are invoked sequentially in priority order (lowest first).
   */
  async resolve(elements: DmnElementDetailSnapshot[], uri: string): Promise<DmnOverlayDescriptor[]> {
    if (this.factories.size === 0) {
      return [];
    }

    const fingerprint = this.computeFingerprint(elements);
    const cachedFingerprint = this.cachedFingerprintByUri.get(uri);
    if (fingerprint === cachedFingerprint) {
      return this.cachedResultByUri.get(uri) ?? [];
    }

    const sortedFactories = [...this.factories.values()].sort(
      (factoryA, factoryB) => factoryA.priority - factoryB.priority,
    );

    let currentOverlays: DmnOverlayDescriptor[] = [];
    const originalDefaultOverlays: DmnOverlayDescriptor[] = [];

    for (const factory of sortedFactories) {
      const context: DmnOverlayFactoryContext = {
        elements,
        uri,
        currentOverlays,
        originalDefaultOverlays,
      };

      try {
        const result = await this.invokeFactory(factory.callbackId, context);
        if (Array.isArray(result)) {
          currentOverlays = result as DmnOverlayDescriptor[];
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[DmnPluginOverlayManager] Factory from plugin '${factory.pluginName}' failed: ${message}. ` +
            'Passing currentOverlays unchanged to next factory.',
        );
      }
    }

    this.cachedFingerprintByUri.set(uri, fingerprint);
    this.cachedResultByUri.set(uri, currentOverlays);

    return currentOverlays;
  }

  /** Drop all cached/rendered state for a closed document. Does not touch the DOM. */
  clearForUri(uri: string): void {
    this.cachedFingerprintByUri.delete(uri);
    this.cachedResultByUri.delete(uri);
    this.renderedOverlaysByUri.delete(uri);
  }

  dispose(): void {
    this.factories.clear();
    this.invalidateCache();
    this.renderedOverlaysByUri.clear();
    this.refreshRequestCallback = null;
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  private render(adapter: DmnModelerComponentAdapter, uri: string, descriptors: DmnOverlayDescriptor[]): void {
    this.clearRenderedOverlays(adapter, uri);

    let overlayService: any;
    let elementRegistry: any;
    try {
      overlayService = adapter.getDrdOverlays();
      elementRegistry = adapter.getDrdElementRegistry();
    } catch {
      return;
    }

    const tracked: TrackedOverlay[] = [];

    for (const descriptor of descriptors) {
      const shape = elementRegistry.get(descriptor.elementId);
      if (shape == null) {
        continue;
      }

      const htmlElement = this.createOverlayHtmlElement(descriptor);
      const position = this.mapPosition(descriptor.position);

      try {
        const overlayId = overlayService.add(descriptor.elementId, 'plugin-overlay', {
          position,
          html: htmlElement,
        });
        tracked.push({ overlayId });
      } catch {
        // Element may not be visible, or the overlay limit was reached
      }
    }

    this.renderedOverlaysByUri.set(uri, tracked);
  }

  private clearRenderedOverlays(adapter: DmnModelerComponentAdapter, uri: string): void {
    const tracked = this.renderedOverlaysByUri.get(uri);
    if (tracked == null || tracked.length === 0) {
      return;
    }

    let overlayService: any;
    try {
      overlayService = adapter.getDrdOverlays();
    } catch {
      this.renderedOverlaysByUri.delete(uri);
      return;
    }

    for (const { overlayId } of tracked) {
      try {
        overlayService.remove(overlayId);
      } catch {
        // overlay may already have been removed (element deleted, tab closed)
      }
    }
    this.renderedOverlaysByUri.delete(uri);
  }

  private createOverlayHtmlElement(descriptor: DmnOverlayDescriptor): HTMLElement {
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
      container.appendChild(document.createTextNode(descriptor.text));
    } else if (descriptor.type === 'icon') {
      container.classList.add('evil-plugin-overlay--icon');
      const iconElement = document.createElement('i');
      iconElement.className = descriptor.icon;
      container.appendChild(iconElement);
    } else if (descriptor.type === 'action') {
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
        this.bifrost.commands.executeCommand(commandId, commandArgs as any[]);
      });
    } else {
      container.style.pointerEvents = 'none';
    }

    return container;
  }

  private mapPosition(position: PluginDmnOverlayPosition): {
    top: number;
    left: number;
    bottom?: number;
    right?: number;
  } {
    switch (position) {
      case PluginDmnOverlayPosition.TopLeft:
        return { top: -10, left: -10 };
      case PluginDmnOverlayPosition.TopRight:
        return { top: -10, left: 0, right: -10 };
      case PluginDmnOverlayPosition.MiddleLeft:
        return { top: 20, left: -10 };
      case PluginDmnOverlayPosition.MiddleRight:
        return { top: 20, left: 0, right: -10 };
      case PluginDmnOverlayPosition.BottomLeft:
        return { top: 0, left: -10, bottom: -10 };
      case PluginDmnOverlayPosition.BottomRight:
        return { top: 0, left: 0, bottom: -10, right: -10 };
      case PluginDmnOverlayPosition.Below:
        return { top: 0, left: 0, bottom: -30 };
      default:
        return { top: -10, left: -10 };
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private computeFingerprint(elements: DmnElementDetailSnapshot[]): string {
    return elements.map((element) => `${element.id}:${element.type}:${element.name ?? ''}`).join('|');
  }

  private async invokeFactory(callbackId: string, context: DmnOverlayFactoryContext): Promise<unknown> {
    const connection = this.pluginHost.getConnection();
    if (connection == null) {
      throw new Error('Plugin host connection not available');
    }

    const resultPromise = connection.request(PH_CALLBACK_INVOCATION, {
      callbackId,
      args: [context],
    } satisfies CallbackInvocationPayload);

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Factory timed out after ${FACTORY_TIMEOUT_MS}ms`));
      }, FACTORY_TIMEOUT_MS);
    });

    return Promise.race([resultPromise, timeoutPromise]);
  }
}
