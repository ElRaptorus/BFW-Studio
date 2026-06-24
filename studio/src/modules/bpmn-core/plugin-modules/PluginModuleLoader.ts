import type { ManifestBpmnModule } from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import path from 'path';

import { bpmnModelerModuleRegistry } from '../BpmnModelerModuleRegistry';
import { PluginChannel } from './PluginChannel';

type SendFunction = (pluginName: string, data: unknown) => void;

interface LoadedPlugin {
  channel: PluginChannel;
}

const CHANNEL_DI_PREFIX = 'pluginChannel__';

function makeChannelDiName(pluginName: string): string {
  return `${CHANNEL_DI_PREFIX}${pluginName}`;
}

/**
 * Rewrites `$inject` arrays in a loaded module, replacing the generic
 * `pluginChannel` dependency name with the plugin-specific DI name.
 *
 * This prevents multiple plugins from overwriting each other's channel
 * in the shared diagram-js DI container.
 */
function rewriteChannelInjections(moduleDescriptor: Record<string, any>, channelDiName: string): void {
  for (const key of Object.keys(moduleDescriptor)) {
    if (key === '__init__') {
      continue;
    }
    const entry = moduleDescriptor[key];
    if (!Array.isArray(entry) || entry.length < 2) {
      continue;
    }
    const [kind, serviceConstructor] = entry;
    if (kind !== 'type' && kind !== 'factory') {
      continue;
    }
    if (typeof serviceConstructor !== 'function') {
      continue;
    }
    const inject: string[] | undefined = serviceConstructor.$inject;
    if (!Array.isArray(inject)) {
      continue;
    }
    const channelIndex = inject.indexOf('pluginChannel');
    if (channelIndex !== -1) {
      inject[channelIndex] = channelDiName;
    }
  }
}

/**
 * Loads plugin-provided diagram-js modules into the renderer process
 * and manages their lifecycle.
 *
 * Each plugin's modules are registered in the BpmnModelerModuleRegistry.
 * A PluginChannel is injected alongside the modules for bidirectional
 * communication with the plugin host.
 *
 * Each plugin receives a unique DI name for its channel
 * (`pluginChannel__<pluginName>`) to prevent collisions when multiple
 * plugins register renderer modules simultaneously.
 */
class PluginModuleLoader {
  private loadedPlugins = new Map<string, LoadedPlugin>();
  private sendFn: SendFunction = () => {};

  /**
   * Set the transport function for sending messages from renderer modules
   * to the plugin host process. Called once by PluginHost after the
   * connection is established.
   */
  setSendFunction(sendFn: SendFunction): void {
    this.sendFn = sendFn;
  }

  /**
   * Load all declared BPMN modules for a plugin.
   * Creates a PluginChannel and injects it as a DI value alongside
   * the loaded diagram-js modules.
   */
  loadPluginModules(
    pluginName: string,
    pluginPath: string,
    bpmnModules: ManifestBpmnModule[],
  ): { success: boolean; error?: string } {
    if (this.loadedPlugins.has(pluginName)) {
      this.unloadPluginModules(pluginName);
    }

    const channelDiName = makeChannelDiName(pluginName);
    const channel = new PluginChannel(pluginName, this.sendFn);
    const channelModule = { [channelDiName]: ['value', channel] };

    try {
      bpmnModelerModuleRegistry.registerPluginModule(pluginName, channelModule);

      for (const moduleDeclaration of bpmnModules) {
        const modulePath = path.join(pluginPath, moduleDeclaration.entry);
        let loadedModule: any;

        try {
          // Evict from Node's require cache so we always load the latest version
          // from disk. Without this, disable → re-enable cycles or plugin updates
          // would keep serving stale module code.
          const resolvedPath = __non_webpack_require__.resolve(modulePath);
          delete __non_webpack_require__.cache[resolvedPath];

          loadedModule = __non_webpack_require__(modulePath);
        } catch (loadError) {
          const message = loadError instanceof Error ? loadError.message : String(loadError);
          this.unloadPluginModules(pluginName);
          return {
            success: false,
            error: `Failed to load renderer module '${moduleDeclaration.entry}': ${message}`,
          };
        }

        const resolvedModule = loadedModule?.default ?? loadedModule;
        if (resolvedModule == null || typeof resolvedModule !== 'object') {
          this.unloadPluginModules(pluginName);
          return {
            success: false,
            error: `Renderer module '${moduleDeclaration.entry}' did not export a valid diagram-js module object`,
          };
        }

        rewriteChannelInjections(resolvedModule, channelDiName);
        bpmnModelerModuleRegistry.registerPluginModule(pluginName, resolvedModule);
      }

      this.loadedPlugins.set(pluginName, { channel });
      return { success: true };
    } catch (error) {
      this.unloadPluginModules(pluginName);
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Unexpected error loading renderer modules for plugin '${pluginName}': ${message}`,
      };
    }
  }

  /**
   * Unload all renderer modules for a plugin and dispose the channel.
   */
  unloadPluginModules(pluginName: string): void {
    const loaded = this.loadedPlugins.get(pluginName);
    if (loaded != null) {
      loaded.channel.dispose();
      this.loadedPlugins.delete(pluginName);
    }
    bpmnModelerModuleRegistry.unregisterPluginModules(pluginName);
  }

  /**
   * Get the PluginChannel for a specific plugin (used by the bridge
   * to deliver messages from host → renderer).
   */
  getChannel(pluginName: string): PluginChannel | undefined {
    return this.loadedPlugins.get(pluginName)?.channel;
  }

  /**
   * Check if a plugin has loaded renderer modules.
   */
  hasLoadedModules(pluginName: string): boolean {
    return this.loadedPlugins.has(pluginName);
  }
}

export const pluginModuleLoader = new PluginModuleLoader();
