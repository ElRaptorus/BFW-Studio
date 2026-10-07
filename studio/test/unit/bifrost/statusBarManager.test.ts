import { StatusBarManager } from '#bifrost/common/StatusBarManager';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function leftItems(manager: StatusBarManager) {
  manager.updateStatusBarItems([]);
  return manager.serialize().items.left;
}

describe('StatusBarManager factory output', () => {
  it('returns nothing when a factory returns null or undefined', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem('left', 'null-factory', () => null as unknown as never);
    manager.registerStatusBarItem('left', 'undefined-factory', () => undefined as unknown as never);
    assert.deepStrictEqual(leftItems(manager), []);
  });

  it('does not concat-flatten an array-like factory return into numbered cells', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem('left', 'bad-factory', () => ({ 0: 0, 1: 1, length: 2 }) as unknown as never);
    manager.registerStatusBarItem('left', 'numbers', () => [0, 1, 0, 1] as unknown as never);
    assert.deepStrictEqual(leftItems(manager), []);
  });

  it('wraps a single valid item that is not already in an array', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem(
      'left',
      'problems-factory',
      () =>
        ({
          type: 'button',
          id: 'problems',
          content: { type: 'text', label: '0' },
          command: 'std.noop',
        }) as unknown as never,
    );
    const left = leftItems(manager);
    assert.strictEqual(left.length, 1);
    assert.strictEqual(left[0].id, 'problems');
  });

  it('keeps valid items and drops duplicates by id', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem(
      'left',
      'duplicates',
      () =>
        [
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
        ] as unknown as never,
    );
    const left = leftItems(manager);
    assert.strictEqual(left.length, 2);
    assert.strictEqual(left[0].id, 'problems');
    assert.strictEqual(left[1].id, 'divider-1');
  });

  it('coerces string content and numeric text labels', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem(
      'left',
      'counts',
      () =>
        [
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
        ] as unknown as never,
    );
    const left = leftItems(manager);
    assert.strictEqual(left.length, 1);
    const content = left[0].type === 'button' ? left[0].content : null;
    assert.deepStrictEqual(content, [
      { type: 'icon', icon: 'std/status-bar/problems-error' },
      { type: 'text', label: '0' },
      { type: 'text', label: 'ok' },
      { type: 'text', label: '1' },
    ]);
  });

  it('drops items that have no id or an unknown type', () => {
    const manager = new StatusBarManager();
    manager.registerStatusBarItem(
      'left',
      'junk',
      () =>
        [
          { type: 'button', content: { type: 'text', label: 'x' }, command: 'std.noop' },
          { type: 'widget', id: 'w', content: { type: 'text', label: 'x' } },
          { type: 'button', id: '', content: { type: 'text', label: 'x' }, command: 'std.noop' },
        ] as unknown as never,
    );
    assert.deepStrictEqual(leftItems(manager), []);
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
    const left = leftItems(manager);
    assert.strictEqual(left.length, 1);
    assert.strictEqual(left[0].id, 'problems');
  });
});
