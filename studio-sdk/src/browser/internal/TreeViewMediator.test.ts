import * as assert from 'assert';

import { TreeDataAdapter } from '../../components/Tree/TreeDataAdapter';
import { EVENT_TREEVIEW_ENTRIES_CHANGED, TreeViewMediator } from './TreeViewMediator';

function makeMockStudio(): any {
  return {
    getGuid: (prefix: string) => `${prefix}test-guid`,
  };
}

function makeMockTree(overrides?: Partial<Record<string, any>>): any {
  return {
    getSelectedItems: () => [],
    getItems: () => [],
    collapseAll: () => {},
    expandAll: () => {},
    setSelectedItems: () => {},
    getState: () => ({ expandedItems: [] }),
    applySubStateUpdate: () => {},
    rebuildTree: () => {},
    getItemInstance: () => null,
    ...overrides,
  };
}

function makeMockItemInstance(data: any): any {
  return {
    getItemData: () => data,
    getId: () => data.htId,
    isExpanded: () => false,
    isSelected: () => true,
    isFocused: () => false,
    isFolder: () => false,
  };
}

describe('TreeViewMediator', () => {
  describe('constructor', () => {
    it('generates a domClassName from studio.getGuid', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      assert.strictEqual(mediator.domClassName, 'TreeViewMediator-test-guid');
      assert.strictEqual(mediator.domSelector, '.TreeViewMediator-test-guid');
    });

    it('uses the provided domClassName when given', () => {
      const mediator = new TreeViewMediator(makeMockStudio(), 'custom-class');
      assert.strictEqual(mediator.domClassName, 'custom-class');
      assert.strictEqual(mediator.domSelector, '.custom-class');
    });
  });

  describe('notifyEntriesChanged', () => {
    it('emits the entries changed event', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      let emitted = false;
      mediator.on(EVENT_TREEVIEW_ENTRIES_CHANGED, () => {
        emitted = true;
      });
      mediator.notifyEntriesChanged();
      assert.strictEqual(emitted, true);
    });
  });

  describe('getSelectedMetadata', () => {
    it('returns empty array when tree is not set', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      assert.deepStrictEqual(mediator.getSelectedMetadata(), []);
    });

    it('returns metadata from selected items', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      const itemA = makeMockItemInstance({ htId: 'a', metadata: { uri: '/a' } });
      const itemB = makeMockItemInstance({ htId: 'b', metadata: { uri: '/b' } });

      const tree = makeMockTree({
        getSelectedItems: () => [itemA, itemB],
      });
      const adapter = new TreeDataAdapter([
        { type: 'file', label: 'a', pathId: 'a', metadata: { uri: '/a' } },
        { type: 'file', label: 'b', pathId: 'b', metadata: { uri: '/b' } },
      ]);

      mediator.setTreeInstance(tree);
      mediator.setDataAdapter(adapter);

      const result = mediator.getSelectedMetadata();
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0], { uri: '/a' });
      assert.deepStrictEqual(result[1], { uri: '/b' });
    });

    it('filters out items with null metadata', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      const itemA = makeMockItemInstance({ htId: 'a', metadata: { uri: '/a' } });
      const itemB = makeMockItemInstance({ htId: 'b', metadata: null });

      const tree = makeMockTree({
        getSelectedItems: () => [itemA, itemB],
      });
      mediator.setTreeInstance(tree);
      mediator.setDataAdapter(new TreeDataAdapter([]));

      const result = mediator.getSelectedMetadata();
      assert.strictEqual(result.length, 1);
    });
  });

  describe('collapseAll / expandAll', () => {
    it('delegates to tree instance', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      let collapseCalled = false;
      let expandCalled = false;

      mediator.setTreeInstance(
        makeMockTree({
          collapseAll: () => {
            collapseCalled = true;
          },
          expandAll: () => {
            expandCalled = true;
          },
        }),
      );

      mediator.collapseAll();
      assert.strictEqual(collapseCalled, true);

      mediator.expandAll();
      assert.strictEqual(expandCalled, true);
    });

    it('does not throw when tree is not set', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      assert.doesNotThrow(() => mediator.collapseAll());
      assert.doesNotThrow(() => mediator.expandAll());
    });
  });

  describe('getViewData', () => {
    it('returns empty items when tree is not set', () => {
      const mediator = new TreeViewMediator(makeMockStudio());
      const result = mediator.getViewData();
      assert.deepStrictEqual(result, { items: [] });
    });
  });
});
