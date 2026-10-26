import type EventBus from 'diagram-js/lib/core/EventBus';

import { landscapeContributionStore } from '../plugin-api/landscapePluginModules';
import type { LandscapeRendererConfig } from './LandscapeRenderer';

/** Plugin entries come after the built-in ones of the palette and the context pad, which have priority 1000. */
const PLUGIN_ENTRY_PRIORITY = 600;

const iconClassNameOf = (icon: string): string => (icon.startsWith('ph') ? icon : `ph ph-${icon}`);

/** Shows the palette entries that plugins contribute, in a group of their own after the built-in groups. */
export class LandscapePluginPaletteProvider {
  static $inject = ['palette', 'config.landscape', 'eventBus'];

  constructor(
    private readonly palette: any,
    private readonly config: LandscapeRendererConfig,
    eventBus: EventBus,
  ) {
    palette.registerProvider(PLUGIN_ENTRY_PRIORITY, this);
    const subscription = landscapeContributionStore.onChange(() => palette._update());
    eventBus.on('diagram.destroy', () => subscription.dispose());
  }

  getPaletteEntries(): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    for (const [pluginName, pluginEntries] of landscapeContributionStore.getAllPaletteEntries()) {
      for (const entry of pluginEntries) {
        entries[`plugin.${pluginName}.${entry.id}`] = {
          group: entry.group ?? 'z-plugins',
          title: entry.title,
          className: iconClassNameOf(entry.icon),
          action: { click: () => this.config.executePluginCommand(pluginName, entry.command, []) },
        };
      }
    }
    return entries;
  }
}

/**
 * Shows the context pad entries that plugins contribute. An entry can be limited to element types and, later,
 * to a list of element ids.
 */
export class LandscapePluginContextPadProvider {
  static $inject = ['contextPad', 'config.landscape', 'eventBus'];

  private isReopenScheduled = false;

  constructor(
    private readonly contextPad: any,
    private readonly config: LandscapeRendererConfig,
    eventBus: EventBus,
  ) {
    contextPad.registerProvider(PLUGIN_ENTRY_PRIORITY, this);
    const subscription = landscapeContributionStore.onChange(() => this.reopenCurrentPad());
    eventBus.on('diagram.destroy', () => subscription.dispose());
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    for (const [pluginName, pluginEntries] of landscapeContributionStore.getAllContextPadEntries()) {
      for (const [entryId, entry] of pluginEntries) {
        if (entry.elementTypes != null && !entry.elementTypes.includes(element.type)) {
          continue;
        }
        if (entry.elementIds != null && !entry.elementIds.has(element.id)) {
          continue;
        }
        entries[`plugin.${pluginName}.${entryId}`] = {
          group: 'z-plugins',
          title: entry.title,
          className: iconClassNameOf(entry.icon),
          action: {
            click: (_event: unknown, target: any) =>
              this.config.executePluginCommand(pluginName, entry.command, [
                { elementId: target.id, elementType: target.type },
              ]),
          },
        };
      }
    }
    return entries;
  }

  /** An entry that was added or limited while the pad is open shows up without a new click on the element. */
  private reopenCurrentPad(): void {
    if (this.isReopenScheduled) {
      return;
    }
    this.isReopenScheduled = true;
    queueMicrotask(() => {
      this.isReopenScheduled = false;
      const target = this.contextPad._current?.target;
      if (target != null) {
        this.contextPad.close();
        this.contextPad.open(target);
      }
    });
  }
}
