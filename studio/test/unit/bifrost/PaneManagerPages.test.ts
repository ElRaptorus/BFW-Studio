import { PaneManager } from '#bifrost/common/PaneManager';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';

function pane(id: string) {
  return { id, providerId: `${id}-provider`, collapsed: false };
}

describe('PaneManager pages', () => {
  let paneManager: PaneManager;
  let requestedPages: string[];

  beforeEach(() => {
    requestedPages = [];
    paneManager = new PaneManager();
    paneManager.configurePages(
      () => ['left', 'right', 'bottom'],
      (pageId) => {
        requestedPages.push(pageId);
        paneManager.setActivePage(pageId);
      },
    );
    paneManager.registerPaneGroup('left', 'explorer', [pane('explorer-pane')], { pages: ['design/workspace'] });
    paneManager.registerPaneGroup('left', 'git', [pane('git-pane')], { pages: ['design/source'] });
    paneManager.registerPaneGroup('right', 'property', [pane('property-pane')]);
    paneManager.setActivePage('design/workspace');
  });

  it('requires pages for left groups', () => {
    assert.throws(() => paneManager.registerPaneGroup('left', 'orphan', []));
  });

  it('shows only the groups of the active page', () => {
    assert.deepStrictEqual(
      paneManager.getViewData().left.paneGroups.map((group) => group.groupId),
      ['explorer'],
    );
    paneManager.setActivePage('design/source');
    assert.deepStrictEqual(
      paneManager.getViewData().left.paneGroups.map((group) => group.groupId),
      ['git'],
    );
    assert.deepStrictEqual(
      paneManager.getViewData().right.paneGroups.map((group) => group.groupId),
      ['property'],
    );
  });

  it('keeps the area state per page', () => {
    paneManager.hidePaneArea('left');
    paneManager.setActivePage('design/source');
    assert.strictEqual(paneManager.getPaneAreaVisibility('left'), true);
    paneManager.setActivePage('design/workspace');
    assert.strictEqual(paneManager.getPaneAreaVisibility('left'), false);
  });

  it('switches to the page of a pane that is shown on another page', () => {
    paneManager.setVisibilityOfPaneAreaByPaneId('git-pane', true);
    assert.deepStrictEqual(requestedPages, ['design/source']);
    assert.strictEqual(paneManager.getActivePaneIdForArea('left'), 'git-pane');
  });

  it('reopens the group last selected in the tab strip after the area was hidden', () => {
    paneManager.registerPaneGroup('left', 'search', [pane('search-pane')], { pages: ['design/workspace'] });
    paneManager.setVisibilityOfPaneAreaByPaneId('search-pane', true);
    paneManager.setActiveGroupInArea('left', 'explorer');
    paneManager.hidePaneArea('left');
    paneManager.selectLastActivePaneInArea('left');
    assert.strictEqual(paneManager.getActivePaneIdForArea('left'), 'explorer-pane');
  });

  it('round-trips format v2 and ignores state without a version', () => {
    paneManager.hidePaneArea('left');
    const serialized = JSON.parse(JSON.stringify(paneManager.serialize()));
    assert.strictEqual(serialized.version, 2);

    const restored = new PaneManager();
    restored.registerPaneGroup('left', 'explorer', [pane('explorer-pane')], { pages: ['design/workspace'] });
    restored.deserialize(serialized);
    restored.setActivePage('design/workspace');
    assert.strictEqual(restored.getPaneAreaVisibility('left'), false);

    const ignoring = new PaneManager();
    ignoring.registerPaneGroup('left', 'explorer', [pane('explorer-pane')], { pages: ['design/workspace'] });
    ignoring.deserialize({ left: { visible: false, sizeInPixels: 1, paneGroups: [] } });
    ignoring.setActivePage('design/workspace');
    assert.strictEqual(ignoring.getPaneAreaVisibility('left'), true);
  });

  it('shows no areas for an empty category or a page without pane areas', () => {
    paneManager.setActivePage(null);
    assert.deepStrictEqual(
      paneManager.getViewData().right.paneGroups.map((group) => group.groupId),
      [],
    );
    assert.strictEqual(paneManager.getViewData().left.visible, false);

    const restricted = new PaneManager();
    restricted.configurePages(
      () => [],
      () => undefined,
    );
    restricted.registerPaneGroup('right', 'property', [pane('property-pane')]);
    restricted.setActivePage('home/welcome');
    assert.deepStrictEqual(
      restricted.getViewData().right.paneGroups.map((group) => group.groupId),
      [],
    );
  });
});

describe('PaneManager detail level', () => {
  let paneManager: PaneManager;

  const rightGroupIds = () => paneManager.getViewData().right.paneGroups.map((group) => group.groupId);

  beforeEach(() => {
    paneManager = new PaneManager();
    paneManager.configurePages(
      () => ['left', 'right', 'bottom'],
      (pageId) => paneManager.setActivePage(pageId),
    );
    paneManager.registerPaneGroup('left', 'explorer', [pane('explorer-pane')], { pages: ['design/workspace'] });
    paneManager.registerPaneGroup('left', 'engines', [pane('engines-pane')], { pages: ['debug/engines'] });
    paneManager.registerPaneGroup('right', 'property', [pane('property-pane')]);
    paneManager.registerPaneGroup('right', 'scripting', [pane('scripting-pane'), pane('scripting-second-pane')], {
      detailLevel: 'technical',
    });
    paneManager.registerPaneGroup('right', 'dataflow', [pane('dataflow-pane')], { detailLevel: 'technical' });
    paneManager.setActivePage('design/workspace');
  });

  it('shows technical groups by default', () => {
    assert.deepStrictEqual(rightGroupIds(), ['property', 'scripting', 'dataflow']);
  });

  it('hides technical groups on Design pages only in business mode', () => {
    paneManager.setDetailLevel('business');
    assert.deepStrictEqual(rightGroupIds(), ['property']);
    paneManager.setActivePage('debug/engines');
    assert.deepStrictEqual(rightGroupIds(), ['property', 'scripting', 'dataflow']);
  });

  it('falls back to the first shown group when the active group is hidden and restores on switching back', () => {
    paneManager.setActiveGroupInArea('right', 'scripting');
    paneManager.setDetailLevel('business');
    assert.deepStrictEqual(
      paneManager.getViewData().right.paneGroups.map((group) => [group.groupId, group.visible]),
      [['property', true]],
    );
    paneManager.setDetailLevel('technical');
    assert.deepStrictEqual(rightGroupIds(), ['property', 'scripting', 'dataflow']);
  });

  it('keeps the active pane of a hidden group across a detail level round trip', () => {
    paneManager.setVisibilityOfPaneAreaByPaneId('scripting-second-pane', true);
    paneManager.setDetailLevel('business');
    assert.strictEqual(paneManager.getActivePaneIdForArea('right'), 'property-pane');
    paneManager.setDetailLevel('technical');
    paneManager.setActiveGroupInArea('right', 'scripting');
    assert.strictEqual(paneManager.getActivePaneIdForArea('right'), 'scripting-second-pane');
  });

  it('ignores a reveal of a hidden technical pane', () => {
    paneManager.setDetailLevel('business');
    paneManager.setVisibilityOfPaneAreaByPaneId('scripting-pane', true);
    paneManager.togglePaneAreaByPaneId('dataflow-pane');
    assert.deepStrictEqual(rightGroupIds(), ['property']);
    assert.strictEqual(paneManager.getViewData().right.paneGroups[0].visible, true);
  });
});
