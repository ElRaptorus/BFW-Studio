import type { Bifrost } from '#bifrost/Bifrost';
import type EventBus from 'diagram-js/lib/core/EventBus';

import { pluginDmnContributionStore } from '../../PluginDmnContributionStore';

let studioReference: Bifrost | null = null;

function resolveIconClassName(icon: string): string {
  if (icon.startsWith('ph')) {
    return icon;
  }
  return `ph ph-${icon}`;
}

class PluginDmnPaletteProvider {
  static $inject = ['palette', 'eventBus'];

  private palette: any;

  constructor(palette: any, eventBus: EventBus) {
    this.palette = palette;
    palette.registerProvider(600, this);

    const subscription = pluginDmnContributionStore.onChange(() => {
      this.palette._update();
    });
    eventBus.on('diagram.destroy', () => subscription.dispose());
  }

  static setStudio(studio: Bifrost): void {
    studioReference = studio;
  }

  getPaletteEntries() {
    const entries: Record<string, any> = {};
    if (studioReference == null) {
      return entries;
    }

    for (const [pluginName, pluginEntries] of pluginDmnContributionStore.getAllPaletteEntries()) {
      for (const entry of pluginEntries) {
        const entryId = `plugin.${pluginName}.${entry.id}`;
        entries[entryId] = {
          group: entry.group ?? 'z-plugins',
          title: entry.title,
          className: resolveIconClassName(entry.icon),
          action: {
            click: () => {
              studioReference!.commands.executeCommand(`plugin.${pluginName}.${entry.command}`);
            },
          },
        };
      }
    }
    return entries;
  }
}

export default {
  __init__: ['pluginDmnPaletteProvider'],
  pluginDmnPaletteProvider: ['type', PluginDmnPaletteProvider],
};

export { PluginDmnPaletteProvider };
