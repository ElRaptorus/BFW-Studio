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
  state: 'connected',
} as const;
const offlineEngine = {
  engineId: 'e2',
  url: 'http://remote',
  displayName: null as unknown as string,
  state: 'error',
} as const;

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
  it('builds status, select, connection menu, dashboard, deploy and play in this order', () => {
    assert.deepStrictEqual(
      buildEngineHeaderItems(createState()).map((item) => item.id),
      [
        'engine-header/engine-status',
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

  it('carries the connection state in the status icon class', () => {
    for (const state of ['connected', 'connecting', 'reconnecting', 'error', 'disconnected'] as const) {
      const [statusItem] = buildEngineHeaderItems(createState({ state }));
      assert.ok(statusItem.type === 'icon');
      assert.match(statusItem.icon, new RegExp(`engine-header-status--${state}$`));
    }
  });

  it('labels offline engines and selects the active one', () => {
    const selectItem = buildEngineHeaderItems(createState())[1];
    assert.ok(selectItem.type === 'select');
    assert.strictEqual(selectItem.value, 'e1');
    assert.strictEqual(selectItem.tooltip, 'http://localhost:4000');
    assert.deepStrictEqual(
      selectItem.entries.map((entry) => entry.label),
      ['Local', '[OFFLINE] http://remote'],
    );
  });

  it('falls back to a "No engine" text when no engine is known', () => {
    const items = buildEngineHeaderItems(
      createState({ activeEngineId: null, state: 'disconnected', engines: [], deployEnabled: false }),
    );
    const nameItem = items[1];
    assert.ok(nameItem.type === 'text');
    assert.strictEqual(nameItem.id, 'engine-header/engine-name');
    assert.strictEqual(nameItem.label, 'No engine');
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
    const existing = { type: 'button', id: 'existing' } as const;
    const result = addEngineHeaderItems(
      { header: [existing], pageBarCenter: [existing], pageBarEnd: [existing] },
      buildEngineHeaderItems(createState()),
    );

    assert.strictEqual(result.header.length, 1);
    assert.strictEqual(result.pageBarEnd.length, 1);
    assert.strictEqual(result.pageBarCenter[0], existing);
    assert.strictEqual(result.pageBarCenter[1].id, 'engine-header/engine-status');
  });
});
