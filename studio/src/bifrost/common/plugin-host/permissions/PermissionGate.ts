import { PERMISSION_HIERARCHY, type PluginPermission, type PluginPermissionSet } from './PermissionTypes';

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

/**
 * Expands declared permissions by resolving hierarchy rules.
 * For example, declaring 'bpmn.renderer' also grants 'bpmn.modelling' and 'bpmn'.
 */
function expandPermissions(declared: PluginPermission[]): Set<PluginPermission> {
  const expanded = new Set<PluginPermission>(declared);
  for (const permission of declared) {
    const implied = PERMISSION_HIERARCHY[permission];
    if (implied != null) {
      for (const impliedPermission of implied) {
        expanded.add(impliedPermission);
      }
    }
  }
  return expanded;
}

class DefaultPermissionSet implements PluginPermissionSet {
  readonly pluginName: string;
  readonly granted: ReadonlySet<PluginPermission>;

  constructor(pluginName: string, permissions: PluginPermission[]) {
    this.pluginName = pluginName;
    this.granted = expandPermissions(permissions);
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
