import type { ElementLike } from 'diagram-js/lib/model/Types';

import type { Studio } from '@evil/bifrost_fw_sdk';

import { pluginBpmnContributionStore } from '../../PluginBpmnContributionStore';

let studioReference: Studio | null = null;

function resolveIconClassName(icon: string): string {
  if (icon.startsWith('ph')) {
    return icon;
  }
  return `ph ph-${icon}`;
}

class PluginContextPadProvider {
  static $inject = ['contextPad'];

  private contextPad: any;
  private changeDisposer: { dispose: () => void } | null = null;
  private reopenScheduled = false;

  constructor(contextPad: any) {
    this.contextPad = contextPad;
    contextPad.registerProvider(600, this);

    this.changeDisposer = pluginBpmnContributionStore.onChange(() => {
      if (this.reopenScheduled) {
        return;
      }
      this.reopenScheduled = true;
      queueMicrotask(() => {
        this.reopenScheduled = false;
        const current = this.contextPad._current;
        if (current != null) {
          this.contextPad.open(current.element);
        }
      });
    });
  }

  static setStudio(studio: Studio): void {
    studioReference = studio;
  }

  getContextPadEntries(element: ElementLike) {
    const entries: Record<string, any> = {};
    if (studioReference == null) {
      return entries;
    }

    for (const [pluginName, pluginEntries] of pluginBpmnContributionStore.getAllContextPadEntries()) {
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
  __init__: ['pluginContextPadProvider'],
  pluginContextPadProvider: ['type', PluginContextPadProvider],
};

export { PluginContextPadProvider };
