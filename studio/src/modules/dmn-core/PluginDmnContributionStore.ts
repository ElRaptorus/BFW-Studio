import type {
  ManifestDmnContextPadEntry,
  ManifestDmnPaletteEntry,
} from '#bifrost/common/plugin-host/manifest/ManifestTypes';

export interface ResolvedDmnContextPadEntry {
  icon: string;
  title: string;
  command: string;
  elementTypes?: string[];
  elementIds?: Set<string>;
}

type ChangeListener = () => void;

/**
 * Singleton store for plugin-contributed DMN (DRD-only) palette and context
 * pad entries.
 *
 * Written by ContributionRegistrar (manifest entries) and DmnApiBridge (runtime entries).
 * Read by PluginDmnPaletteProvider and PluginDmnContextPadProvider (diagram-js modules).
 */
class PluginDmnContributionStore {
  private paletteEntries = new Map<string, ManifestDmnPaletteEntry[]>();
  private contextPadEntries = new Map<string, Map<string, ResolvedDmnContextPadEntry>>();
  private listeners: ChangeListener[] = [];

  setPaletteEntries(pluginName: string, entries: ManifestDmnPaletteEntry[]): void {
    this.paletteEntries.set(pluginName, entries);
    this.notifyChange();
  }

  removePaletteEntries(pluginName: string): void {
    if (this.paletteEntries.delete(pluginName)) {
      this.notifyChange();
    }
  }

  getAllPaletteEntries(): Map<string, ManifestDmnPaletteEntry[]> {
    return this.paletteEntries;
  }

  setContextPadEntries(pluginName: string, entries: ManifestDmnContextPadEntry[]): void {
    const resolved = new Map<string, ResolvedDmnContextPadEntry>();
    for (const entry of entries) {
      resolved.set(entry.id, {
        icon: entry.icon,
        title: entry.title,
        command: entry.command,
        elementTypes: entry.elementTypes,
      });
    }
    this.contextPadEntries.set(pluginName, resolved);
    this.notifyChange();
  }

  removeContextPadEntries(pluginName: string): void {
    if (this.contextPadEntries.delete(pluginName)) {
      this.notifyChange();
    }
  }

  getAllContextPadEntries(): Map<string, Map<string, ResolvedDmnContextPadEntry>> {
    return this.contextPadEntries;
  }

  addContextPadEntry(
    pluginName: string,
    entry: { id: string; icon: string; title: string; command: string; elementTypes?: string[]; elementIds?: string[] },
  ): void {
    let pluginMap = this.contextPadEntries.get(pluginName);
    if (pluginMap == null) {
      pluginMap = new Map();
      this.contextPadEntries.set(pluginName, pluginMap);
    }
    pluginMap.set(entry.id, {
      icon: entry.icon,
      title: entry.title,
      command: entry.command,
      elementTypes: entry.elementTypes,
      elementIds: entry.elementIds != null ? new Set(entry.elementIds) : undefined,
    });
    this.notifyChange();
  }

  removeContextPadEntry(pluginName: string, entryId: string): boolean {
    const pluginMap = this.contextPadEntries.get(pluginName);
    if (pluginMap == null) {
      return false;
    }
    const deleted = pluginMap.delete(entryId);
    if (deleted) {
      this.notifyChange();
    }
    return deleted;
  }

  updateContextPadEntry(pluginName: string, entryId: string, update: { elementIds?: string[] | null }): boolean {
    const pluginMap = this.contextPadEntries.get(pluginName);
    if (pluginMap == null) {
      return false;
    }
    const entry = pluginMap.get(entryId);
    if (entry == null) {
      return false;
    }

    if (update.elementIds === null) {
      entry.elementIds = undefined;
    } else if (update.elementIds != null) {
      entry.elementIds = new Set(update.elementIds);
    }
    this.notifyChange();
    return true;
  }

  addPaletteEntry(pluginName: string, entry: ManifestDmnPaletteEntry): void {
    let entries = this.paletteEntries.get(pluginName);
    if (entries == null) {
      entries = [];
      this.paletteEntries.set(pluginName, entries);
    }
    entries.push(entry);
    this.notifyChange();
  }

  removePaletteEntry(pluginName: string, entryId: string): boolean {
    const entries = this.paletteEntries.get(pluginName);
    if (entries == null) {
      return false;
    }
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return false;
    }
    entries.splice(index, 1);
    this.notifyChange();
    return true;
  }

  onChange(callback: ChangeListener): { dispose: () => void } {
    this.listeners.push(callback);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(callback);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  private notifyChange(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.warn('[PluginDmnContributionStore] Change listener error:', error);
      }
    }
  }
}

export const pluginDmnContributionStore = new PluginDmnContributionStore();
