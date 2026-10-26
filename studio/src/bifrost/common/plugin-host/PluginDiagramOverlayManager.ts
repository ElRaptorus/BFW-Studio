import type { Bifrost } from '#bifrost/Bifrost';
import { type CallbackInvocationPayload, PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';
import type { PluginApiNamespaceContext } from '#bifrost/contracts/PluginHostTypes';

import type { DmnOverlayDescriptor, LandscapeOverlayDescriptor } from '@elraptorus/bfw_studio_sdk';

/** The DMN and landscape overlay descriptors are structurally identical; only their position enums are nominal. */
type OverlayDescriptor = DmnOverlayDescriptor | LandscapeOverlayDescriptor;

/** The diagram-js services a plugin overlay is drawn with: the plane or view on screen of one document. */
export interface DiagramOverlayTarget {
  overlays: any;
  elementRegistry: any;
}

export interface PluginDiagramOverlayManagerOptions<ElementSnapshot> {
  /** Names the diagram kind in log messages, for example `DMN` or `Landscape`. */
  diagramLabel: string;
  /** Changes whenever the factories would have to run again for the element set. */
  fingerprintOf: (element: ElementSnapshot) => string;
}

const FACTORY_TIMEOUT_MS = 500;

interface RegisteredFactory {
  callbackId: string;
  pluginName: string;
  priority: number;
}

interface RenderedOverlays {
  overlayService: any;
  overlayIds: string[];
}

/**
 * Manages registered overlay factory callbacks from plugins and renders the resolved overlay descriptors directly
 * onto a diagram-js overlays service via raw DOM elements.
 *
 * Unlike BPMN (which layers plugin overlays on top of a rich Studio-owned internal overlay set rendered through
 * React — see `PluginOverlayStore` and `BpmnElementOverlayManager`), the DMN DRD view and the landscape map have no
 * built-in overlay decorations for plugins to merge with. This class therefore combines factory-chain resolution
 * (mirroring `PluginOverlayStore.resolve`) with direct rendering in a single component. `DmnApiBridge` and
 * `LandscapeApiBridge` each instantiate one; it knows nothing about either editor beyond the
 * {@link DiagramOverlayTarget} it is handed.
 */
export class PluginDiagramOverlayManager<ElementSnapshot> {
  private pluginHost: PluginApiNamespaceContext['pluginHost'];
  private bifrost: Bifrost;
  private factories = new Map<string, RegisteredFactory>();
  private cachedFingerprintByUri = new Map<string, string>();
  private cachedResultByUri = new Map<string, OverlayDescriptor[]>();
  private renderedOverlaysByUri = new Map<string, RenderedOverlays>();

  private refreshRequestCallback: (() => void) | null = null;

  private options: PluginDiagramOverlayManagerOptions<ElementSnapshot>;

  constructor(
    pluginHost: PluginApiNamespaceContext['pluginHost'],
    bifrost: Bifrost,
    options: PluginDiagramOverlayManagerOptions<ElementSnapshot>,
  ) {
    this.pluginHost = pluginHost;
    this.bifrost = bifrost;
    this.options = options;
  }

  /**
   * Register (or replace) the overlay factory for a plugin.
   * Only one factory per plugin is allowed — re-registration replaces the previous.
   */
  registerFactory(pluginName: string, callbackId: string, priority: number): void {
    const existing = this.factories.get(pluginName);
    if (existing != null) {
      console.warn(
        `[PluginDiagramOverlayManager] Plugin '${pluginName}' tried to register multiple ${this.options.diagramLabel} Overlay factories. ` +
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

  /** Set the callback that triggers an overlay refresh on all open documents. */
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
   * Resolve the factory chain for the given element set and render the result onto the target's overlays service.
   *
   * A `null` target means there is nothing to draw on (for example the DMN view that is not the DRD): the overlays
   * rendered earlier for this URI are removed instead, since they would be invisible or stale.
   */
  async refresh(target: DiagramOverlayTarget | null, elements: ElementSnapshot[], uri: string): Promise<void> {
    if (target == null || this.factories.size === 0) {
      this.clearRenderedOverlays(uri);
      return;
    }

    const descriptors = await this.resolve(elements, uri);
    this.render(target, uri, descriptors);
  }

  /**
   * Resolve all plugin overlay factories at the descriptor level.
   * Factories are invoked sequentially in priority order (lowest first).
   */
  async resolve(elements: ElementSnapshot[], uri: string): Promise<OverlayDescriptor[]> {
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

    let currentOverlays: OverlayDescriptor[] = [];
    const originalDefaultOverlays: OverlayDescriptor[] = [];

    for (const factory of sortedFactories) {
      const context = { elements, uri, currentOverlays, originalDefaultOverlays };

      try {
        const result = await this.invokeFactory(factory.callbackId, context);
        if (Array.isArray(result)) {
          currentOverlays = result as OverlayDescriptor[];
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[PluginDiagramOverlayManager] Factory from plugin '${factory.pluginName}' failed: ${message}. ` +
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

  private render(target: DiagramOverlayTarget, uri: string, descriptors: OverlayDescriptor[]): void {
    this.clearRenderedOverlays(uri);

    const overlayIds: string[] = [];

    for (const descriptor of descriptors) {
      const overlayId = this.addOverlay(target, descriptor);
      if (overlayId !== '') {
        overlayIds.push(overlayId);
      }
    }

    this.renderedOverlaysByUri.set(uri, { overlayService: target.overlays, overlayIds });
  }

  /**
   * Draws one overlay on the target and returns its id, or `''` when the element is not there or the overlay could
   * not be added. With `ownerPluginName` a click command must belong to that plugin (the direct `setOverlays` path);
   * without it the descriptor comes out of the factory chain, which has already merged several plugins.
   */
  addOverlay(target: DiagramOverlayTarget, descriptor: OverlayDescriptor, ownerPluginName?: string): string {
    if (target.elementRegistry.get(descriptor.elementId) == null) {
      return '';
    }
    try {
      return target.overlays.add(descriptor.elementId, 'plugin-overlay', {
        position: this.mapPosition(descriptor.position),
        html: this.createOverlayHtmlElement(descriptor, ownerPluginName),
      });
    } catch {
      // Element may not be visible, or the overlay limit was reached
      return '';
    }
  }

  removeOverlays(overlayService: any, overlayIds: string[]): void {
    for (const overlayId of overlayIds) {
      if (overlayId === '') {
        continue;
      }
      try {
        overlayService.remove(overlayId);
      } catch {
        // overlay may already have been removed (element deleted, tab closed)
      }
    }
  }

  private clearRenderedOverlays(uri: string): void {
    const rendered = this.renderedOverlaysByUri.get(uri);
    this.renderedOverlaysByUri.delete(uri);
    if (rendered == null) {
      return;
    }

    this.removeOverlays(rendered.overlayService, rendered.overlayIds);
  }

  private createOverlayHtmlElement(descriptor: OverlayDescriptor, ownerPluginName?: string): HTMLElement {
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
      container.appendChild(document.createTextNode(descriptor.text));
    } else if (descriptor.type === 'icon') {
      container.classList.add('bfw-plugin-overlay--icon');
      const iconElement = document.createElement('i');
      iconElement.className = descriptor.icon;
      container.appendChild(iconElement);
    } else if (descriptor.type === 'action') {
      container.classList.add('bfw-plugin-overlay--icon');
      const iconElement = document.createElement('i');
      iconElement.className = descriptor.icon;
      container.appendChild(iconElement);
    } else if (descriptor.type === 'status') {
      container.classList.add('bfw-plugin-overlay--icon');
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
      const commandArgs = ('onClickCommandArgs' in descriptor ? descriptor.onClickCommandArgs : []) ?? [];
      const commandId =
        ownerPluginName == null || descriptor.onClickCommand.startsWith('plugin.')
          ? descriptor.onClickCommand
          : `plugin.${ownerPluginName}.${descriptor.onClickCommand}`;

      container.addEventListener('click', (event) => {
        event.stopPropagation();
        if (ownerPluginName != null && !this.isOwnedRegisteredCommand(commandId, ownerPluginName)) {
          console.warn(
            `[PluginDiagramOverlayManager] Plugin '${ownerPluginName}' overlay click rejected: command '${commandId}' is not owned by this plugin or is not registered`,
          );
          return;
        }
        this.bifrost.commands.executeCommand(commandId, commandArgs as any[]);
      });
    } else {
      container.style.pointerEvents = 'none';
    }

    return container;
  }

  private mapPosition(position: OverlayDescriptor['position']): {
    top: number;
    left: number;
    bottom?: number;
    right?: number;
  } {
    switch (position as string) {
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

  // ─── Private Helpers ──────────────────────────────────────────────────

  private isOwnedRegisteredCommand(commandId: string, pluginName: string): boolean {
    return commandId.startsWith(`plugin.${pluginName}.`) && this.bifrost.commands.isRegistered(commandId);
  }

  private computeFingerprint(elements: ElementSnapshot[]): string {
    return elements.map(this.options.fingerprintOf).join('|');
  }

  private async invokeFactory(callbackId: string, context: unknown): Promise<unknown> {
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
