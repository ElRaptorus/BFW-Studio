import {
  ENGINE_HEADER_DEPLOY_PAGES,
  ENGINE_HEADER_PAGES,
  addEngineHeaderItems,
  buildEngineHeaderItems,
} from '#modules/engine-workspace/initializers/engineHeaderItems';
import type { EngineHeaderState } from '#modules/engine-workspace/initializers/engineHeaderItems';
import assert from 'node:assert';
import { describe, it } from 'vitest';

const connectedEngine = {
  engineId: 'e1',
  url: 'http://localhost:4000',
  displayName: 'Local',
  state: 'connected' as const,
};
const offlineEngine = {
  engineId: 'e2',
  url: 'http://remote',
  displayName: null as unknown as string,
  state: 'error' as const,
};

function createState(overrides: Partial<EngineHeaderState> = {}): EngineHeaderState {
  return {
    activeEngineId: 'e1',
    state: 'connected',
    engines: [connectedEngine, offlineEngine],
    deployEnabled: true,
    isViewingModelViewer: false,
    ...overrides,
  };
}

describe('buildEngineHeaderItems', () => {
  it('builds select, connection menu, dashboard, deploy and play in this order', () => {
    assert.deepStrictEqual(
      buildEngineHeaderItems(createState()).map((item) => item.id),
      [
        'engine-header/engine-select',
        'engine-header/connection',
        'engine-header/open-engine',
        'engine-header/deploy',
        'engine-header/play',
      ],
    );
  });

  it('limits every item but Deploy to the design, deploy and debug pages', () => {
    for (const item of buildEngineHeaderItems(createState())) {
      assert.deepStrictEqual(
        item.pages,
        item.id === 'engine-header/deploy' ? ENGINE_HEADER_DEPLOY_PAGES : ENGINE_HEADER_PAGES,
      );
    }
    assert.deepStrictEqual(ENGINE_HEADER_DEPLOY_PAGES, ['design/*', 'debug/*']);
    assert.deepStrictEqual(ENGINE_HEADER_PAGES, ['design/*', 'deploy/*', 'debug/*']);
  });

  it('shows each connection state as icon shape, colour class and tooltip on the first entry', () => {
    const expectations = [
      ['connected', 'ph-fill ph-circle', 'Connected'],
      ['connecting', 'ph-bold ph-circle-notch ph-spin', 'Connecting'],
      ['reconnecting', 'ph-bold ph-circle-notch ph-spin', 'Reconnecting'],
      ['error', 'ph-fill ph-warning-circle', 'Connection error'],
      ['disconnected', 'ph ph-circle', 'Offline'],
    ] as const;
    for (const [state, shape, label] of expectations) {
      const [selectItem] = buildEngineHeaderItems(createState({ state, engines: [{ ...connectedEngine, state }] }));
      assert.ok(selectItem.type === 'select');
      const [firstEntry] = selectItem.entries;
      assert.strictEqual(firstEntry.icon, `${shape} engine-header-status engine-header-status--${state}`);
      assert.strictEqual(firstEntry.iconLabel, label);
      assert.strictEqual(selectItem.tooltip, `${label} · http://localhost:4000`);
    }
  });

  it('asks to select an engine when none is active', () => {
    const [selectItem] = buildEngineHeaderItems(createState({ activeEngineId: null, state: 'disconnected' }));
    assert.ok(selectItem.type === 'select');
    assert.strictEqual(selectItem.value, '');
    assert.strictEqual(selectItem.tooltip, 'Select an engine');
  });

  it('lists engines by name and selects the active one', () => {
    const selectItem = buildEngineHeaderItems(createState())[0];
    assert.ok(selectItem.type === 'select');
    assert.ok(!('icon' in selectItem));
    assert.strictEqual(selectItem.value, 'e1');
    assert.strictEqual(selectItem.tooltip, 'Connected · http://localhost:4000');
    assert.deepStrictEqual(
      selectItem.entries.map((entry) => entry.label),
      ['Local', 'http://remote'],
    );
    assert.strictEqual(
      selectItem.entries[0].icon,
      'ph-fill ph-circle engine-header-status engine-header-status--connected',
    );
    assert.strictEqual(selectItem.entries[0].iconLabel, 'Connected');
    assert.strictEqual(
      selectItem.entries[1].icon,
      'ph-fill ph-warning-circle engine-header-status engine-header-status--error',
    );
    assert.strictEqual(selectItem.entries[1].iconLabel, 'Connection error');
  });

  it('gives each engine entry its own state icon independent of the header state', () => {
    const selectItem = buildEngineHeaderItems(createState({ state: 'disconnected' }))[0];
    assert.ok(selectItem.type === 'select');
    assert.strictEqual(selectItem.tooltip, 'Offline · http://localhost:4000');
    assert.strictEqual(
      selectItem.entries[0].icon,
      'ph-fill ph-circle engine-header-status engine-header-status--connected',
    );
    assert.strictEqual(selectItem.entries[0].iconLabel, 'Connected');
    assert.strictEqual(
      selectItem.entries[1].icon,
      'ph-fill ph-warning-circle engine-header-status engine-header-status--error',
    );
    assert.strictEqual(selectItem.entries[1].iconLabel, 'Connection error');
  });

  it('falls back to a "No engine" text when no engine is known', () => {
    const items = buildEngineHeaderItems(
      createState({ activeEngineId: null, state: 'disconnected', engines: [], deployEnabled: false }),
    );
    const nameItem = items[0];
    assert.ok(nameItem.type === 'text');
    assert.strictEqual(nameItem.id, 'engine-header/engine-name');
    assert.strictEqual(nameItem.label, 'No engine');
    assert.ok(!items.some((item) => item.id === 'engine-header/engine-status'));
  });

  it('shows the dashboard only while connected and deploy only when enabled', () => {
    const connected = buildEngineHeaderItems(createState());
    assert.strictEqual(connected.find((item) => item.id === 'engine-header/open-engine')?.visible, true);
    assert.strictEqual(connected.find((item) => item.id === 'engine-header/deploy')?.visible, true);

    const offline = buildEngineHeaderItems(createState({ state: 'error', deployEnabled: false }));
    assert.strictEqual(offline.find((item) => item.id === 'engine-header/open-engine')?.visible, false);
    assert.strictEqual(offline.find((item) => item.id === 'engine-header/deploy')?.visible, false);
  });

  it('switches the play tooltip in the model viewer', () => {
    const playTooltip = (isViewingModelViewer: boolean) => {
      const play = buildEngineHeaderItems(createState({ isViewingModelViewer })).find(
        (item) => item.id === 'engine-header/play',
      );
      assert.ok(play?.type === 'button');
      return play.tooltip;
    };
    assert.match(playTooltip(true), /^Start Current Process in Debugger/);
    assert.match(playTooltip(false), /^Quick Deploy & Start in Debugger \(F5\)/);
  });
});

describe('addEngineHeaderItems', () => {
  it('appends the cluster to the page bar center and leaves the other areas alone', () => {
    const existing = { type: 'button', id: 'existing', icon: 'x', command: 'x', tooltip: 'x' } as const;
    const result = addEngineHeaderItems(
      { header: [existing], pageBarCenter: [existing], pageBarEnd: [existing] },
      buildEngineHeaderItems(createState()),
    );

    assert.strictEqual(result.header.length, 1);
    assert.strictEqual(result.pageBarEnd.length, 1);
    assert.strictEqual(result.pageBarCenter[0], existing);
    assert.strictEqual(result.pageBarCenter[1].id, 'engine-header/engine-select');
  });
});
