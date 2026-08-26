import type { Bifrost } from '#bifrost/Bifrost';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import { pluginDmnContributionStore } from '../../PluginDmnContributionStore';

let studioReference: Bifrost | null = null;

function resolveIconClassName(icon: string): string {
  if (icon.startsWith('ph')) {
    return icon;
  }
  return `ph ph-${icon}`;
}

class PluginDmnContextPadProvider {
  static $inject = ['contextPad'];

  private contextPad: any;
  private changeDisposer: { dispose: () => void } | null = null;
  private reopenScheduled = false;

  constructor(contextPad: any) {
    this.contextPad = contextPad;
    contextPad.registerProvider(600, this);

    this.changeDisposer = pluginDmnContributionStore.onChange(() => {
      if (this.reopenScheduled) {
        return;
      }
      this.reopenScheduled = true;
      queueMicrotask(() => {
        this.reopenScheduled = false;
        const current = this.contextPad._current;
        if (current != null) {
          const target = current.target;
          this.contextPad.close();
          this.contextPad.open(target);
        }
      });
    });
  }

  static setStudio(studio: Bifrost): void {
    studioReference = studio;
  }

  getContextPadEntries(element: ElementLike) {
    const entries: Record<string, any> = {};
    if (studioReference == null) {
      return entries;
    }

    for (const [pluginName, pluginEntries] of pluginDmnContributionStore.getAllContextPadEntries()) {
      for (const [entryId, entry] of pluginEntries) {
        if (entry.elementTypes != null && !entry.elementTypes.includes(element.type)) {
          continue;
        }
        if (entry.elementIds != null && !entry.elementIds.has(element.id)) {
          continue;
        }

        const qualifiedId = `plugin.${pluginName}.${entryId}`;
        entries[qualifiedId] = {
          group: 'z-plugins',
          title: entry.title,
          className: resolveIconClassName(entry.icon),
          action: {
            click: (_event: any, targetElement: ElementLike) => {
              studioReference!.commands.executeCommand(`plugin.${pluginName}.${entry.command}`, [
                { elementId: targetElement.id, elementType: targetElement.type },
              ]);
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
  __init__: ['pluginDmnContextPadProvider'],
  pluginDmnContextPadProvider: ['type', PluginDmnContextPadProvider],
};

export { PluginDmnContextPadProvider };
