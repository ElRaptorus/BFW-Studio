import { STUDIO_PLUGIN_API_VERSION } from '#bifrost/contracts/PluginApiVersion';
import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import type { LoadPluginPayload } from '#bifrost/contracts/PluginHostProtocol';
import * as fs from 'fs/promises';
import { createRequire } from 'node:module';
import * as path from 'path';

import { type PluginEnvironment, StudioPluginApi } from './api/StudioPluginApi';

// Rspack transforms require() into __webpack_require__ which can only resolve
// modules known at bundle time. Plugins live outside the bundle, so we need
// the native Node.js require to load them at runtime.
const nativeRequire = createRequire(__filename);

export interface LoadedPlugin {
  name: string;
  path: string;
  api: StudioPluginApi;
  deactivate?: () => void | Promise<void>;
}

export class PluginLoader {
  private connection: PluginHostConnection;
  private loadedPlugins: LoadedPlugin[] = [];
  private storagePath: string;

  constructor(connection: PluginHostConnection, storagePath: string) {
    this.connection = connection;
    this.storagePath = storagePath;
  }

  async loadPlugin(payload: LoadPluginPayload): Promise<void> {
    const { pluginPath, pluginName } = payload;

    const pkgPath = path.join(pluginPath, 'package.json');
    const pkgRaw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgRaw);

    const mainEntry = pkg.main ?? 'index.js';
    const mainPath = path.resolve(pluginPath, mainEntry);

    const pluginStoragePath = path.join(this.storagePath, pluginName);
    await fs.mkdir(pluginStoragePath, { recursive: true });

    const env: PluginEnvironment = {
      pluginPath,
      pluginName,
      storagePath: pluginStoragePath,
      apiVersion: STUDIO_PLUGIN_API_VERSION,
    };

    const api = new StudioPluginApi(this.connection, env);

    const pluginModule = nativeRequire(mainPath);

    const loaded: LoadedPlugin = {
      name: pluginName,
      path: pluginPath,
      api,
    };

    if (typeof pluginModule.activate === 'function') {
      await pluginModule.activate(api);
    } else if (typeof pluginModule.default?.activate === 'function') {
      await pluginModule.default.activate(api);
    } else {
      console.warn(`[PluginLoader] Plugin '${pluginName}' has no activate() export.`);
    }

    if (typeof pluginModule.deactivate === 'function') {
      loaded.deactivate = pluginModule.deactivate;
    } else if (typeof pluginModule.default?.deactivate === 'function') {
      loaded.deactivate = pluginModule.default.deactivate;
    }

    this.loadedPlugins.push(loaded);
  }

  async unloadPlugin(name: string): Promise<void> {
    const index = this.loadedPlugins.findIndex((plugin) => plugin.name === name);
    if (index === -1) {
      console.warn(`[PluginLoader] Plugin '${name}' is not loaded.`);
      return;
    }

    const plugin = this.loadedPlugins[index];

    if (typeof plugin.deactivate === 'function') {
      try {
        await plugin.deactivate();
      } catch (err) {
        console.error(`[PluginLoader] Error deactivating plugin '${name}':`, err);
      }
    }

    plugin.api.dispose();
    this.invalidateRequireCache(plugin.path);
    this.loadedPlugins.splice(index, 1);
    console.log(`[PluginLoader] Plugin '${name}' unloaded.`);
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of this.loadedPlugins) {
      try {
        await plugin.deactivate?.();
      } catch (err) {
        console.error(`[PluginLoader] Error deactivating '${plugin.name}':`, err);
      }
    }
    this.loadedPlugins = [];
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return [...this.loadedPlugins];
  }

  private invalidateRequireCache(pluginPath: string): void {
    // Must use nativeRequire.cache (the real Node.js module cache), NOT
    // require.cache — Rspack transforms `require` to `__webpack_require__`
    // which has its own separate cache that doesn't hold plugin modules.
    const cache = nativeRequire.cache;
    const normalizedPrefix = pluginPath.endsWith(path.sep) ? pluginPath : pluginPath + path.sep;
    for (const key of Object.keys(cache)) {
      if (key === pluginPath || key.startsWith(normalizedPrefix)) {
        delete cache[key];
      }
    }
  }
}
