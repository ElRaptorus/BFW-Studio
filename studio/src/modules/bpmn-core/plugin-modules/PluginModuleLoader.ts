import type { ManifestBpmnModule } from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import path from 'path';

import { bpmnModelerModuleRegistry } from '../BpmnModelerModuleRegistry';
import { PluginChannel } from './PluginChannel';

type SendFunction = (pluginName: string, data: unknown) => void;

interface LoadedPlugin {
  channel: PluginChannel;
}

/**
 * Loads plugin-provided diagram-js modules into the renderer process
 * and manages their lifecycle.
 *
 * Each plugin's modules are registered in the BpmnModelerModuleRegistry.
 * A PluginChannel is injected alongside the modules for bidirectional
 * communication with the plugin host.
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

    const channel = new PluginChannel(pluginName, this.sendFn);
    const channelModule = { pluginChannel: ['value', channel] };

    try {
      bpmnModelerModuleRegistry.registerPluginModule(pluginName, channelModule);

      for (const moduleDeclaration of bpmnModules) {
        const modulePath = path.join(pluginPath, moduleDeclaration.entry);
        let loadedModule: any;

        try {
          // Runtime-only require for plugin bundles loaded from arbitrary paths.
          // Must bypass the bundler's static analysis.
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
