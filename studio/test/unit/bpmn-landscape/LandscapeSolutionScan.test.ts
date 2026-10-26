import { LandscapeSolutionScan } from '#modules/bpmn-landscape/LandscapeSolutionScan';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scanCatalog, scanMaps } = vi.hoisted(() => ({ scanCatalog: vi.fn(), scanMaps: vi.fn() }));
vi.mock('#modules/bpmn-core/scanSolutionBpmnModels', () => ({ scanSolutionBpmnModels: scanCatalog }));
vi.mock('#modules/bpmn-landscape/scanSolutionLandscapeMaps', () => ({ scanSolutionLandscapeMaps: scanMaps }));

function createFakeBifrost(): { bifrost: any; fireSolutionChanged: () => void } {
  const handlers: (() => void)[] = [];
  const bifrost = {
    events: {
      on: (_name: string, handler: () => void) => {
        handlers.push(handler);
        return { dispose: () => undefined };
      },
    },
  };
  return { bifrost, fireSolutionChanged: () => handlers.forEach((handler) => handler()) };
}

const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('LandscapeSolutionScan', () => {
  beforeEach(() => {
    scanCatalog.mockReset().mockResolvedValue([]);
    scanMaps.mockReset().mockResolvedValue([]);
  });

  it('has no snapshot until the first scan finished, then scans once for every consumer', async () => {
    const { bifrost } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    const changes = vi.fn();
    scan.onDidChange(changes);
    expect(scan.getSnapshot()).toBeNull();

    scan.start();
    await flushPromises();

    expect(scan.getSnapshot()).toEqual({ catalog: [], maps: [], relations: [] });
    expect(scanCatalog).toHaveBeenCalledTimes(1);
    expect(scanMaps).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('scans again on every solution change', async () => {
    const { bifrost, fireSolutionChanged } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    scan.start();
    await flushPromises();

    scanMaps.mockResolvedValue([{ uri: 'file:///a.bfwmap', name: 'a', error: null, processReferences: [] }]);
    fireSolutionChanged();
    await flushPromises();

    expect(scan.getSnapshot()?.maps).toHaveLength(1);
    expect(scanCatalog).toHaveBeenCalledTimes(2);
  });

  it('does not notify when a scan finds what the previous one found', async () => {
    const { bifrost, fireSolutionChanged } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    scan.start();
    await flushPromises();
    const changes = vi.fn();
    scan.onDidChange(changes);

    fireSolutionChanged();
    await flushPromises();

    expect(scanCatalog).toHaveBeenCalledTimes(2);
    expect(changes).not.toHaveBeenCalled();
  });

  it('publishes only the newest of two overlapping scans', async () => {
    const { bifrost } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    let releaseFirstScan: (maps: unknown[]) => void = () => undefined;
    scanMaps.mockReturnValueOnce(new Promise((resolve) => void (releaseFirstScan = resolve)));
    const firstScan = scan.refresh();
    scanMaps.mockResolvedValueOnce([{ uri: 'file:///new.bfwmap', name: 'new', error: null, processReferences: [] }]);
    await scan.refresh();

    releaseFirstScan([{ uri: 'file:///old.bfwmap', name: 'old', error: null, processReferences: [] }]);
    await firstScan;

    expect(scan.getSnapshot()?.maps.map((map) => map.name)).toEqual(['new']);
  });

  it('keeps the previous snapshot when a scan fails', async () => {
    const { bifrost } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    await scan.refresh();
    const before = scan.getSnapshot();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    scanCatalog.mockRejectedValueOnce(new Error('disk gone'));
    const changes = vi.fn();
    scan.onDidChange(changes);

    await scan.refresh();

    expect(scan.getSnapshot()).toBe(before);
    expect(changes).not.toHaveBeenCalled();
  });

  it('stops notifying a consumer that disposed its subscription', async () => {
    const { bifrost } = createFakeBifrost();
    const scan = new LandscapeSolutionScan(bifrost);
    const changes = vi.fn();
    scan.onDidChange(changes).dispose();

    await scan.refresh();

    expect(changes).not.toHaveBeenCalled();
  });
});
