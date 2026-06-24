import type { Bifrost } from '#bifrost/Bifrost';
import { type CallbackInvocationPayload, PH_CALLBACK_INVOCATION } from '#bifrost/contracts/PluginHostProtocol';

import React from 'react';

import type {
  BpmnElement,
  BpmnElementDetailSnapshot,
  BpmnOverlayDescriptor,
  OverlayFactoryContext,
} from '@evil/bifrost_fw_sdk';
import { PluginBpmnOverlayPosition } from '@evil/bifrost_fw_sdk';

import type { Overlay } from '../../../modules/bpmn-core/overlays/BpmnElementOverlayManager';
import {
  OverlayPosition,
  type Overlay_Positioned,
} from '../../../modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { PluginHost } from './PluginHost';

const FACTORY_TIMEOUT_MS = 500;

interface RegisteredFactory {
  callbackId: string;
  pluginName: string;
  priority: number;
}

/**
 * Manages registered overlay factory callbacks from plugins and handles
 * their sequential invocation during BPMN overlay refresh cycles.
 *
 * Also provides the full resolution pipeline that bridges internal Overlay types
 * with the plugin descriptor world (snapshot building, descriptor conversion,
 * position mapping, surviving-overlay determination). This makes the store
 * reusable by any BPMN-aware view (editor, debugger, viewer).
 *
 * Design:
 * - One factory per plugin (re-registration replaces previous).
 * - Factories are called in priority order (lowest first, highest last).
 * - Each factory receives the previous factory's output as `currentOverlays`.
 * - Input fingerprint caching avoids redundant invocations when elements haven't changed.
 * - Per-factory timeout prevents slow plugins from blocking the refresh cycle.
 * - Error isolation: one factory failure doesn't break the chain.
 */
