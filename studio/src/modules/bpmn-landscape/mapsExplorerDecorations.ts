import type { Bifrost } from '#bifrost/Bifrost';
import type { TreeDecorationProvider, TreeItemDecoration } from '#bifrost/contracts/TreeTypes';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';

import { resolveProcessReference } from './resolveProcessReference';
import { scanSolutionLandscapeMaps } from './scanSolutionLandscapeMaps';

/**
 * Marks the maps of the Maps explorer that need attention: a number counts the processes a map shows that are
 * missing or defined in several files, `!` marks a map that cannot be read.
 */
export class MapsDecorationProvider implements TreeDecorationProvider {
  private decorations = new Map<string, TreeItemDecoration>();
  private listeners: ((uris: string[]) => void)[] = [];
  private latestScan = 0;

  provideDecoration(uri: string): TreeItemDecoration | null {
    return this.decorations.get(uri) ?? null;
  }

  onDidChange(listener: (uris: string[]) => void): { dispose(): void } {
    this.listeners.push(listener);
    return { dispose: () => void (this.listeners = this.listeners.filter((candidate) => candidate !== listener)) };
  }

  async refresh(bifrost: Bifrost): Promise<void> {
    const scanNumber = ++this.latestScan;
    const next = new Map<string, TreeItemDecoration>();
    try {
      const maps = await scanSolutionLandscapeMaps(bifrost);
      const catalog = maps.length === 0 ? [] : await scanSolutionBpmnModels(bifrost);
      for (const map of maps) {
        if (map.error != null) {
          next.set(map.uri, {
            styles: { badgeColor: 'red' },
            badges: [{ type: 'character', character: '!', tooltip: `This map cannot be read: ${map.error}` }],
          });
          continue;
        }
        const brokenCount = map.processReferences.filter(
          (reference) => resolveProcessReference(catalog, map.uri, reference).status !== 'resolved',
        ).length;
        if (brokenCount > 0) {
          const tooltip = `${brokenCount} ${brokenCount === 1 ? 'process on this map is' : 'processes on this map are'} not found in the solution or defined in several files.`;
          next.set(map.uri, {
            styles: { badgeColor: 'yellow' },
            badges: [{ type: 'number', number: brokenCount, tooltip }],
          });
        }
      }
    } catch (error) {
      console.warn('[MapsDecorationProvider] The scan failed; the badges stay as they are:', error);
      return;
    }
    // Scans overlap (every solution change); only the newest one counts.
    if (scanNumber !== this.latestScan) {
      return;
    }
    const changedUris = [...new Set([...this.decorations.keys(), ...next.keys()])].filter(
      (uri) => JSON.stringify(this.decorations.get(uri)) !== JSON.stringify(next.get(uri)),
    );
    this.decorations = next;
    if (changedUris.length > 0) {
      this.listeners.forEach((listener) => listener(changedUris));
    }
  }
}
