import { CategoryManager, isValidPagePattern, matchesPage } from '#bifrost/common/CategoryManager';
import {
  EVENT_WORKBENCH_PAGE_ACTIVATED,
  EVENT_WORKBENCH_PAGE_UNREGISTERED,
} from '#bifrost/contracts/internal/WorkbenchEvents';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';

function createManager(): CategoryManager {
  const manager = new CategoryManager();
  manager.registerCategory({ id: 'design', label: 'Design', icon: 'ph-pencil', placement: 'main', order: 1 });
  manager.registerCategory({ id: 'discover', label: 'Discover', icon: 'ph-chart-line', placement: 'main', order: 2 });
  manager.registerPage({ id: 'design/workspace', categoryId: 'design', label: 'Workspace', icon: 'x', order: 1 });
  manager.registerPage({ id: 'design/source', categoryId: 'design', label: 'Source', icon: 'x', order: 2 });
  return manager;
}

describe('CategoryManager', () => {
  let manager: CategoryManager;
  beforeEach(() => {
    manager = createManager();
  });

  it('rejects invalid ids, unknown categories, mismatching prefixes and duplicates', () => {
    assert.throws(() => manager.registerCategory({ id: 'Bad Id', label: 'x', icon: 'x', placement: 'main', order: 0 }));
    assert.throws(() => manager.registerCategory({ id: 'design', label: 'x', icon: 'x', placement: 'main', order: 0 }));
    assert.throws(() => manager.registerPage({ id: 'nope/page', categoryId: 'nope', label: 'x', icon: 'x', order: 0 }));
    assert.throws(() => manager.registerPage({ id: 'design', categoryId: 'design', label: 'x', icon: 'x', order: 0 }));
    assert.throws(() =>
      manager.registerPage({ id: 'discover/page', categoryId: 'design', label: 'x', icon: 'x', order: 0 }),
    );
    assert.throws(() =>
      manager.registerPage({ id: 'design/workspace', categoryId: 'design', label: 'x', icon: 'x', order: 0 }),
    );
  });

  it('hides categories without pages unless showEmpty is set', () => {
    assert.deepStrictEqual(
      manager.getVisibleCategories().map((category) => category.id),
      ['design'],
    );
    manager.setShowEmptyCategories(true);
    assert.deepStrictEqual(
      manager.getVisibleCategories().map((category) => category.id),
      ['design', 'discover'],
    );
  });

  it('activates the first page, then the last used page of a category', () => {
    manager.activateCategory('design');
    assert.strictEqual(manager.getActivePageId(), 'design/workspace');

    manager.activatePage('design/source');
    manager.setShowEmptyCategories(true);
    manager.activateCategory('discover');
    assert.strictEqual(manager.getActivePageId(), null);
    assert.strictEqual(manager.getActiveCategoryId(), 'discover');

    manager.activateCategory('design');
    assert.strictEqual(manager.getActivePageId(), 'design/source');
  });

  it('does nothing when activating a hidden category (shortcut on a hidden category)', () => {
    manager.activateCategory('design');
    manager.activateCategory('discover');
    assert.strictEqual(manager.getActiveCategoryId(), 'design');
    assert.strictEqual(manager.getActivePageId(), 'design/workspace');
  });

  it('emits the activation event only when the page changes', () => {
    const received: [string | null, string | null][] = [];
    manager.on('EVENT_WORKBENCH_PAGE_ACTIVATED', (pageId, previousPageId) => received.push([pageId, previousPageId]));
    manager.activatePage('design/workspace');
    manager.activatePage('design/workspace');
    manager.activatePage('design/source');
    assert.deepStrictEqual(received, [
      ['design/workspace', null],
      ['design/source', 'design/workspace'],
    ]);
  });

  it('restores stored state and drops pages that no longer exist', () => {
    manager.activatePage('design/source');
    const dump = manager.serialize();

    const restored = createManager();
    restored.deserialize(dump);
    assert.strictEqual(restored.getActivePageId(), 'design/source');

    const withoutSource = new CategoryManager();
    withoutSource.registerCategory({ id: 'design', label: 'Design', icon: 'x', placement: 'main', order: 1 });
    withoutSource.registerPage({
      id: 'design/workspace',
      categoryId: 'design',
      label: 'Workspace',
      icon: 'x',
      order: 1,
    });
    withoutSource.deserialize(dump);
    assert.strictEqual(withoutSource.getActivePageId(), null);
    withoutSource.ensureActivePage('design/workspace');
    assert.strictEqual(withoutSource.getActivePageId(), 'design/workspace');
  });

  it('ignores stored state without the current version', () => {
    manager.deserialize({ activePageId: 'design/source' });
    assert.strictEqual(manager.getActivePageId(), null);
  });
});

describe('CategoryManager page patterns and fallbacks', () => {
  it('matches exact page ids and category wildcards', () => {
    assert.ok(matchesPage(['design/*'], 'design/source'));
    assert.ok(matchesPage(['design/workspace'], 'design/workspace'));
    assert.ok(!matchesPage(['design/workspace'], 'design/source'));
    assert.ok(!matchesPage(['design/*'], 'designer/source'));
    assert.ok(isValidPagePattern('design/*'));
    assert.ok(isValidPagePattern('design/workspace'));
    assert.ok(!isValidPagePattern('design'));
    assert.ok(!isValidPagePattern('*/*'));
    assert.ok(!isValidPagePattern('design/**'));
  });

  it('falls back to another page of the category when the active page is unregistered', () => {
    const manager = createManager();
    manager.activatePage('design/source');
    const received: unknown[] = [];
    manager.on(EVENT_WORKBENCH_PAGE_ACTIVATED, (...args: unknown[]) => received.push(args));
    manager.unregisterPage('design/source');
    assert.strictEqual(manager.getActivePageId(), 'design/workspace');
    assert.strictEqual(received.length, 1);
  });

  it('announces a removed page once and stays silent for unknown pages', () => {
    const manager = createManager();
    const removed: unknown[] = [];
    manager.on(EVENT_WORKBENCH_PAGE_UNREGISTERED, (pageId: string) => removed.push(pageId));
    manager.unregisterPage('design/source');
    manager.unregisterPage('design/source');
    assert.deepStrictEqual(removed, ['design/source']);
  });

  it('ends without an active page when the last page of the category is unregistered', () => {
    const manager = createManager();
    manager.activatePage('design/source');
    manager.unregisterPage('design/workspace');
    manager.unregisterPage('design/source');
    assert.strictEqual(manager.getActivePageId(), null);
  });

  it('falls back to the fallback page when the only page of the active category is removed', () => {
    const manager = createManager();
    manager.registerPage({ id: 'discover/insights', categoryId: 'discover', label: 'Insights', icon: 'x', order: 1 });
    manager.activatePage('discover/insights');
    manager.unregisterPage('discover/insights');
    assert.ok(!manager.isCategoryVisible('discover'));
    manager.ensureActivePage('design/workspace');
    assert.strictEqual(manager.getActivePageId(), 'design/workspace');
  });

  it('leaves a hidden empty active category for the fallback page', () => {
    const manager = createManager();
    manager.setShowEmptyCategories(true);
    manager.activateCategory('discover');
    assert.strictEqual(manager.getActivePageId(), null);
    manager.ensureActivePage('design/workspace');
    assert.strictEqual(manager.getActivePageId(), null);
    manager.setShowEmptyCategories(false);
    manager.ensureActivePage('design/workspace');
    assert.strictEqual(manager.getActivePageId(), 'design/workspace');
  });
});
