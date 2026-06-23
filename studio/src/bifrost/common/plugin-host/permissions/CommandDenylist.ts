import type { PermissionGate } from './PermissionGate';
import type { PluginPermission } from './PermissionTypes';

/**
 * Command patterns that plugins are NEVER allowed to execute,
 * regardless of permissions. These are internal infrastructure
 * commands that should only be called by bundled Studio code.
 */
const HARD_DENIED: RegExp[] = [/^git\./, /^engine\./, /^plugins\./, /^dev\./];

const HARD_DENIED_SUBPATTERNS: RegExp[] = [/^std\.solution\./, /^std\.window\./, /^std\.internal\./, /^std\.test\./];

const PERMISSION_GATED = new Map<RegExp, PluginPermission>([
  [/^bpmn\.modeler\.registerModule$/, 'renderer-modules'],
  [/^dmn\.modeler\.registerModule$/, 'renderer-modules'],
]);

const GROUP_PERMISSION: Record<string, PluginPermission> = {
  std: 'commands.std',
  bpmn: 'commands.bpmn',
  dmn: 'commands.dmn',
};

export class CommandBlockedError extends Error {
  readonly pluginName: string;
  readonly commandId: string;

  constructor(pluginName: string, commandId: string) {
    super(`Plugin '${pluginName}': command '${commandId}' is blocked`);
    this.name = 'CommandBlockedError';
    this.pluginName = pluginName;
    this.commandId = commandId;
  }
}

export function checkCommandAccess(commandId: string, pluginName: string, permissionGate: PermissionGate): void {
  for (const pattern of HARD_DENIED) {
    if (pattern.test(commandId)) {
      throw new CommandBlockedError(pluginName, commandId);
    }
  }

  for (const pattern of HARD_DENIED_SUBPATTERNS) {
    if (pattern.test(commandId)) {
      throw new CommandBlockedError(pluginName, commandId);
    }
  }

  for (const [pattern, permission] of PERMISSION_GATED) {
    if (pattern.test(commandId)) {
      permissionGate.assert(pluginName, permission, commandId);
      return;
    }
  }

  if (commandId.startsWith(`plugin.${pluginName}.`)) {
    return;
  }

  if (commandId.startsWith('plugin.')) {
    permissionGate.assert(pluginName, 'commands.plugins', commandId);
    return;
  }

  const group = commandId.split('.')[0];
  const requiredPermission = GROUP_PERMISSION[group];
  if (requiredPermission) {
    permissionGate.assert(pluginName, requiredPermission, commandId);
    return;
  }

  throw new CommandBlockedError(pluginName, commandId);
}

/**
 * Non-throwing check for filtering `getCommands()` results.
 */
export function canAccessCommand(commandId: string, pluginName: string, permissionGate: PermissionGate): boolean {
  try {
    checkCommandAccess(commandId, pluginName, permissionGate);
    return true;
  } catch {
    return false;
  }
}
