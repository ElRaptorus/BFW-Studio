import type { Bifrost } from '#bifrost/Bifrost';
import type { PluginPermissionStore } from '#bifrost/common/plugin-host/PluginPermissionStore';
import { PERMISSION_DISPLAY } from '#bifrost/common/plugin-host/permissions/PermissionDisplay';
import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';

import type { DialogContentObject } from '@evil/bifrost_fw_sdk';

function buildPermissionMarkdown(permissions: PluginPermission[]): string {
  const lines = ['This plugin requests the following permissions:\n'];
  for (const perm of permissions) {
    const info = PERMISSION_DISPLAY[perm];
    if (info != null) {
      lines.push(`${info.icon} **${info.label}**`);
      lines.push(`${info.description}\n`);
    }
  }
  return lines.join('\n');
}

function buildChangedPermissionsMarkdown(
  oldPermissions: PluginPermission[],
  newPermissions: PluginPermission[],
): string | null {
  const oldSet = new Set(oldPermissions);
  const newSet = new Set(newPermissions);

  const added = newPermissions.filter((perm) => !oldSet.has(perm));
  const removed = oldPermissions.filter((perm) => !newSet.has(perm));

  if (added.length === 0 && removed.length === 0) {
    return null;
  }

  const lines = ["**⚠ This plugin's permissions have changed since you last approved it.**\n"];

  if (added.length > 0) {
    lines.push('**New permissions:**');
    for (const perm of added) {
      const info = PERMISSION_DISPLAY[perm];
      if (info != null) {
        lines.push(`+ ${info.icon} ${info.label}`);
      }
    }
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('**Removed permissions:**');
    for (const perm of removed) {
      const info = PERMISSION_DISPLAY[perm];
      if (info != null) {
        lines.push(`- ~~${info.label}~~`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function showPermissionReviewDialog(
  bifrost: Bifrost,
  pluginDisplayName: string,
  pluginName: string,
  permissions: PluginPermission[],
  permissionStore: PluginPermissionStore,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || process.env.BFR_SKIP_PERMISSION_DIALOG === '1') {
    return true;
  }

  const showDialog = bifrost.settings.get('plugins.permissions.showDialogOnEnable') ?? true;
  if (!showDialog) {
    return true;
  }

  // Zero-permission plugins are silently allowed
  if (permissions.length === 0) {
    permissionStore.set(pluginName, [], true);
    return true;
  }

  // Previously trusted and permissions unchanged → skip
  if (permissionStore.isTrustedAndUnchanged(pluginName, permissions)) {
    return true;
  }

  // Build dialog content
  const content: DialogContentObject[] = [];

  // Check for changed permissions
  const existingRecord = permissionStore.get(pluginName);
  if (existingRecord != null) {
    const changeMd = buildChangedPermissionsMarkdown(existingRecord.permissions, permissions);
    if (changeMd != null) {
      content.push({ type: 'markdown', text: changeMd });
      content.push({ type: 'divider' });
    }
  }

  content.push({ type: 'markdown', text: buildPermissionMarkdown(permissions) });
  content.push({
    type: 'checkbox',
    id: 'trustPermanently',
    label: 'Trust this plugin permanently',
    checked: false,
  });

  const dialogResult = await bifrost.dialog.open({
    title: `Enable Plugin "${pluginDisplayName}"?`,
    content,
    actions: [
      { response: 'cancel', label: 'Cancel', cancel: true },
      { response: 'allow', label: 'Allow & Enable', default: true },
    ],
  });

  if (dialogResult?.response === 'allow') {
    const trustPermanently = dialogResult.formData?.trustPermanently === true;
    permissionStore.set(pluginName, permissions, trustPermanently);
    return true;
  }

  return false;
}
