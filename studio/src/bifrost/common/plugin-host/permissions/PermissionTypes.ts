/**
 * Group-scoped capability identifiers. A plugin must declare each permission
 * it needs in its manifest. Undeclared capabilities are denied at runtime.
 *
 * Commands in engine.*, git.*, plugins.*, and dev.* groups are unconditionally
 * hard-denied — no permission can grant access.
 */
export type PluginPermission =
  | 'filesystem'
  | 'commands.std'
  | 'commands.bpmn'
  | 'commands.dmn'
  | 'renderer-modules'
  | 'native'
  | 'system-info';

export const ALL_PERMISSIONS: readonly PluginPermission[] = [
  'filesystem',
  'commands.std',
  'commands.bpmn',
  'commands.dmn',
  'renderer-modules',
  'native',
  'system-info',
] as const;

export interface PluginPermissionSet {
  readonly pluginName: string;
  readonly granted: ReadonlySet<PluginPermission>;
  has(permission: PluginPermission): boolean;
}
