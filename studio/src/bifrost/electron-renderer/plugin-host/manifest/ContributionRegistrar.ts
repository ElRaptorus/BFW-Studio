import type { Bifrost } from '#bifrost/Bifrost';
import type { KeybindingsDefinition } from '#bifrost/browser/KeybindingsManager';
import { insertAfterMenuBarItem, insertBeforeMenuBarItem } from '#bifrost/common/MenuBarModifierFunctions';
import type {
  BifrostStudioManifest,
  ManifestCommand,
  ManifestKeybinding,
  ManifestPaneContribution,
  ManifestPaneToggle,
  ManifestSetting,
  ManifestTheme,
} from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import type { BifrostOperatingSystem } from '#bifrost/contracts/BifrostTypes';

import type { SettingDescriptor } from '@evil/bifrost_fw_sdk';

import { pluginBpmnContributionStore } from '../../../../modules/bpmn-core/PluginBpmnContributionStore';
import { pluginModuleLoader } from '../../../../modules/bpmn-core/plugin-modules/PluginModuleLoader';
import { createPlaceholderPaneProvider } from './PlaceholderPaneProvider';

export interface ContributionDisposer {
  dispose(): void;
}

/**
 * Renderer-side service that processes manifest contributions for a single plugin.
 * Called during discovery for each plugin with a valid manifest, before any plugin code runs.
 */
export class ContributionRegistrar {
  private bifrost: Bifrost;

  /** Stub command IDs → description. Cleared when the real callback replaces the stub. */
  readonly stubCommandIds = new Map<string, string>();

  constructor(bifrost: Bifrost) {
    this.bifrost = bifrost;
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

    // ── Pane Toggles (menu bar) ───────────────────────────────
    if (contributes.paneToggles != null) {
      for (const toggle of contributes.paneToggles) {
        const disposer = this.registerPaneToggle(pluginName, toggle);
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

    // ── BPMN Palette ─────────────────────────────────────────
    if (contributes.bpmnPalette != null && contributes.bpmnPalette.length > 0) {
      const hasBpmnModelling =
        manifest.permissions?.includes('bpmn.modelling') === true ||
        manifest.permissions?.includes('bpmn.renderer') === true;
      if (hasBpmnModelling) {
        pluginBpmnContributionStore.setPaletteEntries(pluginName, contributes.bpmnPalette);
        disposers.push(() => pluginBpmnContributionStore.removePaletteEntries(pluginName));
      }
    }

    // ── BPMN Context Pad ─────────────────────────────────────
    if (contributes.bpmnContextPad != null && contributes.bpmnContextPad.length > 0) {
      const hasBpmnModelling =
        manifest.permissions?.includes('bpmn.modelling') === true ||
        manifest.permissions?.includes('bpmn.renderer') === true;
      if (hasBpmnModelling) {
        pluginBpmnContributionStore.setContextPadEntries(pluginName, contributes.bpmnContextPad);
        disposers.push(() => pluginBpmnContributionStore.removeContextPadEntries(pluginName));
      }
    }

    // ── BPMN Renderer Modules ─────────────────────────────────
    if (contributes.bpmnModules != null && contributes.bpmnModules.length > 0 && pluginPath != null) {
      const hasBpmnRenderer = manifest.permissions?.includes('bpmn.renderer') === true;
      if (hasBpmnRenderer) {
        const result = pluginModuleLoader.loadPluginModules(pluginName, pluginPath, contributes.bpmnModules);
        if (result.success) {
          disposers.push(() => {
            pluginModuleLoader.unloadPluginModules(pluginName);
            this.forceReopenBpmnEditors(pluginName);
          });
        } else {
          console.error(`[ContributionRegistrar] Plugin '${pluginName}' renderer module load failed: ${result.error}`);
          this.bifrost.notifications.open({
            type: 'error',
            content: `Plugin '${pluginName}' failed to load renderer modules: ${result.error}`,
            source: pluginName,
          });
        }
      }
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

    this.bifrost.settings.register(descriptors);

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

  // ── Pane Toggles (menu bar) ────────────────────────────────

  private registerPaneToggle(pluginName: string, toggle: ManifestPaneToggle): (() => void) | null {
    const paneId = toggle.paneId.startsWith('plugin.') ? toggle.paneId : `plugin.${pluginName}.${toggle.paneId}`;
    const toggleId = toggle.id.startsWith('plugin.') ? toggle.id : `plugin.${pluginName}.${toggle.id}`;

    const items = [
      {
        type: 'pane_content_toggle' as const,
        id: toggleId,
        icon: toggle.icon,
        tooltip: toggle.tooltip,
        paneAreaId: toggle.paneAreaId,
        paneId,
      },
    ];

    let disposer: { dispose: () => void };

    if (toggle.insertAfter != null) {
      disposer = this.bifrost.menuBar.registerMenuBarItemModifier((menuBarItemMap) => {
        return insertAfterMenuBarItem(menuBarItemMap, toggle.insertAfter!, () => items);
      });
    } else if (toggle.insertBefore != null) {
      disposer = this.bifrost.menuBar.registerMenuBarItemModifier((menuBarItemMap) => {
        return insertBeforeMenuBarItem(menuBarItemMap, toggle.insertBefore!, () => items);
      });
    } else {
      disposer = this.bifrost.menuBar.registerMenuBarItem('left', () => items);
    }

    this.bifrost.menuBar.updateMenuBarItems();

    return () => {
      disposer.dispose();
      this.bifrost.menuBar.updateMenuBarItems();
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

  // ── BPMN Editor Force-Reopen ─────────────────────────────────

  private forceReopenBpmnEditors(pluginName: string): void {
    const openDocs = this.bifrost.editors.getOpenEditorDocuments();
    const bpmnDocs = openDocs.filter((doc) => doc.documentType === 'bpmn');
    if (bpmnDocs.length === 0) {
      return;
    }

    const uris = bpmnDocs.map((doc) => doc.uri);

    void (async () => {
      for (const doc of bpmnDocs) {
        await this.bifrost.editors.closeEditorDocument(doc, false, true);
      }
      for (const uri of uris) {
        this.bifrost.editors.focusOrOpenEditorDocument(uri);
      }

      this.bifrost.notifications.open({
        type: 'info',
        content: `Plugin '${pluginName}' disabled. BPMN editors have been reloaded.`,
        source: 'Plugins',
      });
    })();
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
