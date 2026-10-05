import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DmnSimulatorSession } from '../../../src/modules/dmn-decision-simulator/DmnSimulatorSession';
import { DmnSimulatorTableHighlighter } from '../../../src/modules/dmn-decision-simulator/DmnSimulatorTableHighlighter';

class FakeRow {
  readonly classes = new Set<string>();
  readonly dataset: { rowId: string };
  readonly classList = {
    toggle: (name: string, force: boolean) => (force ? this.classes.add(name) : this.classes.delete(name)),
  };
  constructor(rowId: string) {
    this.dataset = { rowId };
  }
}

class FakeLegend {
  className = '';
  textContent = '';
  constructor(private readonly onRemove: () => void) {}
  remove(): void {
    this.onRemove();
  }
}

function createFixture() {
  const rows = [new FakeRow('r1'), new FakeRow('r2')];
  let legend: FakeLegend | null = null;
  const container = {
    querySelectorAll: () => rows,
    querySelector: () => legend,
    appendChild: (child: FakeLegend) => {
      legend = child;
    },
  };
  vi.stubGlobal('document', {
    createElement: () =>
      new FakeLegend(() => {
        legend = null;
      }),
  });
  const adapter = {
    on: () => ({ dispose: () => undefined }),
    getActiveViewType: () => 'decisionTable',
    getActiveView: () => ({ element: { id: 'dec' } }),
    getActiveViewer: () => ({ _container: container }),
  };
  return { rows, session: new DmnSimulatorSession(), adapter, hasLegend: () => legend != null };
}

function outcomeWithRules() {
  return {
    ok: true as const,
    kind: 'decision' as const,
    result: {} as never,
    steps: [
      {
        elementId: 'dec',
        elementName: 'Dec',
        namespace: null,
        type: 'decision' as const,
        rules: [
          { ruleId: 'r1', matched: true },
          { ruleId: 'r2', matched: false },
        ],
      },
    ],
  };
}

vi.mock('#modules/dmn-core/DmnModelerComponentAdapter', () => ({ EVENT_DMN_ADAPTER_VIEW_CHANGED: 'view' }));

describe('DmnSimulatorTableHighlighter', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('marks matched and unmatched rows, shows the legend, and clears both on reset', () => {
    const { rows, session, adapter, hasLegend } = createFixture();
    const highlighter = new DmnSimulatorTableHighlighter(adapter as never, session);

    session.update({ outcome: outcomeWithRules() });

    expect([...rows[0].classes]).toEqual(['dmn-sim-rule-matched']);
    expect([...rows[1].classes]).toEqual(['dmn-sim-rule-unmatched']);
    expect(hasLegend()).toBe(true);

    session.reset();
    expect(rows.every((row) => row.classes.size === 0)).toBe(true);
    expect(hasLegend()).toBe(false);
    highlighter.dispose();
  });

  it('highlights nothing while the result is stale', () => {
    const { rows, session, adapter, hasLegend } = createFixture();
    const highlighter = new DmnSimulatorTableHighlighter(adapter as never, session);
    session.update({ outcome: outcomeWithRules() });

    session.update({ stale: true });

    expect(rows.every((row) => row.classes.size === 0)).toBe(true);
    expect(hasLegend()).toBe(false);
    highlighter.dispose();
  });
});
