import { MenuBarManager } from '#bifrost/common/MenuBarManager';
import { insertAfterMenuBarItem, insertBeforeMenuBarItem } from '#bifrost/common/MenuBarModifierFunctions';
import { isMenuBarItemArea } from '#bifrost/contracts/MenuBarTypes';
import assert from 'node:assert';
import { describe, it, vi } from 'vitest';

describe('menu bar pages', () => {
  it('rejects invalid page patterns and accepts ids and wildcards', () => {
    const manager = new MenuBarManager();
    assert.throws(
      () => manager.registerMenuBarItem('header', () => [], { pages: ['design'] }),
      /Invalid page 'design'/,
    );
    manager.registerMenuBarItem('header', () => [], { pages: ['design/*', 'debug/engines'] });
  });

  it('inserts into the header and rejects unknown ids', () => {
    const createMap = () => ({ header: [{ type: 'button', id: 'h' } as any], pageBarCenter: [], pageBarEnd: [] });
    assert.throws(() => insertAfterMenuBarItem(createMap(), 'missing', () => []), /Could not find item/);
    assert.throws(() => insertBeforeMenuBarItem(createMap(), 'missing', () => []), /Could not find item/);

    const after = insertAfterMenuBarItem(createMap(), 'h', () => [{ type: 'button', id: 'after' } as any]);
    assert.deepStrictEqual(
      after.header.map((candidate) => candidate.id),
      ['h', 'after'],
    );
    const before = insertBeforeMenuBarItem(createMap(), 'h', () => [{ type: 'button', id: 'before' } as any]);
    assert.deepStrictEqual(
      before.header.map((candidate) => candidate.id),
      ['before', 'h'],
    );
  });

  it('serializes the header and both page bar areas, each with its own items', () => {
    const manager = new MenuBarManager();
    manager.registerMenuBarItem('header', () => [{ type: 'button', id: 'h' } as any]);
    manager.registerMenuBarItem('pageBarEnd', () => [{ type: 'button', id: 'p' } as any], { pages: ['design/*'] });
    manager.updateMenuBarItems([]);
    const items = manager.serialize().items;
    assert.deepStrictEqual(Object.keys(items), ['header', 'pageBarCenter', 'pageBarEnd']);
    assert.deepStrictEqual(
      items.header.map((candidate) => candidate.id),
      ['h'],
    );
    assert.deepStrictEqual(items.pageBarEnd, [{ type: 'button', id: 'p', pages: ['design/*'] }]);
    assert.deepStrictEqual(items.pageBarCenter, []);
  });

  it('keeps the center area separate from the other areas', () => {
    const manager = new MenuBarManager();
    manager.registerMenuBarItem('pageBarCenter', () => [{ type: 'button', id: 'c' } as any]);
    manager.updateMenuBarItems([]);
    const items = manager.serialize().items;
    assert.deepStrictEqual(
      items.pageBarCenter.map((candidate) => candidate.id),
      ['c'],
    );
    assert.deepStrictEqual(items.header, []);
    assert.deepStrictEqual(items.pageBarEnd, []);
  });

  it('skips a failing modifier and still applies the others', () => {
    const manager = new MenuBarManager();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    manager.registerMenuBarItem('header', () => [{ type: 'button', id: 'h' } as any]);
    manager.registerMenuBarItemModifier((map) => insertAfterMenuBarItem(map, 'missing', () => []));
    manager.registerMenuBarItemModifier((map) =>
      insertAfterMenuBarItem(map, 'h', () => [{ type: 'button', id: 'new' } as any]),
    );
    manager.updateMenuBarItems([]);
    assert.deepStrictEqual(
      manager.serialize().items.header.map((candidate) => candidate.id),
      ['h', 'new'],
    );
    assert.strictEqual(consoleError.mock.calls.length, 1);
    consoleError.mockRestore();
  });
});

describe('isMenuBarItemArea', () => {
  it('accepts the three areas and rejects the removed ones and non-strings', () => {
    for (const area of ['header', 'pageBarCenter', 'pageBarEnd']) {
      assert.strictEqual(isMenuBarItemArea(area), true);
    }
    for (const area of ['left', 'center', 'right', '', undefined, 1]) {
      assert.strictEqual(isMenuBarItemArea(area), false);
    }
  });
});
