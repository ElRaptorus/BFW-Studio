import type { Bifrost } from '#bifrost/Bifrost';
import type { KeybindingsDefinition } from '#bifrost/browser/KeybindingsManager';
import type {
  BifrostStudioManifest,
  ManifestCommand,
  ManifestEditorDocumentType,
  ManifestKeybinding,
  ManifestPageContribution,
  ManifestPaneContribution,
  ManifestSetting,
  ManifestTheme,
} from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import type { BifrostOperatingSystem } from '#bifrost/contracts/BifrostTypes';
import type { PluginApiNamespace } from '#bifrost/contracts/PluginHostTypes';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

import { createPlaceholderEditorDocumentRenderer } from './PlaceholderEditorDocumentRenderer';
import { createPlaceholderPaneProvider } from './PlaceholderPaneProvider';

export interface ContributionDisposer {
  dispose(): void;
}

/** Default `order` of plugin pages, after the built-in ones. */
const PLUGIN_PAGE_DEFAULT_ORDER = 1000;

/**
 * Adds a plugin's page to an existing category. Throws with a message naming the plugin and the page when the
 * registry refuses it (unknown category, taken ID). The returned disposer removes the page again.
 */
export function registerPluginPage(
  bifrost: Bifrost,
  pluginName: string,
  page: ManifestPageContribution,
): ContributionDisposer {
  try {
    bifrost.categories.registerPage({
      id: page.id,
      categoryId: page.id.split('/')[0],
      label: page.label,
      icon: page.icon,
      order: page.order ?? PLUGIN_PAGE_DEFAULT_ORDER,
      defaultDocumentUri: page.defaultDocumentUri,
      editorTabsVisible: page.editorTabsVisible,
      paneAreas: page.paneAreas,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Plugin '${pluginName}': page '${page.id}' was not added: ${reason}`, { cause: error });
  }
  return { dispose: () => bifrost.categories.unregisterPage(page.id) };
}

/**
 * Renderer-side service that processes manifest contributions for a single plugin.
 * Called during discovery for each plugin with a valid manifest, before any plugin code runs.
 */
export class ContributionRegistrar {
  private bifrost: Bifrost;

  /** Stub command IDs → description. Cleared when the real callback replaces the stub. */
  readonly stubCommandIds = new Map<string, string>();

  /**
   * Namespaced document type ids currently backed by a manifest placeholder (from
   * `contributes.editorDocumentTypes`). Removed when the plugin's real
   * `registerWebviewDocumentType()` call replaces the placeholder — see `PluginHostBridge`.
   */
  readonly placeholderEditorDocumentTypeIds = new Set<string>();

  private getApiNamespaces: () => Iterable<PluginApiNamespace>;

  constructor(bifrost: Bifrost, getApiNamespaces: () => Iterable<PluginApiNamespace>) {
    this.bifrost = bifrost;
    this.getApiNamespaces = getApiNamespaces;
  }

  registerContributions(
    pluginName: string,
    manifest: BifrostStudioManifest,
    activatePlugin: () => Promise<void>,
    pluginPath?: string,
  ): ContributionDisposer {
    const disposers: (() => void)[] = [];
    const contributes = manifest.contributes;
    if (contributes == null) {
      return { dispose: () => {} };
    }

    // ── Commands (stub callbacks) ────────────────────────────
    if (contributes.commands != null) {
      for (const command of contributes.commands) {
        const disposer = this.registerStubCommand(pluginName, command, activatePlugin);
        disposers.push(disposer);
      }
    }

    // ── Icons ────────────────────────────────────────────────
    if (contributes.icons != null) {
      const disposer = this.registerIcons(pluginName, contributes.icons);
      disposers.push(disposer);
    }

    // ── Keybindings ──────────────────────────────────────────
    if (contributes.keybindings != null) {
      for (const keybinding of contributes.keybindings) {
        const disposer = this.registerKeybinding(pluginName, keybinding);
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Menus ────────────────────────────────────────────────
    if (contributes.menus != null) {
      for (const [menuId, items] of Object.entries(contributes.menus)) {
        const disposer = this.registerMenuContribution(pluginName, menuId, items, contributes.commands ?? []);
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Settings ─────────────────────────────────────────────
    if (contributes.settings != null) {
      const disposer = this.registerSettings(manifest.displayName ?? pluginName, contributes.settings);
      disposers.push(disposer);
    }

    // ── Panes (placeholder shells) ───────────────────────────
    if (contributes.panes != null) {
      for (const pane of contributes.panes) {
        const disposer = this.registerPanePlaceholder(pluginName, pane);
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Pages (added to existing categories) ──────────────────
    for (const page of contributes.pages ?? []) {
      try {
        disposers.push(registerPluginPage(this.bifrost, pluginName, page).dispose);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ContributionRegistrar] ${message}`);
        this.bifrost.notifications.open({ type: 'error', content: message, source: pluginName });
      }
    }

    // ── Editor Document Types (placeholder trampoline) ────────
    if (contributes.editorDocumentTypes != null) {
      for (const entry of contributes.editorDocumentTypes) {
        const disposer = this.registerEditorDocumentTypePlaceholder(
          pluginName,
          manifest.displayName ?? pluginName,
          entry,
          activatePlugin,
        );
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Service Task Types ───────────────────────────────────
    if (contributes.serviceTaskTypes != null) {
      for (const stType of contributes.serviceTaskTypes) {
        const disposer = this.registerServiceTaskType(stType);
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Themes ──────────────────────────────────────────────
    if (contributes.themes != null) {
      for (const theme of contributes.themes) {
        const disposer = this.registerTheme(pluginName, theme);
        if (disposer != null) {
          disposers.push(disposer);
        }
      }
    }

    // ── Module-provided namespaces (bpmn, dmn, …) ──────────
    for (const apiNamespace of this.getApiNamespaces()) {
      disposers.push(...apiNamespace.registerContributions(pluginName, pluginPath, manifest));
    }

    return {
      dispose: () => {
        for (const disposer of disposers) {
          try {
            disposer();
          } catch (err) {
            console.warn(`[ContributionRegistrar] Cleanup error for plugin '${pluginName}':`, err);
          }
        }
      },
    };
  }

  // ── Commands ───────────────────────────────────────────────

  private registerStubCommand(
    pluginName: string,
    command: ManifestCommand,
    activatePlugin: () => Promise<void>,
  ): () => void {
    const namespacedId = `plugin.${pluginName}.${command.id}`;
    const description = command.category ? `${command.category}: ${command.title}` : command.title;
    this.stubCommandIds.set(namespacedId, description);

    let activating = false;

    const stubCallback = async (...args: unknown[]) => {
      if (activating) {
        return undefined;
      }
      activating = true;
      try {
        await activatePlugin();
      } finally {
        activating = false;
      }

      if (this.stubCommandIds.has(namespacedId)) {
        console.warn(
          `[ContributionRegistrar] Plugin '${pluginName}' activated but command '${command.id}' was not registered.`,
        );
        this.bifrost.notifications.open({
          type: 'warning',
          content: `Plugin '${pluginName}' activated but command '${command.id}' was not registered.`,
          source: pluginName,
        });
        return undefined;
      }

      return this.bifrost.commands.executeCommand(namespacedId, args);
    };

    this.bifrost.commands.register(namespacedId, stubCallback, { visibleInSearch: true, description });

    return () => {
      this.stubCommandIds.delete(namespacedId);
      try {
        this.bifrost.commands.unregister(namespacedId);
      } catch {
        // Already unregistered (e.g. by the bridge replacing the stub)
      }
    };
  }

  // ── Icons ──────────────────────────────────────────────────

  private registerIcons(pluginName: string, icons: Record<string, string>): () => void {
    const namespacedIcons: Record<string, string> = {};
    for (const [id, value] of Object.entries(icons)) {
      const namespacedId = `plugin.${pluginName}/${id}`;
      namespacedIcons[namespacedId] = value;
    }
    this.bifrost.icons.registerIcons(namespacedIcons);

    // Icons have no unregister API yet (Phase 7 roadmap item).
    return () => {};
  }

  // ── Keybindings ────────────────────────────────────────────

  private registerKeybinding(pluginName: string, keybinding: ManifestKeybinding): (() => void) | null {
    const namespacedCommand = `plugin.${pluginName}.${keybinding.command}`;
    const focusSelector = this.mapWhenToSelector(keybinding.when);

    const allOsOverrides: { os: BifrostOperatingSystem; keystroke: string }[] = [];

    if (keybinding.mac != null) {
      allOsOverrides.push({ os: 'macos', keystroke: this.normalizeKeystroke(keybinding.mac) });
    }
    if (keybinding.linux != null) {
      allOsOverrides.push({ os: 'linux', keystroke: this.normalizeKeystroke(keybinding.linux) });
    }
    if (keybinding.windows != null) {
      allOsOverrides.push({ os: 'windows', keystroke: this.normalizeKeystroke(keybinding.windows) });
    }

    const defaultKeystroke = this.normalizeKeystroke(keybinding.key);
    const keymaps: KeybindingsDefinition[] = [];

    if (allOsOverrides.length === 0) {
      const keymap: KeybindingsDefinition = {
        client: '*',
        os: '*',
        bindings: { [focusSelector]: { [defaultKeystroke]: namespacedCommand } },
      };
      this.bifrost.keybindings.registerKeyBindings(keymap);
      keymaps.push(keymap);
    } else {
      const coveredOses = new Set(allOsOverrides.map((override) => override.os));
      const allOses: BifrostOperatingSystem[] = ['macos', 'linux', 'windows'];

      for (const osOverride of allOsOverrides) {
        const keymap: KeybindingsDefinition = {
          client: '*',
          os: osOverride.os,
          bindings: { [focusSelector]: { [osOverride.keystroke]: namespacedCommand } },
        };
        this.bifrost.keybindings.registerKeyBindings(keymap);
        keymaps.push(keymap);
      }

      for (const os of allOses) {
        if (!coveredOses.has(os)) {
          const keymap: KeybindingsDefinition = {
            client: '*',
            os,
            bindings: { [focusSelector]: { [defaultKeystroke]: namespacedCommand } },
          };
          this.bifrost.keybindings.registerKeyBindings(keymap);
          keymaps.push(keymap);
        }
      }
    }

    return () => {
      for (const keymap of keymaps) {
        this.bifrost.keybindings.unregisterKeyBindings(keymap);
      }
    };
  }

  private normalizeKeystroke(keystroke: string): string {
    return keystroke.replace(/\+/g, '-').toLowerCase();
  }

  private mapWhenToSelector(when?: string): string {
    if (when == null || when === '*') {
      return 'body';
    }
    if (when === 'editorFocused') {
      return '.kbm-editor';
    }
    if (when.startsWith('editorFocused:')) {
      const documentType = when.slice('editorFocused:'.length);
      return `.kbm-editor[data-editor-document-type="${documentType}"]`;
    }
    return 'body';
  }

  // ── Menus ──────────────────────────────────────────────────

  private registerMenuContribution(
    pluginName: string,
    menuId: string,
    items: { command: string; group?: string; when?: string }[],
    commands: ManifestCommand[],
  ): (() => void) | null {
    if (!this.bifrost.menus.isMenuRegistered(menuId)) {
      console.warn(
        `[ContributionRegistrar] Menu '${menuId}' is not registered. Skipping contribution from plugin '${pluginName}'.`,
      );
      return null;
    }

    const commandLookup = new Map(commands.map((cmd) => [cmd.id, cmd]));

    const disposer = this.bifrost.menus.registerMenuModifier(menuId, (menu) => {
      for (const item of items) {
        const namespacedCommand = `plugin.${pluginName}.${item.command}`;
        const commandDef = commandLookup.get(item.command);
        const label = commandDef?.title ?? item.command;
        const icon = commandDef?.icon;

        menu.push({
          type: 'command',
          id: namespacedCommand,
          label,
          icon,
          command: namespacedCommand,
        } as any);
      }
      return menu;
    });

    return disposer?.dispose ?? null;
  }

  // ── Settings ───────────────────────────────────────────────

  private registerSettings(categoryFallback: string, settings: ManifestSetting[]): () => void {
    const descriptors: Record<string, SettingDescriptor> = {};
    const keys: string[] = [];

    for (const setting of settings) {
      const key = setting.key;
      keys.push(key);

      const descriptor: SettingDescriptor = {
        type: this.mapSettingType(setting.type),
        default: setting.default,
        label: setting.key,
        description: setting.description,
        category: setting.category ?? categoryFallback,
      } as SettingDescriptor;

      descriptors[key] = descriptor;
    }

    // Plugin setting reads are not scope-aware.
    this.bifrost.settings.register(stripSettingScope(descriptors));

    return () => {
      this.bifrost.settings.unregisterSettings(keys);
    };
  }

  private mapSettingType(type: string): string {
    switch (type) {
      case 'boolean':
        return 'boolean';
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'string[]':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }

  // ── Panes (placeholder) ────────────────────────────────────

  private registerPanePlaceholder(pluginName: string, pane: ManifestPaneContribution): (() => void) | null {
    const paneId = `plugin.${pluginName}.${pane.id}`;

    if (this.bifrost.panes.alreadyRegistered(paneId)) {
      return null;
    }

    const placeholderModule = createPlaceholderPaneProvider({ pluginName, pane });
    const paneObject = this.bifrost.panes.getPaneViaPaneProvider(
      paneId,
      `plugin/${pluginName}/panes/${pane.id}`,
      placeholderModule,
    );

    const groupId = pane.groupId ?? `plugin-${pluginName}`;

    try {
      this.bifrost.panes.registerPaneGroup(pane.area, groupId, [paneObject], {
        label: pane.title,
        icon: pane.icon,
        pages: pane.pages,
      });
    } catch {
      try {
        this.bifrost.panes.appendToPaneGroup(pane.area, groupId, [paneObject]);
      } catch {
        return null;
      }
    }

    return () => {
      try {
        this.bifrost.panes.unregisterPane(paneId);
      } catch {
        /* already unregistered */
      }
      try {
        this.bifrost.panes.unregisterPaneProvider(`plugin/${pluginName}/panes/${pane.id}`);
      } catch {
        /* already unregistered */
      }
    };
  }

  // ── Editor Document Types (placeholder trampoline) ─────────

  private registerEditorDocumentTypePlaceholder(
    pluginName: string,
    pluginDisplayName: string,
    entry: ManifestEditorDocumentType,
    activatePlugin: () => Promise<void>,
  ): (() => void) | null {
    const documentTypeId = `plugin.${pluginName}.${entry.id}`;
    const includedFilePatterns = entry.includedFilePatterns ?? [];

    let uriRegex: RegExp;
    try {
      uriRegex = new RegExp(entry.uriPattern);
    } catch (err) {
      console.warn(
        `[ContributionRegistrar] Plugin '${pluginName}' contributes.editorDocumentTypes['${entry.id}'] has an invalid uriPattern:`,
        err,
      );
      return null;
    }

    if (includedFilePatterns.length > 0) {
      this.bifrost.solution.registerDefaultIncludedFiles(includedFilePatterns);
    }

    const rendererKey = `plugin-editor-placeholder-${documentTypeId}`;
    const rendererConstructor = createPlaceholderEditorDocumentRenderer({
      pluginName,
      pluginDisplayName,
      activatePlugin,
      isStillPlaceholder: () => this.placeholderEditorDocumentTypeIds.has(documentTypeId),
    });

    try {
      this.bifrost.editors.registerDocumentType(documentTypeId, {
        page: entry.page,
        uriMatch: uriRegex,
        icon: entry.icon,
        rendererKey,
        rendererConstructor,
        modelKey: null,
      });
    } catch (err) {
      console.warn(
        `[ContributionRegistrar] Failed to register editor document type placeholder '${documentTypeId}':`,
        err,
      );
      if (includedFilePatterns.length > 0) {
        this.bifrost.solution.unregisterDefaultIncludedFiles(includedFilePatterns);
      }
      return null;
    }

    this.placeholderEditorDocumentTypeIds.add(documentTypeId);

    return () => {
      if (includedFilePatterns.length > 0) {
        this.bifrost.solution.unregisterDefaultIncludedFiles(includedFilePatterns);
      }

      if (!this.placeholderEditorDocumentTypeIds.has(documentTypeId)) {
        // Already replaced by the plugin's real registerWebviewDocumentType() call —
        // that registration's own lifecycle (in PluginHostBridge) now owns the document type.
        return;
      }

      this.placeholderEditorDocumentTypeIds.delete(documentTypeId);
      try {
        this.bifrost.editors.unregisterDocumentType(documentTypeId).catch((err) => {
          console.warn(`[ContributionRegistrar] Failed to unregister placeholder '${documentTypeId}':`, err);
        });
      } catch (err) {
        console.warn(`[ContributionRegistrar] Failed to unregister placeholder '${documentTypeId}':`, err);
      }
    };
  }

  // ── Themes ─────────────────────────────────────────────────

  private registerTheme(pluginName: string, theme: ManifestTheme): (() => void) | null {
    const themeId = `plugin.${pluginName}.${theme.id}`;

    try {
      this.bifrost.theme.registerTheme({
        id: themeId,
        label: theme.label,
        type: theme.type,
      });
    } catch (err) {
      console.warn(`[ContributionRegistrar] Failed to register theme '${themeId}':`, err);
      return null;
    }

    const cssRules: string[] = [];
    for (const [key, value] of Object.entries(theme.tokens)) {
      const cssProperty = key.startsWith('--') ? key : `--${key}`;
      cssRules.push(`  ${cssProperty}: ${value};`);
    }

    const escapedThemeId = themeId.replace(/\./g, '\\.');
    const css = `.bifrost.bifrost-theme--${escapedThemeId} {\n${cssRules.join('\n')}\n}`;
    const styleEl = document.createElement('style');
    styleEl.dataset.pluginTheme = themeId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    return () => {
      const currentTheme = this.bifrost.theme.getCurrentTheme();

      styleEl.remove();

      const themeDef = this.bifrost.theme.getTheme(themeId);
      try {
        this.bifrost.theme.unregisterTheme(themeId);
      } catch {
        /* already unregistered */
      }

      if (currentTheme === themeId) {
        const fallback = themeDef?.type === 'light' ? 'light' : 'dark';
        this.bifrost.theme.setTheme(fallback);
      }
    };
  }

  // ── Service Task Types ─────────────────────────────────────

  private registerServiceTaskType(stType: { implementation: string; label: string }): (() => void) | null {
    try {
      this.bifrost.commands.executeCommand('bpmn.serviceTasks.registerCustomType', [
        { type: stType.implementation, label: stType.label },
      ]);
    } catch {
      console.warn(
        `[ContributionRegistrar] Failed to register service task type '${stType.implementation}'. The BPMN editor module may not be loaded yet.`,
      );
      return null;
    }

    return () => {
      try {
        this.bifrost.commands.executeCommand('bpmn.serviceTasks.removeCustomType', [stType.implementation]);
      } catch {
        /* already removed */
      }
    };
  }
}

function stripSettingScope(descriptors: Record<string, SettingDescriptor>): Record<string, SettingDescriptor> {
  const sanitized: Record<string, SettingDescriptor> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    const copy = { ...descriptor };
    delete (copy as { scope?: unknown }).scope;
    sanitized[key] = copy;
  }
  return sanitized;
}
