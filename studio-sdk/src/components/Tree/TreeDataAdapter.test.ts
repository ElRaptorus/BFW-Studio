import * as assert from 'assert';

import type { TreeItem } from '../../contracts/TreeTypes';
import { TreeDataAdapter } from './TreeDataAdapter';

const makeFile = (label: string, overrides?: Partial<TreeItem>): TreeItem => ({
  type: 'file',
  label,
  ...overrides,
});

const makeDir = (label: string, entries: TreeItem[], overrides?: Partial<TreeItem>): TreeItem => ({
  type: 'directory',
  label,
  entries,
  ...overrides,
});

describe('TreeDataAdapter', () => {
  describe('constructor and getDataLoader', () => {
    it('indexes flat entries with positional IDs', () => {
      const entries: TreeItem[] = [makeFile('a.ts'), makeFile('b.ts')];
      const adapter = new TreeDataAdapter(entries);
      const loader = adapter.getDataLoader();

      const rootChildren = loader.getChildren(adapter.rootItemId);
      assert.strictEqual(rootChildren.length, 2);

      const first = loader.getItem(rootChildren[0]);
      assert.strictEqual(first.label, 'a.ts');
      assert.strictEqual(first.type, 'file');
      assert.ok(first.htId);

      const second = loader.getItem(rootChildren[1]);
      assert.strictEqual(second.label, 'b.ts');
    });

    it('uses pathId when provided', () => {
      const entries: TreeItem[] = [
        makeFile('readme.md', { pathId: 'custom-id-1' }),
        makeFile('index.ts', { pathId: 'custom-id-2' }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const loader = adapter.getDataLoader();

      const children = loader.getChildren(adapter.rootItemId);
      assert.deepStrictEqual(children, ['custom-id-1', 'custom-id-2']);

      const item = loader.getItem('custom-id-1');
      assert.strictEqual(item.label, 'readme.md');
      assert.strictEqual(item.htId, 'custom-id-1');
    });

    it('indexes nested entries recursively', () => {
      const entries: TreeItem[] = [
        makeDir(
          'src',
          [
            makeFile('app.ts', { pathId: 'src/app.ts' }),
            makeDir('utils', [makeFile('helper.ts', { pathId: 'src/utils/helper.ts' })], { pathId: 'src/utils' }),
          ],
          { pathId: 'src' },
        ),
      ];
      const adapter = new TreeDataAdapter(entries);
      const loader = adapter.getDataLoader();

      const rootChildren = loader.getChildren(adapter.rootItemId);
      assert.strictEqual(rootChildren.length, 1);
      assert.strictEqual(rootChildren[0], 'src');

      const srcChildren = loader.getChildren('src');
      assert.strictEqual(srcChildren.length, 2);
      assert.deepStrictEqual(srcChildren, ['src/app.ts', 'src/utils']);

      const utilsChildren = loader.getChildren('src/utils');
      assert.strictEqual(utilsChildren.length, 1);
      assert.strictEqual(utilsChildren[0], 'src/utils/helper.ts');
    });

    it('returns empty children for leaf nodes', () => {
      const entries: TreeItem[] = [makeFile('leaf.ts', { pathId: 'leaf' })];
      const adapter = new TreeDataAdapter(entries);
      const loader = adapter.getDataLoader();

      const children = loader.getChildren('leaf');
      assert.deepStrictEqual(children, []);
    });
  });

  describe('getItemById', () => {
    it('returns the item data for a known ID', () => {
      const adapter = new TreeDataAdapter([makeFile('x.ts', { pathId: 'x' })]);
      const item = adapter.getItemById('x');
      assert.ok(item);
      assert.strictEqual(item!.label, 'x.ts');
    });

    it('returns undefined for an unknown ID', () => {
      const adapter = new TreeDataAdapter([makeFile('x.ts', { pathId: 'x' })]);
      assert.strictEqual(adapter.getItemById('nonexistent'), undefined);
    });
  });

  describe('getAllIds', () => {
    it('returns all item IDs excluding the virtual root', () => {
      const entries: TreeItem[] = [
        makeDir('src', [makeFile('a.ts', { pathId: 'a' })], { pathId: 'src' }),
        makeFile('b.ts', { pathId: 'b' }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const ids = adapter.getAllIds();

      assert.ok(ids.includes('src'));
      assert.ok(ids.includes('a'));
      assert.ok(ids.includes('b'));
      assert.strictEqual(ids.length, 3);
      assert.ok(!ids.includes('__ht_root__'));
    });
  });

  describe('getInitialExpandedIds', () => {
    it('returns IDs of entries with expanded=true that have children', () => {
      const entries: TreeItem[] = [
        makeDir('open', [makeFile('child.ts', { pathId: 'child' })], {
          pathId: 'open',
          expanded: true,
        }),
        makeDir('closed', [makeFile('other.ts', { pathId: 'other' })], {
          pathId: 'closed',
          expanded: false,
        }),
        makeFile('leaf.ts', { pathId: 'leaf', expanded: true }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const expanded = adapter.getInitialExpandedIds();

      assert.ok(expanded.includes('open'));
      assert.ok(!expanded.includes('closed'));
      assert.ok(!expanded.includes('leaf'));
    });
  });

  describe('getInitialSelectedIds', () => {
    it('returns IDs of entries with selected=true', () => {
      const entries: TreeItem[] = [
        makeFile('sel.ts', { pathId: 'sel', selected: true }),
        makeFile('not.ts', { pathId: 'not', selected: false }),
        makeFile('def.ts', { pathId: 'def' }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const selected = adapter.getInitialSelectedIds();

      assert.deepStrictEqual(selected, ['sel']);
    });
  });

  describe('getMetadataForIds', () => {
    it('extracts metadata from matching IDs, skipping nulls', () => {
      const entries: TreeItem[] = [
        makeFile('a.ts', { pathId: 'a', metadata: { uri: '/a' } }),
        makeFile('b.ts', { pathId: 'b' }),
        makeFile('c.ts', { pathId: 'c', metadata: { uri: '/c' } }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const metadata = adapter.getMetadataForIds(['a', 'b', 'c', 'unknown']);

      assert.strictEqual(metadata.length, 2);
      assert.deepStrictEqual(metadata[0], { uri: '/a' });
      assert.deepStrictEqual(metadata[1], { uri: '/c' });
    });
  });

  describe('findIdsByMetadataFilter', () => {
    it('finds IDs whose metadata passes the filter', () => {
      const entries: TreeItem[] = [
        makeFile('a.ts', { pathId: 'a', metadata: { uri: '/a', kind: 'source' } }),
        makeFile('b.ts', { pathId: 'b', metadata: { uri: '/b', kind: 'test' } }),
        makeFile('c.ts', { pathId: 'c', metadata: { uri: '/c', kind: 'source' } }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const ids = adapter.findIdsByMetadataFilter((meta) => meta?.kind === 'source');

      assert.deepStrictEqual(ids, ['a', 'c']);
    });
  });

  describe('getParentChain', () => {
    it('returns parent IDs from root to the item (excluding virtual root)', () => {
      const entries: TreeItem[] = [
        makeDir('root', [makeDir('mid', [makeFile('leaf.ts', { pathId: 'leaf' })], { pathId: 'mid' })], {
          pathId: 'root',
        }),
      ];
      const adapter = new TreeDataAdapter(entries);
      const chain = adapter.getParentChain('leaf');

      assert.deepStrictEqual(chain, ['root', 'mid']);
    });
  });

  describe('getSelectedItemsForIds', () => {
    it('returns TreeItemData objects for valid IDs', () => {
      const entries: TreeItem[] = [makeFile('a.ts', { pathId: 'a' }), makeFile('b.ts', { pathId: 'b' })];
      const adapter = new TreeDataAdapter(entries);
      const items = adapter.getSelectedItemsForIds(['a', 'missing', 'b']);

      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].label, 'a.ts');
      assert.strictEqual(items[1].label, 'b.ts');
    });
  });
});
