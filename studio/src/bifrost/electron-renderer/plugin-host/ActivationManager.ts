import type { Bifrost } from '#bifrost/Bifrost';
import type { ActivationEvent } from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';
import type { LoadPluginPayload } from '#bifrost/contracts/PluginHostProtocol';
import { PH_LOAD_PLUGIN } from '#bifrost/contracts/PluginHostProtocol';

import type { AbstractSubscription, EditorDocument } from '@evil/bifrost_fw_sdk';

import { EVENT_EDITOR_AREA_FOCUS_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { EVENT_SETTINGS_CHANGED } from '../../../../../studio-sdk/src/contracts/internal/SettingsEvents';
import type { PluginHost } from './PluginHost';

export type PermissionApprovalCallback = (pluginName: string, permissions: PluginPermission[]) => Promise<boolean>;

interface PluginActivationEntry {
  pluginName: string;
  pluginPath: string;
  permissions: PluginPermission[];
  events: ActivationEvent[];
  subscriptions: { dispose: () => void }[];
}

type ActivationState = 'pending' | 'activating' | 'activated' | 'disabled' | 'error';

/**
 * Renderer-side service that manages event-driven lazy activation.
 * Plugins with `activationEvents` in their manifest are not loaded
 * until one of their declared events fires.
 */
export class ActivationManager {
  private bifrost: Bifrost;
  private pluginHost: PluginHost;
  private requestPermissionApproval: PermissionApprovalCallback;
  private entries = new Map<string, PluginActivationEntry>();
  private states = new Map<string, ActivationState>();
  private pendingActivations = new Map<string, Promise<void>>();

  constructor(bifrost: Bifrost, pluginHost: PluginHost, requestPermissionApproval: PermissionApprovalCallback) {
    this.bifrost = bifrost;
    this.pluginHost = pluginHost;
    this.requestPermissionApproval = requestPermissionApproval;
  }

  registerActivationEvents(
    pluginName: string,
    pluginPath: string,
    events: ActivationEvent[],
    permissions: PluginPermission[] = [],
  ): { dispose: () => void } {
    const entry: PluginActivationEntry = {
      pluginName,
      pluginPath,
      permissions,
      events,
      subscriptions: [],
    };

    this.entries.set(pluginName, entry);
    this.states.set(pluginName, 'pending');

    for (const event of events) {
      if (event === 'onStartup' || event === '*') {
        // onStartup plugins are activated by PluginHost after the
        // discovery loop completes, so all manifests are processed first.
        continue;
      }

      if (event.startsWith('onCommand:')) {
        // Command activation is handled by the stub callback in ContributionRegistrar.
        // No separate subscription needed.
        continue;
      }

      if (event.startsWith('onDocumentType:')) {
        const documentType = event.slice('onDocumentType:'.length);
        const sub = this.subscribeToDocumentType(pluginName, documentType);
        entry.subscriptions.push(sub);
        continue;
      }

      if (event.startsWith('onUri:')) {
        const uriPrefix = event.slice('onUri:'.length);
        const sub = this.subscribeToUri(pluginName, uriPrefix);
        entry.subscriptions.push(sub);
        continue;
      }

      if (event.startsWith('onSetting:')) {
        const settingKey = event.slice('onSetting:'.length);
        const sub = this.subscribeToSetting(pluginName, settingKey);
        entry.subscriptions.push(sub);
        continue;
      }
    }

    return {
      dispose: () => {
        this.disposeEntry(pluginName);
      },
    };
  }

  isActivated(pluginName: string): boolean {
    return this.states.get(pluginName) === 'activated';
  }

  hasOnStartupEvent(pluginName: string): boolean {
    const entry = this.entries.get(pluginName);
    if (entry == null) {
      return false;
    }
    return entry.events.some((event) => event === 'onStartup' || event === '*');
  }

  getState(pluginName: string): ActivationState | undefined {
    return this.states.get(pluginName);
  }

  async activatePlugin(pluginName: string): Promise<void> {
    const state = this.states.get(pluginName);
    if (state === 'activated' || state === 'disabled') {
      return;
    }

    // If activation is already in progress, join the existing promise
    // so that stub callbacks and other callers wait for it to complete.
    const pending = this.pendingActivations.get(pluginName);
    if (pending != null) {
      return pending;
    }

    const entry = this.entries.get(pluginName);
    if (entry == null) {
      return;
    }

    const activationPromise = this.doActivatePlugin(pluginName, entry);
    this.pendingActivations.set(pluginName, activationPromise);

    try {
      await activationPromise;
    } finally {
      this.pendingActivations.delete(pluginName);
    }
  }

  private async doActivatePlugin(pluginName: string, entry: PluginActivationEntry): Promise<void> {
    this.states.set(pluginName, 'activating');

    // Permission approval gate
    const approved = await this.requestPermissionApproval(entry.pluginName, entry.permissions);
    if (!approved) {
      this.states.set(pluginName, 'disabled');
      this.disposeSubscriptions(pluginName);

      this.pluginHost.updatePluginStatus(pluginName, 'disabled');

      const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
      if (!disabledPlugins.includes(pluginName)) {
        this.bifrost.settings.set('plugins.disabledPlugins', [...disabledPlugins, pluginName]);
      }
      return;
    }

    try {
      this.pluginHost.registerPluginPermissions(entry.pluginName, entry.permissions);

      await this.pluginHost.getConnection()!.request(PH_LOAD_PLUGIN, {
        pluginPath: entry.pluginPath,
        pluginName: entry.pluginName,
        permissions: entry.permissions,
      } satisfies LoadPluginPayload);

      this.states.set(pluginName, 'activated');
      this.disposeSubscriptions(pluginName);

      this.pluginHost.updatePluginStatus(pluginName, 'loaded');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[ActivationManager] Failed to activate plugin '${pluginName}':`, err);
      this.states.set(pluginName, 'error');
      this.disposeSubscriptions(pluginName);

      this.pluginHost.cleanupPluginResources(pluginName);
      this.pluginHost.updatePluginStatus(pluginName, 'error', errorMessage);

      this.bifrost.notifications.open({
        type: 'error',
        content: `Plugin '${pluginName}' failed to activate: ${errorMessage}`,
        source: pluginName,
      });
    }
  }

  disposePlugin(pluginName: string): void {
    this.disposeEntry(pluginName);
  }

  dispose(): void {
    for (const pluginName of this.entries.keys()) {
      this.disposeEntry(pluginName);
    }
    this.entries.clear();
    this.states.clear();
  }

  // ── Event subscriptions ────────────────────────────────────

  private subscribeToDocumentType(pluginName: string, documentType: string): { dispose: () => void } {
    const sub: AbstractSubscription = this.bifrost.editors.on(
      EVENT_EDITOR_AREA_FOCUS_UPDATED,
      (focusedDoc: EditorDocument) => {
        if (focusedDoc == null) {
          return;
        }
        try {
          const typeDef = this.bifrost.editors.getDocumentTypeDefinitionByUri(focusedDoc.uri);
          if (typeDef.documentType === documentType) {
            this.activatePlugin(pluginName);
          }
        } catch {
          // Document type not found for this URI — ignore
        }
      },
    );
    return sub;
  }

  private subscribeToUri(pluginName: string, uriPrefix: string): { dispose: () => void } {
    const sub: AbstractSubscription = this.bifrost.editors.on(
      EVENT_EDITOR_AREA_FOCUS_UPDATED,
      (focusedDoc: EditorDocument) => {
        if (focusedDoc == null) {
          return;
        }
        if (focusedDoc.uri.startsWith(uriPrefix)) {
          this.activatePlugin(pluginName);
        }
      },
    );
    return sub;
  }

  private subscribeToSetting(pluginName: string, settingKey: string): { dispose: () => void } {
    const sub: AbstractSubscription = this.bifrost.settings.on(EVENT_SETTINGS_CHANGED, (changedKey: string) => {
      if (changedKey === settingKey) {
        this.activatePlugin(pluginName);
      }
    });
    return sub;
  }

  // ── Cleanup ────────────────────────────────────────────────

  private disposeSubscriptions(pluginName: string): void {
    const entry = this.entries.get(pluginName);
    if (entry != null) {
      for (const sub of entry.subscriptions) {
        sub.dispose();
      }
      entry.subscriptions = [];
    }
  }

  private disposeEntry(pluginName: string): void {
    this.disposeSubscriptions(pluginName);
    this.entries.delete(pluginName);
    this.states.delete(pluginName);
    this.pendingActivations.delete(pluginName);
  }
}
