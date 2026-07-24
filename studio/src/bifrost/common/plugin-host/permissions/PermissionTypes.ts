/**
 * Group-scoped capability identifiers. A plugin must declare each permission
 * it needs in its manifest. Undeclared capabilities are denied at runtime.
 *
 * Commands in engine.*, git.*, plugins.*, and dev.* groups are unconditionally
 * hard-denied — no permission can grant access.
 *
 * BPMN permissions form a hierarchy: 'bpmn.renderer' implies 'bpmn.modelling'
 * implies 'bpmn'. A plugin only needs to declare the highest tier it requires.
 * DMN permissions mirror the same hierarchy: 'dmn.renderer' implies
 * 'dmn.modelling' implies 'dmn'.
 */
export type PluginPermission =
  | 'filesystem'
  | 'commands.std'
  | 'commands.bpmn'
  | 'commands.dmn'
  | 'commands.plugins'
  | 'bpmn'
  | 'bpmn.modelling'
  | 'bpmn.renderer'
  | 'dmn'
  | 'dmn.modelling'
  | 'dmn.renderer'
  | 'native'
  | 'system-info';

export const ALL_PERMISSIONS: readonly PluginPermission[] = [
  'filesystem',
  'commands.std',
  'commands.bpmn',
  'commands.dmn',
  'commands.plugins',
  'bpmn',
  'bpmn.modelling',
  'bpmn.renderer',
  'dmn',
  'dmn.modelling',
  'dmn.renderer',
  'native',
  'system-info',
] as const;

/**
 * Hierarchy rules for permissions that imply lower-tier permissions.
 * Key: the declared permission. Value: permissions it implicitly grants.
 */
export const PERMISSION_HIERARCHY: Partial<Record<PluginPermission, PluginPermission[]>> = {
  'bpmn.renderer': ['bpmn.modelling', 'bpmn'],
  'bpmn.modelling': ['bpmn'],
  'dmn.renderer': ['dmn.modelling', 'dmn'],
  'dmn.modelling': ['dmn'],
};

export interface PluginPermissionSet {
  readonly pluginName: string;
  readonly granted: ReadonlySet<PluginPermission>;
  has(permission: PluginPermission): boolean;
}
