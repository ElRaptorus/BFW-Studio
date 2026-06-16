import type { PluginPermission, PluginPermissionSet } from './PermissionTypes';

export class PermissionDeniedError extends Error {
  readonly pluginName: string;
  readonly permission: PluginPermission | string;

  constructor(pluginName: string, permission: PluginPermission | string, context?: string) {
    const contextSuffix = context != null ? ` (${context})` : '';
    super(`Plugin '${pluginName}': permission '${permission}' denied${contextSuffix}`);
    this.name = 'PermissionDeniedError';
    this.pluginName = pluginName;
    this.permission = permission;
  }
}

class DefaultPermissionSet implements PluginPermissionSet {
  readonly pluginName: string;
  readonly granted: ReadonlySet<PluginPermission>;

  constructor(pluginName: string, permissions: PluginPermission[]) {
    this.pluginName = pluginName;
    this.granted = new Set(permissions);
  }

  has(permission: PluginPermission): boolean {
    return this.granted.has(permission);
  }
}

export class PermissionGate {
  private permissionsByPlugin = new Map<string, PluginPermissionSet>();

  register(pluginName: string, permissions: PluginPermission[]): void {
    this.permissionsByPlugin.set(pluginName, new DefaultPermissionSet(pluginName, permissions));
  }

  unregister(pluginName: string): void {
    this.permissionsByPlugin.delete(pluginName);
  }

  getPermissions(pluginName: string): PluginPermissionSet | undefined {
    return this.permissionsByPlugin.get(pluginName);
  }

  /**
   * Throws PermissionDeniedError if the plugin lacks the required permission.
   */
  assert(pluginName: string, permission: PluginPermission, context: string): void {
    const permSet = this.permissionsByPlugin.get(pluginName);
    if (permSet == null || !permSet.has(permission)) {
      throw new PermissionDeniedError(pluginName, permission, context);
    }
  }
}
