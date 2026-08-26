import type { Bifrost } from '#bifrost/Bifrost';

import { pluginBpmnContributionStore } from '../../PluginBpmnContributionStore';

let studioReference: Bifrost | null = null;

function resolveIconClassName(icon: string): string {
  if (icon.startsWith('ph')) {
    return icon;
  }
  return `ph ph-${icon}`;
}

class PluginPaletteProvider {
  static $inject = ['palette'];

  private palette: any;
  private changeDisposer: { dispose: () => void } | null = null;

  constructor(palette: any) {
    this.palette = palette;
    palette.registerProvider(600, this);

    this.changeDisposer = pluginBpmnContributionStore.onChange(() => {
      this.palette._update();
    });
  }

  static setStudio(studio: Bifrost): void {
    studioReference = studio;
  }

  getPaletteEntries() {
    const entries: Record<string, any> = {};
    if (studioReference == null) {
      return entries;
    }

    for (const [pluginName, pluginEntries] of pluginBpmnContributionStore.getAllPaletteEntries()) {
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

  destroy(): void {
    this.changeDisposer?.dispose();
  }
}

export default {
  __init__: ['pluginPaletteProvider'],
  pluginPaletteProvider: ['type', PluginPaletteProvider],
};

export { PluginPaletteProvider };
