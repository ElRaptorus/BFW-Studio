import { RecentlyViewedManager } from '#bifrost/common/RecentlyViewedManager';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('RecentlyViewedManager.updateCurrentItem', () => {
  it('does nothing when the type has no history yet', () => {
    const manager = new RecentlyViewedManager();

    assert.doesNotThrow(() => manager.updateCurrentItem('editor', { uri: 'about:settings' }));
    assert.deepStrictEqual(manager.getListByType('editor'), []);
  });

  it('replaces the active item of an existing history', () => {
    const manager = new RecentlyViewedManager();
    manager.addItem('editor', { uri: 'about:settings', metadata: 1 });

    manager.updateCurrentItem('editor', { uri: 'about:settings', metadata: 2 });

    assert.deepStrictEqual(manager.getListByType('editor'), [{ uri: 'about:settings', metadata: 2 }]);
  });
});
