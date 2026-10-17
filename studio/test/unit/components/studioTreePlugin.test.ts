import type { TreeItem } from '#bifrost/contracts/TreeTypes';
import type { TreeItemData } from '#components/Tree/TreeDataAdapter';
import { TreeDataAdapter } from '#components/Tree/TreeDataAdapter';
import { studioTreePlugin } from '#components/Tree/studioTreePlugin';
import { createTree, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import type { TreeInstance } from '@headless-tree/core';
import assert from 'node:assert';
import { describe, it, vi } from 'vitest';

const makeFile = (label: string): TreeItem => ({
  type: 'file',
  label,
  pathId: label,
  metadata: { uri: `/${label}` },
});

function createStudioTree(
  onClickItem: (metadata: any) => void,
  forwardModifierClicks = false,
): TreeInstance<TreeItemData> {
  const adapter = new TreeDataAdapter([makeFile('a'), makeFile('b'), makeFile('c'), makeFile('d')]);
  const tree = createTree<TreeItemData>({
    rootItemId: adapter.rootItemId,
    getItemName: (item) => item.getItemData()?.label ?? '',
    isItemFolder: () => false,
    dataLoader: adapter.getDataLoader(),
    studioCallbacks: { onClickItem, forwardModifierClicks },
    features: [syncDataLoaderFeature, selectionFeature, studioTreePlugin],
  });
  tree.setMounted(true);
  tree.rebuildTree();
  return tree;
}

function click(tree: TreeInstance<TreeItemData>, itemId: string, modifiers: Partial<MouseEvent> = {}): void {
  const event = { ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers } as MouseEvent;
  tree.getItemInstance(itemId).getProps().onClick(event);
}

function selected(tree: TreeInstance<TreeItemData>): string[] {
  return [...tree.getState().selectedItems].sort();
}

describe('studioTreePlugin', () => {
  it('fires onClickItem on a plain click and selects only that item', () => {
    const onClickItem = vi.fn();
    const tree = createStudioTree(onClickItem);

    click(tree, 'b');

    assert.deepStrictEqual(selected(tree), ['b']);
    assert.strictEqual(onClickItem.mock.calls.length, 1);
    assert.deepStrictEqual(onClickItem.mock.calls[0][0], { uri: '/b' });
  });

  it('Shift+Click selects the range from the anchor without firing onClickItem', () => {
    const onClickItem = vi.fn();
    const tree = createStudioTree(onClickItem);

    click(tree, 'a');
    click(tree, 'c', { shiftKey: true });

    assert.deepStrictEqual(selected(tree), ['a', 'b', 'c']);
    assert.strictEqual(onClickItem.mock.calls.length, 1);
  });

  it('Ctrl+Click and Cmd+Click toggle one item without firing onClickItem', () => {
    const onClickItem = vi.fn();
    const tree = createStudioTree(onClickItem);

    click(tree, 'a');
    click(tree, 'c', { ctrlKey: true });
    click(tree, 'd', { metaKey: true });
    assert.deepStrictEqual(selected(tree), ['a', 'c', 'd']);

    click(tree, 'c', { ctrlKey: true });
    assert.deepStrictEqual(selected(tree), ['a', 'd']);
    assert.strictEqual(onClickItem.mock.calls.length, 1);
  });

  it('fires onClickItem with the event on modifier clicks when forwardModifierClicks is set', () => {
    const onClickItem = vi.fn();
    const tree = createStudioTree(onClickItem, true);

    click(tree, 'a', { shiftKey: true });
    click(tree, 'b', { ctrlKey: true });

    assert.strictEqual(onClickItem.mock.calls.length, 2);
    assert.strictEqual(onClickItem.mock.calls[0][1].shiftKey, true);
    assert.strictEqual(onClickItem.mock.calls[1][1].ctrlKey, true);
  });
});
