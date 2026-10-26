import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type { ProcessRelation } from './buildProcessRelations';
import { buildProcessRelations } from './buildProcessRelations';
import type { LandscapeMapEntry } from './scanSolutionLandscapeMaps';
import { scanSolutionLandscapeMaps } from './scanSolutionLandscapeMaps';

/** Name of the shared resource that holds the scan; the Maps explorer, the Processes pane and open maps read it. */
export const LANDSCAPE_SOLUTION_SCAN_KEY = 'bpmn-landscape/solution-scan';

export type LandscapeSolutionSnapshot = {
  catalog: SolutionBpmnModelEntry[];
  maps: LandscapeMapEntry[];
  relations: ProcessRelation[];
};

/**
 * The one scan of the BPMN catalog and the landscape maps per solution change, shared by every landscape consumer.
 * Only saved files count. A failed scan keeps the previous snapshot.
 *
 * ponytail: every change parses all maps on the main thread; cache the parse by text hash like the BPMN scan once a
 * solution holds hundreds of maps.
 */
export class LandscapeSolutionScan {
  private snapshot: LandscapeSolutionSnapshot | null = null;
  private listeners: (() => void)[] = [];
  private latestScan = 0;

  constructor(private readonly bifrost: Bifrost) {}

  /** Scans now and again on every solution change. */
  start(): void {
    this.bifrost.events.on('solutionChanged', () => void this.refresh());
    void this.refresh();
  }

  /** `null` until the first scan has finished. */
  getSnapshot(): LandscapeSolutionSnapshot | null {
    return this.snapshot;
  }

  onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.push(listener);
    return { dispose: () => void (this.listeners = this.listeners.filter((candidate) => candidate !== listener)) };
  }

  async refresh(): Promise<void> {
    // Scans overlap (every solution change); only the newest one counts.
    const scanNumber = ++this.latestScan;
    let catalog: SolutionBpmnModelEntry[];
    let maps: LandscapeMapEntry[];
    try {
      [catalog, maps] = await Promise.all([
        scanSolutionBpmnModels(this.bifrost),
        scanSolutionLandscapeMaps(this.bifrost),
      ]);
    } catch (error) {
      console.warn('[LandscapeSolutionScan] The solution scan failed; the previous result stays:', error);
      return;
    }
    if (scanNumber !== this.latestScan) {
      return;
    }
    const snapshot = { catalog, maps, relations: buildProcessRelations(catalog) };
    // Most solution changes touch no BPMN file or map; consumers re-render, and an open text field would lose its input.
    if (this.snapshot != null && JSON.stringify(snapshot) === JSON.stringify(this.snapshot)) {
      return;
    }
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
