import assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';

import { PluginPermissionStore } from '../../../src/bifrost/common/plugin-host/PluginPermissionStore';
import type { PluginPermission } from '../../../src/bifrost/common/plugin-host/permissions/PermissionTypes';

class FakeLocalStorageItem {
  private data: string | null = null;

  save(serializableData: any): void {
    this.data = JSON.stringify(serializableData);
  }

  load(): any {
    if (this.data == null) {
      return null;
    }
    return JSON.parse(this.data);
  }

  clear(): void {
    this.data = null;
  }
}

describe('PluginPermissionStore', () => {
  let storage: FakeLocalStorageItem;
  let store: PluginPermissionStore;

  beforeEach(() => {
    storage = new FakeLocalStorageItem();
    store = new PluginPermissionStore(storage as any);
  });

  describe('get / set / remove', () => {
    it('returns null for unknown plugin', () => {
      assert.strictEqual(store.get('unknown'), null);
    });

    it('persists and retrieves a record', () => {
      const perms: PluginPermission[] = ['filesystem', 'commands.std'];
      store.set('my-plugin', perms, true);

      const record = store.get('my-plugin');
      assert.ok(record != null);
      assert.deepStrictEqual(record.permissions, ['commands.std', 'filesystem']);
      assert.strictEqual(record.trusted, true);
    });

    it('normalizes permissions (sort + dedupe)', () => {
      store.set('my-plugin', ['commands.bpmn', 'filesystem', 'commands.bpmn'], true);
      const record = store.get('my-plugin');
      assert.deepStrictEqual(record!.permissions, ['commands.bpmn', 'filesystem']);
    });

    it('removes a record', () => {
      store.set('my-plugin', ['filesystem'], false);
      store.remove('my-plugin');
      assert.strictEqual(store.get('my-plugin'), null);
    });

    it('remove is a no-op for unknown plugin', () => {
      store.remove('unknown');
      assert.strictEqual(store.get('unknown'), null);
    });

    it('stores multiple plugins independently', () => {
      store.set('a', ['filesystem'], true);
      store.set('b', ['native'], false);

      assert.deepStrictEqual(store.get('a')!.permissions, ['filesystem']);
      assert.deepStrictEqual(store.get('b')!.permissions, ['native']);
      assert.strictEqual(store.get('a')!.trusted, true);
      assert.strictEqual(store.get('b')!.trusted, false);
    });
  });

  describe('isTrustedAndUnchanged', () => {
    it('returns false for unknown plugin', () => {
      assert.strictEqual(store.isTrustedAndUnchanged('unknown', ['filesystem']), false);
    });

    it('returns false when not trusted', () => {
      store.set('my-plugin', ['filesystem'], false);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['filesystem']), false);
    });

    it('returns true when trusted and permissions match', () => {
      store.set('my-plugin', ['filesystem', 'commands.std'], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['commands.std', 'filesystem']), true);
    });

    it('returns true regardless of input order', () => {
      store.set('my-plugin', ['commands.std', 'filesystem'], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['filesystem', 'commands.std']), true);
    });

    it('returns false when permissions added', () => {
      store.set('my-plugin', ['filesystem'], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['filesystem', 'native']), false);
    });

    it('returns false when permissions removed', () => {
      store.set('my-plugin', ['filesystem', 'native'], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['filesystem']), false);
    });

    it('returns false when permissions completely different', () => {
      store.set('my-plugin', ['filesystem'], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['native']), false);
    });

    it('handles empty permissions correctly', () => {
      store.set('my-plugin', [], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', []), true);
    });

    it('detects change from empty to non-empty', () => {
      store.set('my-plugin', [], true);
      assert.strictEqual(store.isTrustedAndUnchanged('my-plugin', ['filesystem']), false);
    });
  });

  describe('zero-permission plugin', () => {
    it('stores and retrieves zero-permission trust', () => {
      store.set('simple-plugin', [], true);
      const record = store.get('simple-plugin');
      assert.ok(record != null);
      assert.deepStrictEqual(record.permissions, []);
      assert.strictEqual(record.trusted, true);
    });
  });

  describe('corrupted storage', () => {
    it('handles null storage gracefully', () => {
      assert.strictEqual(store.get('anything'), null);
      assert.strictEqual(store.isTrustedAndUnchanged('anything', []), false);
    });

    it('handles non-object storage gracefully', () => {
      storage.save('not-an-object');
      assert.strictEqual(store.get('anything'), null);
    });

    it('handles array storage gracefully', () => {
      storage.save([1, 2, 3]);
      assert.strictEqual(store.get('anything'), null);
    });
  });
});