export class PluginOverlayStore {
  private pluginHost: PluginHost;
  private bifrost: Bifrost;
  private factories = new Map<string, RegisteredFactory>();
  private cachedFingerprint: string | null = null;
  private cachedResult: BpmnOverlayDescriptor[] | null = null;

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
        `[PluginOverlayStore] Plugin '${pluginName}' tried to register multiple BPMN Overlay factories. ` +
          'By design, only ONE factory may be active per plugin. The previously registered factory has been replaced. ' +
          'This indicates a bug in your plugin code, please check it out.',
      );
    }

    this.factories.set(pluginName, { callbackId, pluginName, priority });
    this.invalidateCache();
  }

  /**
   * Unregister the factory for a plugin and trigger a refresh.
   */
  unregisterFactory(pluginName: string): void {
    if (this.factories.delete(pluginName)) {
      this.invalidateCache();
      this.refreshRequestCallback?.();
    }
  }

  /**
   * Get the callback ID for a plugin's factory (for cleanup on unregister).
   */
  getFactoryCallbackId(pluginName: string): string | undefined {
    return this.factories.get(pluginName)?.callbackId;
  }

  /**
   * Set the callback that triggers an overlay refresh on the BPMN document model.
   */
  onRefreshRequested(callback: () => void): void {
    this.refreshRequestCallback = callback;
  }

  /**
   * Check if any plugin factories are registered.
   */
  hasFactories(): boolean {
    return this.factories.size > 0;
  }

  // ─── High-Level Pipeline ──────────────────────────────────────────────

  /**
   * Full resolution pipeline: accepts typed BpmnElement[] and internal Overlay objects,
   * runs the factory chain, and returns the final merged Overlay[] ready for updateAll().
   *
   * This is the primary API for views (editor, debugger, viewer) to integrate with
   * the plugin overlay system. The caller provides its internal overlays; the store
   * handles snapshot building, descriptor conversion, factory invocation, surviving-overlay
   * determination, and conversion back to Overlay objects.
   */
  async resolveWithOverlays(elements: BpmnElement[], uri: string, internalOverlays: Overlay[]): Promise<Overlay[]> {
    const elementSnapshots = this.buildElementSnapshots(elements);
    const { descriptors: internalDescriptors, sourceIndices } =
      this.convertOverlaysToDescriptorsWithMapping(internalOverlays);

    const finalDescriptors = await this.resolve(elementSnapshots, uri, internalDescriptors);

    const survivingInternalKeys = new Set<string>();
    for (const descriptor of finalDescriptors) {
      if (descriptor.type !== 'badge' && descriptor.type !== 'icon') {
        survivingInternalKeys.add(`${descriptor.type}:${descriptor.elementId}`);
      }
    }

    const removedOverlayIndices = new Set<number>();
    for (let i = 0; i < internalDescriptors.length; i++) {
      const key = `${internalDescriptors[i].type}:${internalDescriptors[i].elementId}`;
      if (!survivingInternalKeys.has(key)) {
        removedOverlayIndices.add(sourceIndices[i]);
      }
    }

    const survivingOverlays = internalOverlays.filter((_, index) => !removedOverlayIndices.has(index));
    const pluginOverlayObjects = this.convertDescriptorsToOverlays(finalDescriptors);

    return [...survivingOverlays, ...pluginOverlayObjects];
  }

  // ─── Low-Level Factory Chain ──────────────────────────────────────────

  /**
   * Resolve all plugin overlay factories at the descriptor level.
   *
   * Factories are invoked sequentially in priority order (lowest first).
   * Each factory receives the previous factory's output as `currentOverlays`.
   *
   * Returns the final descriptor set after all factories have processed.
   */
  async resolve(
    elements: BpmnElementDetailSnapshot[],
    uri: string,
    internalOverlays: BpmnOverlayDescriptor[],
  ): Promise<BpmnOverlayDescriptor[]> {
    if (this.factories.size === 0) {
      return [...internalOverlays];
    }

    const fingerprint = this.computeFingerprint(elements, internalOverlays);
    if (fingerprint === this.cachedFingerprint && this.cachedResult != null) {
      return this.cachedResult;
    }

    const sortedFactories = [...this.factories.values()].sort(
      (factoryA, factoryB) => factoryA.priority - factoryB.priority,
    );

    let currentOverlays: BpmnOverlayDescriptor[] = [...internalOverlays];
    const originalDefaultOverlays: BpmnOverlayDescriptor[] = [...internalOverlays];

    for (const factory of sortedFactories) {
      const context: OverlayFactoryContext = {
        elements,
        uri,
        currentOverlays,
        originalDefaultOverlays,
      };

      try {
        const result = await this.invokeFactory(factory.callbackId, context);
        if (Array.isArray(result)) {
          currentOverlays = result as BpmnOverlayDescriptor[];
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[PluginOverlayStore] Factory from plugin '${factory.pluginName}' failed: ${message}. ` +
            'Passing currentOverlays unchanged to next factory.',
        );
      }
    }

    this.cachedFingerprint = fingerprint;
    this.cachedResult = currentOverlays;

    return currentOverlays;
  }

  /**
   * Invalidate the cached result, forcing re-invocation on next resolve.
   */
  invalidateCache(): void {
    this.cachedFingerprint = null;
    this.cachedResult = null;
  }

  /**
   * Dispose all registered factories.
   */
  dispose(): void {
    this.factories.clear();
    this.invalidateCache();
    this.refreshRequestCallback = null;
  }

  // ─── Element Snapshot Building ────────────────────────────────────────

  private buildElementSnapshots(elements: BpmnElement[]): BpmnElementDetailSnapshot[] {
    return elements.map((element) => {
      const incoming = (element.incomingFlows ?? []).map((flow) => flow.id);
      const outgoing = (element.outgoingFlows ?? []).map((flow) => flow.id);

      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(element)) {
        if (
          key === 'id' ||
          key === 'type' ||
          key === 'name' ||
          key === '__internalModdleId' ||
          key === 'incomingFlows' ||
          key === 'outgoingFlows' ||
          key === 'attachedElements' ||
          key === 'documentation' ||
          key === 'loopCharacteristics' ||
          key === 'loopConfig' ||
          key === 'customProperties'
        ) {
          continue;
        }
        if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          properties[key] = value;
        }
      }

      return {
        id: element.id,
        type: element.type,
        name: element.name || null,
        parentId: null,
        properties,
        incoming,
        outgoing,
      };
    });
  }

  // ─── Overlay ↔ Descriptor Conversion ─────────────────────────────────

  private convertOverlaysToDescriptorsWithMapping(overlays: Overlay[]): {
    descriptors: BpmnOverlayDescriptor[];
    sourceIndices: number[];
  } {
    const descriptors: BpmnOverlayDescriptor[] = [];
    const sourceIndices: number[] = [];

    for (let i = 0; i < overlays.length; i++) {
      const overlay = overlays[i];
      if (overlay.type !== 'positioned') {
        continue;
      }
      const componentName = overlay.overlayElement.displayName || overlay.overlayElement.name || '';
      let descriptor: BpmnOverlayDescriptor | null = null;

      if (componentName.includes('Documentation')) {
        descriptor = {
          type: 'documentation-marker',
          elementId: overlay.elementId,
          position: this.mapOverlayPositionToPlugin(overlay.position),
        };
      } else if (componentName.includes('CallActivity') || componentName.includes('TargetLink')) {
        descriptor = {
          type: 'call-activity-link',
          elementId: overlay.elementId,
          position: this.mapOverlayPositionToPlugin(overlay.position),
          targetProcessId: overlay.overlayProps?.targetProcessId ?? '',
        };
      } else if (componentName.includes('MultipleSequenceFlow') || componentName.includes('Warning')) {
        descriptor = {
          type: 'multi-flow-warning',
          elementId: overlay.elementId,
          position: this.mapOverlayPositionToPlugin(overlay.position),
          outgoingCount: overlay.overlayProps?.outgoingSequenceFlows ?? 0,
        };
      } else if (componentName.includes('NotExecutable')) {
        descriptor = {
          type: 'not-executable-marker',
          elementId: overlay.elementId,
          position: this.mapOverlayPositionToPlugin(overlay.position),
        };
      }

      if (descriptor != null) {
        descriptors.push(descriptor);
        sourceIndices.push(i);
      }
    }

    return { descriptors, sourceIndices };
  }

  private convertDescriptorsToOverlays(descriptors: BpmnOverlayDescriptor[]): Overlay[] {
    const overlays: Overlay[] = [];
    for (const descriptor of descriptors) {
      if (
        descriptor.type === 'badge' ||
        descriptor.type === 'icon' ||
        descriptor.type === 'action' ||
        descriptor.type === 'status'
      ) {
        overlays.push(this.createPluginOverlay(descriptor));
      }
    }
    return overlays;
  }

  private createPluginOverlay(
    descriptor: BpmnOverlayDescriptor & { type: 'badge' | 'icon' | 'action' | 'status' },
  ): Overlay_Positioned {
    const position = this.mapPluginPositionToOverlay(descriptor.position);
    const bifrost = this.bifrost;

    const PluginOverlayComponent = (props: { descriptor: typeof descriptor }): React.ReactElement | null => {
      const { descriptor: desc } = props;

      if (desc.type === 'badge') {
        const hasClickCommand = desc.onClickCommand != null;
        const handleClick = hasClickCommand
          ? (event: React.MouseEvent) => {
              event.stopPropagation();
              bifrost.commands.executeCommand(desc.onClickCommand!, (desc.onClickCommandArgs ?? []) as any[]);
            }
          : undefined;
        const styleClass = desc.style ? `evil-plugin-overlay--${desc.style}` : '';
        return React.createElement(
          'div',
          {
            className: `evil-plugin-overlay evil-plugin-overlay--badge ${styleClass}`.trim(),
            title: desc.tooltip ?? undefined,
            'data-clickable': hasClickCommand ? 'true' : undefined,
            onClick: handleClick,
          },
          desc.text,
        );
      }

      if (desc.type === 'icon') {
        const hasClickCommand = desc.onClickCommand != null;
        const handleClick = hasClickCommand
          ? (event: React.MouseEvent) => {
              event.stopPropagation();
              bifrost.commands.executeCommand(desc.onClickCommand!, (desc.onClickCommandArgs ?? []) as any[]);
            }
          : undefined;
        const styleClass = desc.style ? `evil-plugin-overlay--${desc.style}` : '';
        return React.createElement(
          'div',
          {
            className: `evil-plugin-overlay evil-plugin-overlay--icon ${styleClass}`.trim(),
            title: desc.tooltip ?? undefined,
            'data-clickable': hasClickCommand ? 'true' : undefined,
            onClick: handleClick,
          },
          React.createElement('i', { className: desc.icon }),
        );
      }

      if (desc.type === 'action') {
        const handleClick = (event: React.MouseEvent) => {
          event.stopPropagation();
          bifrost.commands.executeCommand(desc.onClickCommand, (desc.onClickCommandArgs ?? []) as any[]);
        };
        const styleModifier = desc.style ? ` evil-plugin-action--${desc.style}` : '';
        const hoverIcon = desc.iconHover ?? deriveFilledVariant(desc.icon);
        return React.createElement(
          'div',
          {
            className: `bpmn-element-overlay__below-item bpmn-element-overlay__below-item--action${styleModifier}`,
            title: desc.tooltip ?? undefined,
            onClick: handleClick,
            'data-bs-toggle': desc.tooltip ? 'tooltip' : undefined,
          },
          React.createElement(
            'div',
            { className: 'action-icon', key: 'rest' },
            React.createElement('i', { className: desc.icon }),
          ),
          React.createElement(
            'div',
            { className: 'action-icon-hovered', key: 'hover' },
            React.createElement('i', { className: hoverIcon }),
          ),
        );
      }

      if (desc.type === 'status') {
        const styleModifier = desc.style ? ` evil-plugin-status--${desc.style}` : '';
        const innerChildren: React.ReactNode[] = [];
        if (desc.icon) {
          innerChildren.push(React.createElement('i', { className: desc.icon, key: 'icon' }));
        }
        if (desc.text) {
          innerChildren.push(' ');
          innerChildren.push(desc.text);
        }
        return React.createElement(
          'div',
          {
            className: `bpmn-element-overlay__below-item evil-plugin-status${styleModifier}`,
            title: desc.tooltip ?? undefined,
            'data-bs-toggle': desc.tooltip ? 'tooltip' : undefined,
          },
          React.createElement('div', { className: 'fw-bold' }, ...innerChildren),
        );
      }

      return null;
    };
    PluginOverlayComponent.displayName = `PluginOverlay_${descriptor.type}_${descriptor.elementId}`;

    return {
      type: 'positioned',
      elementId: descriptor.elementId,
      position,
      overlayElement: PluginOverlayComponent,
      overlayProps: { descriptor },
    };
  }

  // ─── Position Mapping ─────────────────────────────────────────────────

  private mapOverlayPositionToPlugin(position: OverlayPosition): PluginBpmnOverlayPosition {
    switch (position) {
      case OverlayPosition.topLeft:
        return PluginBpmnOverlayPosition.TopLeft;
      case OverlayPosition.topRight:
        return PluginBpmnOverlayPosition.TopRight;
      case OverlayPosition.middleLeft:
        return PluginBpmnOverlayPosition.MiddleLeft;
      case OverlayPosition.middleRight:
        return PluginBpmnOverlayPosition.MiddleRight;
      case OverlayPosition.bottomLeft:
        return PluginBpmnOverlayPosition.BottomLeft;
      case OverlayPosition.bottomRight:
        return PluginBpmnOverlayPosition.BottomRight;
      case OverlayPosition.below:
        return PluginBpmnOverlayPosition.Below;
      default:
        return PluginBpmnOverlayPosition.TopRight;
    }
  }

  private mapPluginPositionToOverlay(position: PluginBpmnOverlayPosition): OverlayPosition {
    switch (position) {
      case PluginBpmnOverlayPosition.TopLeft:
        return OverlayPosition.topLeft;
      case PluginBpmnOverlayPosition.TopRight:
        return OverlayPosition.topRight;
      case PluginBpmnOverlayPosition.MiddleLeft:
        return OverlayPosition.middleLeft;
      case PluginBpmnOverlayPosition.MiddleRight:
        return OverlayPosition.middleRight;
      case PluginBpmnOverlayPosition.BottomLeft:
        return OverlayPosition.bottomLeft;
      case PluginBpmnOverlayPosition.BottomRight:
        return OverlayPosition.bottomRight;
      case PluginBpmnOverlayPosition.Below:
        return OverlayPosition.below;
      default:
        return OverlayPosition.topRight;
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private async invokeFactory(callbackId: string, context: OverlayFactoryContext): Promise<unknown> {
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

  private computeFingerprint(elements: BpmnElementDetailSnapshot[], internalOverlays: BpmnOverlayDescriptor[]): string {
    const elementParts = elements.map(
      (element) =>
        `${element.id}:${element.type}:${element.outgoing.length}:${element.incoming.length}:${element.name ?? ''}`,
    );
    const overlayParts = internalOverlays.map((overlay) => `${overlay.type}:${overlay.elementId}`);
    return elementParts.join('|') + '##' + overlayParts.join('|');
  }
}

/**
 * Derives a filled icon variant from a light/thin Phosphor icon class string.
 * "ph-light ph-play" -> "ph-fill ph-play"
 * "ph-thin ph-heart"  -> "ph-fill ph-heart"
 * Anything else returns the original (no swap).
 */
function deriveFilledVariant(iconClass: string): string {
  if (iconClass.includes('ph-light')) {
    return iconClass.replace('ph-light', 'ph-fill');
  }
  if (iconClass.includes('ph-thin')) {
    return iconClass.replace('ph-thin', 'ph-fill');
  }
  return iconClass;
}
