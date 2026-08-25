import { createRequire } from 'node:module';

import type { PluginPermission } from '../permissions/PermissionTypes';

const nativeRequire = createRequire(__filename);

export class ModuleBlockedError extends Error {
  readonly pluginName: string;
  readonly module: string;

  constructor(pluginName: string, moduleName: string) {
    super(`Plugin '${pluginName}': module '${moduleName}' is blocked`);
    this.name = 'ModuleBlockedError';
    this.pluginName = pluginName;
    this.module = moduleName;
  }
}

export class PermissionDeniedModuleError extends Error {
  readonly pluginName: string;
  readonly module: string;
  readonly permission: PluginPermission;

  constructor(pluginName: string, permission: PluginPermission, moduleName: string) {
    super(`Plugin '${pluginName}': module '${moduleName}' requires permission '${permission}'`);
    this.name = 'PermissionDeniedModuleError';
    this.pluginName = pluginName;
    this.module = moduleName;
    this.permission = permission;
  }
}

const ALWAYS_ALLOWED = new Set([
  'path',
  'url',
  'querystring',
  'util',
  'assert',
  'events',
  'stream',
  'string_decoder',
  'buffer',
  'punycode',
  'zlib',
]);

const REQUIRES_FILESYSTEM = new Set(['fs', 'fs/promises']);

const ALWAYS_BLOCKED = new Set([
  'http',
  'https',
  'http2',
  'net',
  'tls',
  'dgram',
  'dns',
  'child_process',
  'cluster',
  'worker_threads',
  'v8',
  'perf_hooks',
  'async_hooks',
  'inspector',
  'trace_events',
  'crypto',
]);

function createRestrictedOsModule(): Readonly<Record<string, unknown>> {
  const realOs = nativeRequire('os');
  return Object.freeze({
    platform: realOs.platform,
    arch: realOs.arch,
    tmpdir: realOs.tmpdir,
    EOL: realOs.EOL,
  });
}

export function createModuleGate(pluginName: string, pluginPath: string, permissions: PluginPermission[]): NodeRequire {
  const hasFilesystem = permissions.includes('filesystem');
  const hasNative = permissions.includes('native');
  const hasSystemInfo = permissions.includes('system-info');

  const cachedRestrictedOs = hasSystemInfo ? createRestrictedOsModule() : undefined;

  function normalizeSpecifier(spec: string): string {
    return spec.startsWith('node:') ? spec.slice(5) : spec;
  }

  function gatedRequire(specifier: string): unknown {
    const normalized = normalizeSpecifier(specifier);

    if (normalized.endsWith('.node')) {
      if (!hasNative) {
        throw new PermissionDeniedModuleError(pluginName, 'native', specifier);
      }
    }

    if (normalized === 'os') {
      if (!hasSystemInfo) {
        throw new PermissionDeniedModuleError(pluginName, 'system-info', specifier);
      }
      return cachedRestrictedOs;
    }

    if (ALWAYS_BLOCKED.has(normalized)) {
      throw new ModuleBlockedError(pluginName, specifier);
    }

    if (REQUIRES_FILESYSTEM.has(normalized) && !hasFilesystem) {
      throw new PermissionDeniedModuleError(pluginName, 'filesystem', specifier);
    }

    if (ALWAYS_ALLOWED.has(normalized)) {
      return nativeRequire(normalized);
    }

    // npm packages — resolve from plugin's node_modules
    try {
      const resolved = nativeRequire.resolve(specifier, { paths: [pluginPath] });

      if (resolved.endsWith('.node') && !hasNative) {
        throw new PermissionDeniedModuleError(pluginName, 'native', specifier);
      }

      return nativeRequire(resolved);
    } catch (err) {
      if (err instanceof ModuleBlockedError || err instanceof PermissionDeniedModuleError) {
        throw err;
      }
      throw new Error(`Plugin '${pluginName}': cannot resolve module '${specifier}' from '${pluginPath}'`, {
        cause: err,
      });
    }
  }

  gatedRequire.resolve = function resolve(specifier: string): string {
    const normalized = normalizeSpecifier(specifier);

    if (normalized.endsWith('.node') && !hasNative) {
      throw new PermissionDeniedModuleError(pluginName, 'native', specifier);
    }
    if (normalized === 'os' && !hasSystemInfo) {
      throw new PermissionDeniedModuleError(pluginName, 'system-info', specifier);
    }
    if (ALWAYS_BLOCKED.has(normalized)) {
      throw new ModuleBlockedError(pluginName, specifier);
    }
    if (REQUIRES_FILESYSTEM.has(normalized) && !hasFilesystem) {
      throw new PermissionDeniedModuleError(pluginName, 'filesystem', specifier);
    }
    if (ALWAYS_ALLOWED.has(normalized) || REQUIRES_FILESYSTEM.has(normalized)) {
      return nativeRequire.resolve(normalized);
    }
    return nativeRequire.resolve(specifier, { paths: [pluginPath] });
  };

  // Provide a minimal cache property (some packages inspect require.cache)
  Object.defineProperty(gatedRequire, 'cache', {
    get() {
      return {};
    },
    configurable: false,
  });

  return gatedRequire as unknown as NodeRequire;
}
