import type { LocalStorageItem } from '#bifrost/common/LocalStorageItem';
import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';

export interface PluginPermissionRecord {
  /** Sorted array of PluginPermission strings that were approved. */
  permissions: PluginPermission[];
  /** Whether the user ticked "Trust permanently". */
  trusted: boolean;
}

type PersistedData = Record<string, PluginPermissionRecord>;

function normalize(permissions: PluginPermission[]): PluginPermission[] {
  return [...new Set(permissions)].sort();
}

/**
 * Persists per-plugin permission trust records in local storage.
 *
 * Used by the permission review dialog to decide whether to prompt the
 * user and to detect permission-set changes between plugin versions.
 */
export class PluginPermissionStore {
  private storage: LocalStorageItem;

  constructor(storage: LocalStorageItem) {
    this.storage = storage;
  }

  get(pluginName: string): PluginPermissionRecord | null {
    const data = this.loadAll();
    return data[pluginName] ?? null;
  }

  set(pluginName: string, permissions: PluginPermission[], trusted: boolean): void {
    const data = this.loadAll();
    data[pluginName] = { permissions: normalize(permissions), trusted };
    this.storage.save(data);
  }

  remove(pluginName: string): void {
    const data = this.loadAll();
    if (pluginName in data) {
      delete data[pluginName];
      this.storage.save(data);
    }
  }

  /**
   * Returns `true` when the plugin has a stored record, is trusted,
   * and the stored permission set matches `currentPermissions` exactly.
   */
  isTrustedAndUnchanged(pluginName: string, currentPermissions: PluginPermission[]): boolean {
    const record = this.get(pluginName);
    if (record == null || !record.trusted) {
      return false;
    }

    const stored = record.permissions;
    const current = normalize(currentPermissions);

    if (stored.length !== current.length) {
      return false;
    }

    return stored.every((perm, idx) => perm === current[idx]);
  }

  private loadAll(): PersistedData {
    const raw = this.storage.load();
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return raw as PersistedData;
  }
}
