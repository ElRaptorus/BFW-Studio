import { StatusBarManager } from '#bifrost/common/StatusBarManager';
import { normalizeStatusBarItems } from '#bifrost/common/normalizeStatusBarItems';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('normalizeStatusBarItems', () => {
  it('returns an empty list for nullish input', () => {
    assert.deepStrictEqual(normalizeStatusBarItems(null), []);
    assert.deepStrictEqual(normalizeStatusBarItems(undefined), []);
  });

  it('does not flatten array-like objects of numbers into status bar items', () => {
    const arrayLike = { 0: 0, 1: 1, 2: 0, length: 3 };
    assert.deepStrictEqual(normalizeStatusBarItems(arrayLike), []);
    assert.deepStrictEqual(normalizeStatusBarItems([0, 1, 0, 1]), []);
  });

  it('wraps a single valid item that is not already in an array', () => {
    const item = {
      type: 'button',
      id: 'problems',
      content: { type: 'text', label: '0' },
      command: 'std.noop',
    };
    const result = normalizeStatusBarItems(item);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'problems');
  });

  it('keeps valid items and drops duplicates by id', () => {
    const result = normalizeStatusBarItems([
      {
        type: 'button',
        id: 'problems',
        content: { type: 'text', label: '0' },
        command: 'std.noop',
      },
      {
        type: 'button',
        id: 'problems',
        content: { type: 'text', label: '1' },
        command: 'std.noop',
      },
      {
        type: 'divider',
        id: 'divider-1',
      },
    ]);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'problems');
    assert.strictEqual(result[1].id, 'divider-1');
  });

  it('coerces string content and numeric text labels', () => {
    const result = normalizeStatusBarItems([
      {
        type: 'button',
        id: 'counts',
        content: [
          { type: 'icon', icon: 'std/status-bar/problems-error' },
          { type: 'text', label: 0 },
          'ok',
          12,
          { type: 'text', label: '1' },
        ],
        command: 'std.noop',
      },
    ]);
    assert.strictEqual(result.length, 1);
    const content = result[0].type === 'button' ? result[0].content : null;
    assert.deepStrictEqual(content, [
      { type: 'icon', icon: 'std/status-bar/problems-error' },
      { type: 'text', label: '0' },
      { type: 'text', label: 'ok' },
      { type: 'text', label: '1' },
    ]);
  });

  it('drops items that have no id or an unknown type', () => {
    const result = normalizeStatusBarItems([
      { type: 'button', content: { type: 'text', label: 'x' }, command: 'std.noop' },
      { type: 'widget', id: 'w', content: { type: 'text', label: 'x' } },
      { type: 'button', id: '', content: { type: 'text', label: 'x' }, command: 'std.noop' },
    ]);
    assert.deepStrictEqual(result, []);
  });
});

describe('StatusBarManager factory output', () => {
  it('does not concat-flatten an array-like factory return into numbered cells', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem('left', 'bad-factory', () => ({ 0: 0, 1: 1, length: 2 }) as unknown as never);
    manager.updateStatusBarItems([]);
    assert.deepStrictEqual(manager.serialize().items.left, []);
  });

  it('keeps a valid factory item after neighboring junk factories', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem('left', 'junk', () => [0, 1] as unknown as never);
    manager.registerStatusBarItem(
      'left',
      'good',
      () => [
        {
          type: 'button',
          id: 'problems',
          tooltip: '0 Errors, 0 Warnings',
          content: [
            { type: 'icon', icon: 'std/status-bar/problems-error' },
            { type: 'text', label: '0' },
            { type: 'icon', icon: 'std/status-bar/problems-warning' },
            { type: 'text', label: '0' },
          ],
          command: 'std.workbench.showProblemsPane',
        },
      ],
      50,
    );
    manager.updateStatusBarItems([]);
    const left = manager.serialize().items.left;
    assert.strictEqual(left.length, 1);
    assert.strictEqual(left[0].id, 'problems');
  });
});
