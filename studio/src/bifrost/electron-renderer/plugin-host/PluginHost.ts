import type { Bifrost } from '#bifrost/Bifrost';
import { PluginPermissionStore } from '#bifrost/common/plugin-host/PluginPermissionStore';
import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';
import { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type ApiRequestPayload,
  type ApiResponsePayload,
  type LoadPluginPayload,
  PH_API_REQUEST,
  PH_API_RESPONSE,
  PH_HOST_DISPOSE,
  PH_HOST_READY,
  PH_LOAD_PLUGIN,
  PH_PLUGIN_CRASHED,
  PH_REGISTER_CALLBACK,
  PH_RELOAD_PLUGIN,
  PH_TRUST_AND_REENABLE,
  PH_UNLOAD_PLUGIN,
  PH_UNREGISTER_CALLBACK,
  PLUGIN_HOST_PROTOCOL_VERSION,
  type PluginCrashedPayload,
  type PluginHostMessage,
  type RegisterCallbackPayload,
  type ReloadPluginPayload,
  type TrustAndReEnablePayload,
  type UnloadPluginPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import { EVENT_PLUGIN_LIST_CHANGED, type IPluginHost } from '#bifrost/contracts/PluginHostTypes';
import { getPluginsDir } from '#bifrost/node/BifrostPathFunctions';
import { PluginIframeManager } from '#components/webview/PluginIframeManager';
import { type ChildProcess, fork } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import { AbstractEmitter, type PluginInfo } from '@evil/bifrost_fw_sdk';

import { EVENT_THEME_CHANGED } from '../../../../../studio-sdk/src/contracts/internal/ThemeEvents';
import { pluginModuleLoader } from '../../../modules/bpmn-core/plugin-modules/PluginModuleLoader';
import { pluginDmnModuleLoader } from '../../../modules/dmn-core/plugin-modules/PluginDmnModuleLoader';
import { checkApiVersionCompatibility } from '../../common/plugin-host/manifest/ApiVersionCheck';
import { readManifest } from '../../common/plugin-host/manifest/ManifestReader';
import type {
  BifrostStudioManifest,
  ManifestError,
  ManifestWarning,
} from '../../common/plugin-host/manifest/ManifestTypes';
import { pluginNameToHostname } from '../../common/plugin-host/permissions/ScopedPluginName';
import { STUDIO_PLUGIN_API_VERSION } from '../../contracts/PluginApiVersion';
import { ActivationManager } from './ActivationManager';
import { PluginHostBridge } from './PluginHostBridge';
import { PluginHostLogger } from './PluginHostLogger';
import { showPermissionReviewDialog } from './PluginPermissionDialog';
import { type ContributionDisposer, ContributionRegistrar } from './manifest/ContributionRegistrar';

interface DiscoveredPlugin {
  name: string;
  packageName?: string;
  path: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  readmePath?: string;
  logoPath?: string;
  homepage?: string;
  keywords?: string[];
  deprecated?: string | boolean;
  manifest?: BifrostStudioManifest;
  manifestErrors?: ManifestError[];
  manifestWarnings?: ManifestWarning[];
}

function parseAuthorString(raw: string): { name: string; url?: string } {
  const match = raw.match(/^([^<(]+?)?\s*(?:<[^>]+>)?\s*(?:\(([^)]+)\))?\s*$/);
  return {
    name: match?.[1]?.trim() ?? raw.trim(),
    url: match?.[2]?.trim() || undefined,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLogoPath(pluginPath: string, pkg: any): Promise<string | undefined> {
  const defaultLogo = path.join(pluginPath, 'LOGO.png');
  if (await fileExists(defaultLogo)) {
    return defaultLogo;
  }

  if (typeof pkg.logo === 'string' && pkg.logo.endsWith('.png')) {
    const customLogo = path.resolve(pluginPath, pkg.logo);
    if (await fileExists(customLogo)) {
      return customLogo;
    }
  }

  return undefined;
}

function resolveAuthor(pkg: any): { name: string; url?: string } {
  if (typeof pkg.author === 'string') {
    return parseAuthorString(pkg.author);
  }
  if (pkg.author != null && typeof pkg.author === 'object') {
    return {
      name: pkg.author.name ?? '',
      url: pkg.author.url || undefined,
    };
  }
  return { name: '' };
}

function resolveDeprecated(pkg: any): string | boolean | undefined {
  if (pkg.deprecated === true) {
    return true;
  }
  if (typeof pkg.deprecated === 'string' && pkg.deprecated.length > 0) {
    return pkg.deprecated;
  }
  return undefined;
}

async function discoverSinglePlugin(pluginPath: string): Promise<DiscoveredPlugin | null> {
  const pkgPath = path.join(pluginPath, 'package.json');
  try {
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const dirName = path.basename(pluginPath);
    const hasReadme = await fileExists(path.join(pluginPath, 'README.md'));
    const logoPath = await resolveLogoPath(pluginPath, pkg);
    const author = resolveAuthor(pkg);
    const homepage = (typeof pkg.homepage === 'string' && pkg.homepage) || author.url || undefined;
    const keywords =
      Array.isArray(pkg.keywords) && pkg.keywords.every((kw: unknown) => typeof kw === 'string')
        ? (pkg.keywords as string[])
        : undefined;

    const manifestResult = readManifest(pkg);

    const rawName: string = pkg.name ?? dirName;
    const name = pluginNameToHostname(rawName);
    const packageName = rawName !== name ? rawName : undefined;

    return {
      name,
      packageName,
      path: pluginPath,
      displayName: pkg.displayName ?? rawName ?? dirName,
      description: pkg.description ?? '',
      version: pkg.version ?? '0.0.0',
      author: author.name,
      readmePath: hasReadme ? path.join(pluginPath, 'README.md') : undefined,
      logoPath,
      homepage,
      keywords,
      deprecated: resolveDeprecated(pkg),
      manifest: manifestResult.manifest ?? undefined,
      manifestErrors: manifestResult.errors.length > 0 ? manifestResult.errors : undefined,
      manifestWarnings: manifestResult.warnings.length > 0 ? manifestResult.warnings : undefined,
    };
  } catch {
    return null;
  }
}

async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  const pluginsDir = getPluginsDir();
  console.log(`[PluginHost] Discovering plugins in: ${pluginsDir}`);

  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const plugins: DiscoveredPlugin[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Scoped packages: @scope/ directories contain the actual plugin dirs
      if (entry.name.startsWith('@')) {
        try {
          const scopeDir = path.join(pluginsDir, entry.name);
          const scopeEntries = await fs.readdir(scopeDir, { withFileTypes: true });
          for (const scopeEntry of scopeEntries) {
            if (!scopeEntry.isDirectory()) {
              continue;
            }
            const plugin = await discoverSinglePlugin(path.join(scopeDir, scopeEntry.name));
            if (plugin != null) {
              plugins.push(plugin);
            }
          }
        } catch {
          // Ignore unreadable scope directories
        }
        continue;
      }

      const plugin = await discoverSinglePlugin(path.join(pluginsDir, entry.name));
      if (plugin != null) {
        plugins.push(plugin);
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

export class PluginHost extends AbstractEmitter implements IPluginHost {
  private childProcess: ChildProcess | null = null;
  private ready: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private disposed: boolean = false;
  private connection: PluginHostConnection | null = null;
  private bridge: PluginHostBridge;
  private bifrost: Bifrost;
  private pluginList: PluginInfo[] = [];
  private pluginIframeManager: PluginIframeManager;
  private contributionRegistrar: ContributionRegistrar;
  private contributionDisposers = new Map<string, ContributionDisposer>();
  private activationManager: ActivationManager;
  private permissionStore: PluginPermissionStore;

  private crashCount = 0;
  private crashWindowStart = 0;
  private readonly MAX_CRASHES = 3;
  private readonly CRASH_WINDOW_MS = 60_000;
  private onStartupDisposer: { dispose: () => void } | null = null;

  readonly logger = new PluginHostLogger();

  constructor(bifrost: Bifrost) {
    super();
    this.bifrost = bifrost;
    this.pluginIframeManager = new PluginIframeManager();
    this.contributionRegistrar = new ContributionRegistrar(bifrost);
    this.permissionStore = new PluginPermissionStore(bifrost.getLocalStorage('PluginPermissions'));
    this.activationManager = new ActivationManager(bifrost, this, async (pluginName, permissions) => {
      const info = this.pluginList.find((entry) => entry.name === pluginName);
      const displayName = info?.displayName ?? pluginName;
      return showPermissionReviewDialog(this.bifrost, displayName, pluginName, permissions, this.permissionStore);
    });
    this.bridge = new PluginHostBridge(bifrost, this, this.pluginIframeManager);
    this.bridge.setContributionRegistrar(this.contributionRegistrar);

    bifrost.theme.on(EVENT_THEME_CHANGED, () => {
      const tokens = this.extractThemeTokens();
      const themeType = bifrost.theme.getCurrentThemeType();
      this.pluginIframeManager.broadcastThemeTokens(tokens, themeType);
    });
  }

  getPluginIframeManager(): PluginIframeManager {
    return this.pluginIframeManager;
  }

  /**
   * Reads all `--theme-*` CSS custom properties from the root `.bifrost` element
   * and returns them as a flat Record. These are broadcast to plugin iframes
   * so they can apply the Studio's color scheme.
   */
  extractThemeTokens(): Record<string, string> {
    const root = document.querySelector('.bifrost') as HTMLElement | null;
    if (root == null) {
      return {};
    }
    const computed = getComputedStyle(root);
    const tokens: Record<string, string> = {};
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText?.includes('bifrost-theme--')) {
            for (let idx = 0; idx < rule.style.length; idx++) {
              const prop = rule.style[idx];
              if (prop.startsWith('--theme-')) {
                tokens[prop] = computed.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheets will throw — skip them
      }
    }
    return tokens;
  }

  getWebviewProtocol(): string | undefined {
    return this.bifrost.env.webviewProtocol;
  }

  async start(): Promise<void> {
    if (this.childProcess != null) {
      console.warn('[PluginHost] Already running. Ignoring start().');
      return;
    }

    this.disposed = false;
    this.ready = false;

    const hostScript = path.resolve(process.env.__BFR_BUNDLE_DIR__!, 'plugin-host.js');

    this.childProcess = fork(hostScript, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        BFR_PLUGINS_DIR: process.env.BFR_PLUGINS_DIR ?? '',
        BFR_PLUGIN_STORAGE_PATH: process.env.BFR_PLUGIN_STORAGE_PATH ?? '',
      },
    });

    this.connection = new PluginHostConnection((msg) => {
      this.childProcess?.send(msg);
    });

    pluginModuleLoader.setSendFunction((pluginName, data) => {
      this.bridge.deliverRendererModuleMessage(pluginName, data);
    });

    pluginDmnModuleLoader.setSendFunction((pluginName, data) => {
      this.bridge.deliverRendererModuleMessage(pluginName, data);
    });

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trimEnd().split('\n');
      for (const line of lines) {
        console.log(`[PluginHost:stdout] ${line}`);
        this.logger.append(line);
      }
    });
    this.childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trimEnd().split('\n');
      for (const line of lines) {
        console.error(`[PluginHost:stderr] ${line}`);
        this.logger.append(`[stderr] ${line}`);
      }
    });

    this.childProcess.on('exit', (code, signal) => {
      console.log(`[PluginHost] Exited with code=${code}, signal=${signal}`);
      this.childProcess = null;
      this.ready = false;
      this.handleUnexpectedExit(code, signal);
    });

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.childProcess?.kill();
        reject(new Error('[PluginHost] Timed out waiting for ready signal.'));
      }, 10_000);

      this.childProcess!.on('message', (message: PluginHostMessage) => {
        if (message.type === PH_HOST_READY) {
          clearTimeout(timeout);
          this.ready = true;
          resolve();
          return;
        }

        if (this.connection?.handleResponse(message)) {
          return;
        }
        this.handleHostMessage(message);
      });

      this.childProcess!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    await this.readyPromise;

    (globalThis as any).__pluginHostPid = this.childProcess?.pid ?? null;

    const initialTokens = this.extractThemeTokens();
    const initialThemeType = this.bifrost.theme.getCurrentThemeType();
    this.pluginIframeManager.broadcastThemeTokens(initialTokens, initialThemeType);
  }

  private async handleHostMessage(message: PluginHostMessage): Promise<void> {
    switch (message.type) {
      case PH_API_REQUEST:
        await this.handleApiRequest(message);
        break;
      case PH_REGISTER_CALLBACK:
        try {
          this.bridge.registerCallback(message.payload as RegisterCallbackPayload);
          this.send({
            protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
            type: `${PH_REGISTER_CALLBACK}:ack`,
            requestId: message.requestId,
            payload: { success: true },
          });
        } catch (err: any) {
          this.send({
            protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
            type: `${PH_REGISTER_CALLBACK}:ack`,
            requestId: message.requestId,
            payload: { success: false, error: err?.message ?? String(err) },
          });
        }
        break;
      case PH_UNREGISTER_CALLBACK:
        this.bridge.unregisterCallback((message.payload as { callbackId: string }).callbackId);
        break;
      case PH_PLUGIN_CRASHED:
        this.handlePluginCrashed(message.payload as PluginCrashedPayload);
        break;
    }
  }

  private handlePluginCrashed(payload: PluginCrashedPayload): void {
    const { pluginName, quarantined, crashCount } = payload;
    const info = this.pluginList.find((plugin) => plugin.name === pluginName);
    const displayName = info?.displayName ?? pluginName;

    if (quarantined) {
      console.error(`[PluginHost] Plugin '${displayName}' quarantined after ${crashCount} crashes.`);
      this.bifrost.notifications.open({
        type: 'error',
        source: 'Plugin Host',
        content: `Plugin '${displayName}' has been quarantined after ${crashCount} crashes.`,
      });

      if (info != null) {
        info.status = 'quarantined';
        info.errorMessage = `Quarantined after ${crashCount} crashes`;
        this.emit(EVENT_PLUGIN_LIST_CHANGED);
      }
    } else {
      console.warn(`[PluginHost] Plugin '${displayName}' crashed (crash #${crashCount}). Restarting...`);
      this.bifrost.notifications.open({
        type: 'warning',
        source: 'Plugin Host',
        content: `Plugin '${displayName}' crashed. It will restart automatically.`,
      });

      this.reloadPlugin(pluginName).catch((error) => {
        console.error(`[PluginHost] Failed to restart plugin '${displayName}' after crash:`, error);
      });
    }
  }

  private async handleApiRequest(message: PluginHostMessage): Promise<void> {
    try {
      const result = await this.bridge.executeApiRequest(message.payload as ApiRequestPayload);
      this.send({
        protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
        type: PH_API_RESPONSE,
        requestId: message.requestId,
        payload: { success: true, result } satisfies ApiResponsePayload,
      });
    } catch (error: any) {
      this.send({
        protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
        type: PH_API_RESPONSE,
        requestId: message.requestId,
        payload: { success: false, error: error?.message ?? String(error) } satisfies ApiResponsePayload,
      });
    }
  }

  send(message: PluginHostMessage): void {
    if (this.childProcess == null || !this.ready) {
      console.warn('[PluginHost] Cannot send — host is not ready.');
      return;
    }
    this.childProcess.send(message);
  }

  getConnection(): PluginHostConnection | null {
    return this.connection;
  }

  getLog(): string[] {
    return this.logger.getLog();
  }

  onLog(handler: (line: string) => void): void {
    this.logger.onLog(handler);
  }

  clearLog(): void {
    this.logger.clear();
  }

  async discoverAndLoadPlugins(disabledPlugins?: string[]): Promise<void> {
    const discovered = await discoverPlugins();
    const disabled = disabledPlugins ?? [];
    this.pluginList = [];
    const pendingEagerPlugins: DiscoveredPlugin[] = [];

    for (const plugin of discovered) {
      const isDisabled = disabled.includes(plugin.name);

      if (isDisabled) {
        this.pluginList.push(this.toPluginInfo(plugin, { enabled: false, status: 'disabled' }));
        continue;
      }

      // Reject plugins whose manifest has errors
      if (plugin.manifestErrors != null && plugin.manifestErrors.length > 0) {
        const errorSummary = plugin.manifestErrors.map((err) => `${err.path}: ${err.message}`).join('; ');
        console.error(`[PluginHost] Plugin '${plugin.name}' has manifest errors: ${errorSummary}`);
        this.pluginList.push(
          this.toPluginInfo(plugin, {
            enabled: false,
            status: 'error',
            errorMessage: `Manifest errors: ${errorSummary}`,
          }),
        );

        this.bifrost.notifications.open({
          type: 'error',
          content: `Plugin '${plugin.displayName || plugin.name}' has invalid manifest: ${errorSummary}`,
          source: plugin.displayName || plugin.name,
        });
        continue;
      }

      if (plugin.manifestWarnings != null && plugin.manifestWarnings.length > 0) {
        const warnSummary = plugin.manifestWarnings.map((warn) => `${warn.path}: ${warn.message}`).join('; ');
        console.warn(`[PluginHost] Plugin '${plugin.name}' has manifest warnings: ${warnSummary}`);
      }

      // API version compatibility check
      if (plugin.manifest?.apiVersion != null) {
        const versionCheck = checkApiVersionCompatibility(plugin.manifest.apiVersion, STUDIO_PLUGIN_API_VERSION);
        if (!versionCheck.compatible) {
          console.error(`[PluginHost] Plugin '${plugin.name}' is incompatible: ${versionCheck.reason}`);
          this.pluginList.push(
            this.toPluginInfo(plugin, {
              enabled: false,
              status: 'error',
              errorMessage: versionCheck.reason,
            }),
          );

          this.bifrost.notifications.open({
            type: 'error',
            content: `Plugin '${plugin.displayName || plugin.name}' requires API version ${versionCheck.requiredVersion}, but this Studio provides ${versionCheck.studioVersion}.`,
            source: plugin.displayName || plugin.name,
          });
          continue;
        }
      }

      // Register manifest contributions before loading plugin code
      if (plugin.manifest != null) {
        const disposer = this.contributionRegistrar.registerContributions(
          plugin.name,
          plugin.manifest,
          () => this.activationManager.activatePlugin(plugin.name),
          plugin.path,
        );
        this.contributionDisposers.set(plugin.name, disposer);
      }

      const hasActivationEvents =
        plugin.manifest?.activationEvents != null && plugin.manifest.activationEvents.length > 0;

      if (hasActivationEvents) {
        // Lazy activation: register events, don't load code yet
        this.activationManager.registerActivationEvents(
          plugin.name,
          plugin.path,
          plugin.manifest!.activationEvents!,
          plugin.manifest?.permissions ?? [],
        );

        this.pluginList.push(this.toPluginInfo(plugin, { enabled: true, status: 'pending' }));
      } else {
        const pluginPermissions = plugin.manifest?.permissions ?? [];

        if (pluginPermissions.length > 0) {
          // Plugins with permissions are deferred to after the UI is ready
          // because the permission dialog requires a rendered DOM.
          this.pluginList.push(this.toPluginInfo(plugin, { enabled: true, status: 'pending' }));
          pendingEagerPlugins.push(plugin);
        } else {
          // Plugins without permissions load immediately (no dialog risk)
          try {
            this.bridge.permissionGate.register(plugin.name, pluginPermissions);

            await this.getConnection()!.request(PH_LOAD_PLUGIN, {
              pluginPath: plugin.path,
              pluginName: plugin.name,
              permissions: pluginPermissions,
            } satisfies LoadPluginPayload);

            this.pluginList.push(this.toPluginInfo(plugin, { enabled: true, status: 'loaded' }));
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[PluginHost] Failed to load plugin '${plugin.name}':`, err);
            this.pluginList.push(
              this.toPluginInfo(plugin, {
                enabled: false,
                status: 'error',
                errorMessage,
              }),
            );

            this.bifrost.notifications.open({
              type: 'error',
              content: `Plugin '${plugin.displayName || plugin.name}' failed to load: ${errorMessage}`,
              source: plugin.displayName || plugin.name,
            });
          }
        }
      }
    }

    this.emit(EVENT_PLUGIN_LIST_CHANGED);

    // Eager plugins WITH permissions and onStartup plugins are deferred
    // until the Studio UI is fully rendered. The 'ready' event guarantees
    // a live DOM — without this, permission dialogs would deadlock the
    // initialization because React hasn't mounted yet.
    const onStartupPlugins = discovered.filter((plugin) => this.activationManager.hasOnStartupEvent(plugin.name));
    const hasDeferredWork = pendingEagerPlugins.length > 0 || onStartupPlugins.length > 0;

    if (hasDeferredWork) {
      this.onStartupDisposer?.dispose();

      // 'ready' is a one-shot event emitted once during the window's initial
      // Bifrost.initialize() call. discoverAndLoadPlugins() also runs later —
      // e.g. via refresh() (the "Reload Plugins" command, cross-window resync) —
      // at which point 'ready' has already fired and will never fire again. If we
      // always awaited a fresh 'on(ready', ...)' subscription, any onStartup or
      // permission-gated plugin discovered after initial boot would be stuck in
      // 'pending' status forever, since its permission dialog would never appear
      // and its activate() would never run. Detect the already-ready case and
      // proceed immediately instead of waiting for an event that already passed.
      if (this.bifrost.isInitialized) {
        void this.loadDeferredPlugins(pendingEagerPlugins, onStartupPlugins);
      } else {
        this.onStartupDisposer = this.bifrost.events.on('ready', () => {
          void this.loadDeferredPlugins(pendingEagerPlugins, onStartupPlugins);
        });
      }
    }
  }

  /**
   * Loads eager plugins and activates onStartup plugins after the UI is ready.
   * Eager plugins (those without activationEvents) show permission dialogs
   * and load code here — safely deferred from the init chain to avoid
   * deadlocking before React has rendered.
   */
  private async loadDeferredPlugins(
    eagerPlugins: DiscoveredPlugin[],
    onStartupPlugins: DiscoveredPlugin[],
  ): Promise<void> {
    for (const plugin of eagerPlugins) {
      await this.loadEagerPlugin(plugin);
    }

    for (const plugin of onStartupPlugins) {
      await this.activationManager.activatePlugin(plugin.name);
    }
  }

  private async loadEagerPlugin(plugin: DiscoveredPlugin): Promise<void> {
    const pluginPermissions = plugin.manifest?.permissions ?? [];

    const allowed = await showPermissionReviewDialog(
      this.bifrost,
      plugin.displayName || plugin.name,
      plugin.name,
      pluginPermissions,
      this.permissionStore,
    );

    if (!allowed) {
      const pluginInfo = this.pluginList.find((entry) => entry.name === plugin.name);
      if (pluginInfo != null) {
        pluginInfo.enabled = false;
        pluginInfo.status = 'disabled';
      }

      const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
      if (!disabledPlugins.includes(plugin.name)) {
        this.bifrost.settings.set('plugins.disabledPlugins', [...disabledPlugins, plugin.name]);
      }

      this.emit(EVENT_PLUGIN_LIST_CHANGED);
      return;
    }

    try {
      this.bridge.permissionGate.register(plugin.name, pluginPermissions);

      await this.getConnection()!.request(PH_LOAD_PLUGIN, {
        pluginPath: plugin.path,
        pluginName: plugin.name,
        permissions: pluginPermissions,
      } satisfies LoadPluginPayload);

      this.updatePluginStatus(plugin.name, 'loaded');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[PluginHost] Failed to load plugin '${plugin.name}':`, err);

      const pluginInfo = this.pluginList.find((entry) => entry.name === plugin.name);
      if (pluginInfo != null) {
        pluginInfo.enabled = false;
        pluginInfo.status = 'error';
        pluginInfo.errorMessage = errorMessage;
      }

      this.bifrost.notifications.open({
        type: 'error',
        content: `Plugin '${plugin.displayName || plugin.name}' failed to load: ${errorMessage}`,
        source: plugin.displayName || plugin.name,
      });
    }

    this.emit(EVENT_PLUGIN_LIST_CHANGED);
  }

  getPluginList(): PluginInfo[] {
    return [...this.pluginList];
  }

  registerPluginPermissions(pluginName: string, permissions: PluginPermission[]): void {
    this.bridge.permissionGate.register(pluginName, permissions);
  }

  unregisterPluginPermissions(pluginName: string): void {
    this.bridge.permissionGate.unregister(pluginName);
  }

  /**
   * Cleans up bridge-registered resources (commands, callbacks, etc.)
   * for a plugin whose activation failed. Called by ActivationManager
   * when the sandbox times out or crashes during activation.
   */
  cleanupPluginResources(pluginName: string): void {
    this.bridge.disposePlugin(pluginName);
    this.pluginIframeManager.disposePlugin(pluginName);
    this.unregisterPluginPermissions(pluginName);
  }

  updatePluginStatus(pluginName: string, status: PluginInfo['status'], errorMessage?: string): void {
    const plugin = this.pluginList.find((entry) => entry.name === pluginName);
    if (plugin != null) {
      plugin.status = status;
      if (errorMessage != null) {
        plugin.errorMessage = errorMessage;
      }
      this.emit(EVENT_PLUGIN_LIST_CHANGED);
    }
  }

  getPermissionStore(): PluginPermissionStore {
    return this.permissionStore;
  }

  getPluginsDirectory(): string {
    return getPluginsDir();
  }

  async refresh(): Promise<void> {
    await this.dispose();
    this.disposed = false;
    await this.start();
    const disabledPlugins = (this.bifrost.settings.get('plugins.disabledPlugins') as string[] | undefined) ?? [];
    await this.discoverAndLoadPlugins(disabledPlugins);
  }

  async unloadPlugin(name: string): Promise<void> {
    if (!this.isRunning()) {
      throw new Error('Plugin Host is not running');
    }

    const pluginInfo = this.pluginList.find((plugin) => plugin.name === name);
    if (!pluginInfo) {
      throw new Error(`Plugin '${name}' not found`);
    }

    this.activationManager.disposePlugin(name);
    this.disposeContributions(name);
    this.bridge.disposePlugin(name);
    this.pluginIframeManager.disposePlugin(name);
    this.unregisterPluginPermissions(name);

    await this.connection!.request(PH_UNLOAD_PLUGIN, { pluginName: name } satisfies UnloadPluginPayload);

    pluginInfo.status = 'disabled';
    pluginInfo.enabled = false;

    this.emit(EVENT_PLUGIN_LIST_CHANGED);
  }

  removePlugin(name: string): void {
    const idx = this.pluginList.findIndex((plugin) => plugin.name === name);
    if (idx !== -1) {
      this.pluginList.splice(idx, 1);
    }
  }

  async reloadPlugin(name: string): Promise<void> {
    if (!this.isRunning()) {
      throw new Error('Plugin Host is not running');
    }

    const pluginInfo = this.pluginList.find((plugin) => plugin.name === name);
    if (!pluginInfo) {
      throw new Error(`Plugin '${name}' not found`);
    }

    // Tear down existing runtime state
    this.bridge.disposePlugin(name);
    this.pluginIframeManager.disposePlugin(name);
    this.disposeContributions(name);
    this.activationManager.disposePlugin(name);

    // Re-discover from disk so manifest edits are picked up
    const freshPlugin = await discoverSinglePlugin(pluginInfo.path);
    if (freshPlugin == null) {
      pluginInfo.status = 'error';
      pluginInfo.enabled = false;
      pluginInfo.errorMessage = 'Plugin directory no longer exists or has no valid package.json.';
      pluginInfo.manifestErrors = undefined;
      this.emit(EVENT_PLUGIN_LIST_CHANGED);
      return;
    }

    // Refresh metadata (user may have edited package.json)
    pluginInfo.displayName = freshPlugin.displayName;
    pluginInfo.description = freshPlugin.description;
    pluginInfo.version = freshPlugin.version;
    pluginInfo.author = freshPlugin.author;
    pluginInfo.readmePath = freshPlugin.readmePath;
    pluginInfo.logoPath = freshPlugin.logoPath;
    pluginInfo.homepage = freshPlugin.homepage;
    pluginInfo.keywords = freshPlugin.keywords;
    pluginInfo.deprecated = freshPlugin.deprecated;
    pluginInfo.manifest = freshPlugin.manifest as PluginInfo['manifest'];
    pluginInfo.manifestErrors = freshPlugin.manifestErrors;
    pluginInfo.manifestWarnings = freshPlugin.manifestWarnings;

    // Validate manifest
    if (freshPlugin.manifestErrors != null && freshPlugin.manifestErrors.length > 0) {
      const errorSummary = freshPlugin.manifestErrors.map((err) => `${err.path}: ${err.message}`).join('; ');
      console.error(`[PluginHost] Plugin '${name}' still has manifest errors: ${errorSummary}`);
      pluginInfo.status = 'error';
      pluginInfo.enabled = false;
      pluginInfo.errorMessage = `Manifest errors: ${errorSummary}`;
      this.emit(EVENT_PLUGIN_LIST_CHANGED);

      this.bifrost.notifications.open({
        type: 'error',
        content: `Plugin '${freshPlugin.displayName || name}' has invalid manifest: ${errorSummary}`,
        source: freshPlugin.displayName || name,
      });
      return;
    }

    if (freshPlugin.manifestWarnings != null && freshPlugin.manifestWarnings.length > 0) {
      const warnSummary = freshPlugin.manifestWarnings.map((warn) => `${warn.path}: ${warn.message}`).join('; ');
      console.warn(`[PluginHost] Plugin '${name}' has manifest warnings: ${warnSummary}`);
    }

    // API version compatibility check
    if (freshPlugin.manifest?.apiVersion != null) {
      const versionCheck = checkApiVersionCompatibility(freshPlugin.manifest.apiVersion, STUDIO_PLUGIN_API_VERSION);
      if (!versionCheck.compatible) {
        pluginInfo.status = 'error';
        pluginInfo.enabled = false;
        pluginInfo.errorMessage = versionCheck.reason;
        this.emit(EVENT_PLUGIN_LIST_CHANGED);

        this.bifrost.notifications.open({
          type: 'error',
          content: `Plugin '${freshPlugin.displayName || name}' requires API version ${versionCheck.requiredVersion}, but this Studio provides ${versionCheck.studioVersion}.`,
          source: freshPlugin.displayName || name,
        });
        return;
      }
    }

    // Permission review dialog
    const reloadPermissions = freshPlugin.manifest?.permissions ?? [];
    const allowed = await showPermissionReviewDialog(
      this.bifrost,
      freshPlugin.displayName || name,
      name,
      reloadPermissions,
      this.permissionStore,
    );

    if (!allowed) {
      pluginInfo.status = 'disabled';
      pluginInfo.enabled = false;
      this.emit(EVENT_PLUGIN_LIST_CHANGED);

      const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
      if (!disabledPlugins.includes(name)) {
        this.bifrost.settings.set('plugins.disabledPlugins', [...disabledPlugins, name]);
      }
      return;
    }

    // Re-register manifest contributions
    if (freshPlugin.manifest != null) {
      const disposer = this.contributionRegistrar.registerContributions(
        name,
        freshPlugin.manifest,
        () => this.activationManager.activatePlugin(name),
        freshPlugin.path,
      );
      this.contributionDisposers.set(name, disposer);
    }

    const hasActivationEvents =
      freshPlugin.manifest?.activationEvents != null && freshPlugin.manifest.activationEvents.length > 0;

    if (hasActivationEvents) {
      this.activationManager.registerActivationEvents(
        name,
        freshPlugin.path,
        freshPlugin.manifest!.activationEvents!,
        reloadPermissions,
      );
      pluginInfo.status = 'pending';
      pluginInfo.enabled = true;
      pluginInfo.errorMessage = undefined;
      this.emit(EVENT_PLUGIN_LIST_CHANGED);

      if (this.activationManager.hasOnStartupEvent(name)) {
        this.activationManager.activatePlugin(name);
      }
    } else {
      try {
        this.bridge.permissionGate.register(name, reloadPermissions);

        await this.connection!.request(PH_RELOAD_PLUGIN, {
          pluginName: name,
          pluginPath: pluginInfo.path,
          permissions: reloadPermissions,
        } satisfies ReloadPluginPayload);

        pluginInfo.status = 'loaded';
        pluginInfo.enabled = true;
        pluginInfo.errorMessage = undefined;
        this.emit(EVENT_PLUGIN_LIST_CHANGED);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[PluginHost] Failed to reload plugin '${name}':`, err);
        pluginInfo.status = 'error';
        pluginInfo.enabled = false;
        pluginInfo.errorMessage = errorMessage;
        this.emit(EVENT_PLUGIN_LIST_CHANGED);

        this.bifrost.notifications.open({
          type: 'error',
          content: `Plugin '${pluginInfo.displayName || name}' failed to load: ${errorMessage}`,
          source: pluginInfo.displayName || name,
        });
      }
    }
  }

  async trustAndReEnablePlugin(name: string): Promise<void> {
    if (!this.isRunning()) {
      throw new Error('Plugin Host is not running');
    }

    await this.connection!.request(PH_TRUST_AND_REENABLE, {
      pluginName: name,
    } satisfies TrustAndReEnablePayload);

    // Clear trust record so the permission dialog always fires after quarantine
    this.permissionStore.remove(name);

    const pluginInfo = this.pluginList.find((plugin) => plugin.name === name);
    if (pluginInfo != null) {
      pluginInfo.status = 'pending';
      pluginInfo.errorMessage = undefined;
      this.emit(EVENT_PLUGIN_LIST_CHANGED);
    }

    await this.reloadPlugin(name);
  }

  async dispose(): Promise<void> {
    if (this.disposed || this.childProcess == null) {
      return;
    }
    this.disposed = true;

    this.send({
      protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
      type: PH_HOST_DISPOSE,
    });

    await new Promise<void>((resolve) => {
      const killTimeout = setTimeout(() => {
        console.warn('[PluginHost] Did not exit in time. Killing.');
        this.childProcess?.kill('SIGKILL');
        resolve();
      }, 5_000);

      this.childProcess!.on('exit', () => {
        clearTimeout(killTimeout);
        resolve();
      });
    });

    this.activationManager.dispose();
    this.disposeAllContributions();
    this.bridge.dispose();
    this.connection?.rejectAll('Plugin Host disposed');
    this.childProcess = null;
    this.ready = false;
    this.connection = null;
    (globalThis as any).__pluginHostPid = null;
  }

  kill(): void {
    if (this.childProcess != null) {
      this.disposed = true;
      this.childProcess.kill('SIGKILL');
      this.activationManager.dispose();
      this.disposeAllContributions();
      this.bridge.dispose();
      this.connection?.rejectAll('Plugin Host killed');
      this.childProcess = null;
      this.ready = false;
      this.connection = null;
      (globalThis as any).__pluginHostPid = null;
    }
  }

  isRunning(): boolean {
    return this.childProcess != null && this.ready;
  }

  /**
   * Converts a `DiscoveredPlugin` to a `PluginInfo`, mapping the internal
   * `BifrostStudioManifest` to the SDK-safe `PluginManifest` type.
   */
  private toPluginInfo(plugin: DiscoveredPlugin, overrides: Partial<PluginInfo>): PluginInfo {
    return {
      name: plugin.name,
      packageName: plugin.packageName,
      path: plugin.path,
      displayName: plugin.displayName,
      description: plugin.description,
      version: plugin.version,
      author: plugin.author,
      readmePath: plugin.readmePath,
      logoPath: plugin.logoPath,
      homepage: plugin.homepage,
      keywords: plugin.keywords,
      deprecated: plugin.deprecated,
      manifest: plugin.manifest as PluginInfo['manifest'],
      manifestErrors: plugin.manifestErrors,
      manifestWarnings: plugin.manifestWarnings,
      enabled: false,
      status: 'disabled',
      ...overrides,
    };
  }

  private disposeContributions(pluginName: string): void {
    const disposer = this.contributionDisposers.get(pluginName);
    if (disposer != null) {
      disposer.dispose();
      this.contributionDisposers.delete(pluginName);
    }
  }

  private disposeAllContributions(): void {
    for (const disposer of this.contributionDisposers.values()) {
      disposer.dispose();
    }
    this.contributionDisposers.clear();
  }

  private async handleUnexpectedExit(code: number | null, signal: string | null): Promise<void> {
    if (this.disposed) {
      return;
    }

    const now = Date.now();

    if (now - this.crashWindowStart > this.CRASH_WINDOW_MS) {
      this.crashCount = 0;
      this.crashWindowStart = now;
    }

    this.crashCount++;

    const errorMessage =
      `Plugin Host crashed (code=${code}, signal=${signal}). ` +
      `Crash ${this.crashCount}/${this.MAX_CRASHES} in the current window.`;

    console.error(`[PluginHost] ${errorMessage}`);
    this.bifrost.notifications.open({
      type: 'error',
      content: errorMessage,
      source: 'Plugin Host',
    });

    if (this.crashCount >= this.MAX_CRASHES) {
      console.error('[PluginHost] Too many crashes. Giving up.');
      this.bifrost.notifications.open({
        type: 'error',
        content: 'Plugin Host has crashed too many times. Plugins are disabled until restart.',
        source: 'Plugin Host',
      });
      return;
    }

    const backoffMs = Math.pow(2, this.crashCount - 1) * 1000;
    console.log(`[PluginHost] Restarting in ${backoffMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    this.bridge.dispose();
    this.connection?.rejectAll('Plugin Host crashed');
    this.childProcess = null;
    this.ready = false;
    this.connection = null;

    try {
      await this.start();
      const disabledPlugins = (this.bifrost.settings.get('plugins.disabledPlugins') as string[] | undefined) ?? [];
      await this.discoverAndLoadPlugins(disabledPlugins);
    } catch (err) {
      console.error('[PluginHost] Failed to restart:', err);
      this.bifrost.notifications.open({
        type: 'error',
        content: 'Plugin Host failed to restart. Plugins are disabled until restart.',
        source: 'Plugin Host',
      });
    }
  }
}
