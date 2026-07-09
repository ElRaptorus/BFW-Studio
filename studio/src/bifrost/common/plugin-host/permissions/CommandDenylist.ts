import type { Bifrost } from '#bifrost/Bifrost';

import { getClosestMatch } from '@evil/bifrost_fw_sdk';

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
  [/^bpmn\.modeler\.registerModule$/, 'bpmn.renderer'],
  [/^dmn\.modeler\.registerModule$/, 'dmn.renderer'],
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

export function checkCommandAccess(
  bifrost: Bifrost,
  commandId: string,
  pluginName: string,
  permissionGate: PermissionGate,
): void {
  for (const pattern of HARD_DENIED) {
    if (pattern.test(commandId)) {
      throw new CommandBlockedError(pluginName, commandId);
    }
  }

  // NOTE:
  // The "not found error" is actually intentional.
  // Throwing a "Blocked" Error would tell potential malware plugins, that the command they try to access actually exists.
  // So instead, we throw the same kind of error a user would get when trying to execute a non-existent command.
  for (const pattern of HARD_DENIED_SUBPATTERNS) {
    if (pattern.test(commandId)) {
      const commandNames = bifrost.commands.getCommands().map((command) => command.name);
      const suggestion = getClosestMatch(commandId, commandNames);

      throw new Error(`Command '${name}' is not registered. Did you mean '${suggestion}'?`);
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
export function canAccessCommand(
  bifrost: Bifrost,
  commandId: string,
  pluginName: string,
  permissionGate: PermissionGate,
): boolean {
  try {
    checkCommandAccess(bifrost, commandId, pluginName, permissionGate);
    return true;
  } catch {
    return false;
  }
}
