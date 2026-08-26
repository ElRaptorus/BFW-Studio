/**
 * Group-scoped capability identifiers. A plugin must declare each permission
 * it needs in its manifest. Undeclared capabilities are denied at runtime.
 *
 * BPMN permissions form a hierarchy: `'bpmn.renderer'` implies `'bpmn.modelling'`
 * implies `'bpmn'`. DMN permissions mirror the same hierarchy.
 *
 * Hierarchy helpers (`PERMISSION_HIERARCHY`, `ALL_PERMISSIONS`) live in
 * `studio/src/bifrost/common/plugin-host/permissions/PermissionTypes.ts` —
 * Studio remains canonical for those.
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
