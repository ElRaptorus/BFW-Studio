import type { PluginPermission } from './PermissionTypes';

export interface PermissionDisplayInfo {
  label: string;
  description: string;
  warningLevel: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
}

export const PERMISSION_DISPLAY: Record<PluginPermission, PermissionDisplayInfo> = {
  filesystem: {
    label: 'File System Access',
    description: 'Read and write files in your project folders.',
    warningLevel: 'medium',
    icon: '⚠',
  },
  'commands.std': {
    label: 'Studio Commands',
    description: 'Execute standard workbench, editor, and UI commands.',
    warningLevel: 'medium',
    icon: '⚠',
  },
  'commands.bpmn': {
    label: 'BPMN Commands',
    description: 'Execute BPMN editor, diff, and linter commands.',
    warningLevel: 'medium',
    icon: '⚠',
  },
  'commands.dmn': {
    label: 'DMN Commands',
    description: 'Execute DMN editor and diff commands.',
    warningLevel: 'medium',
    icon: '⚠',
  },
  'renderer-modules': {
    label: 'Editor Integration',
    description: 'Inject code into the BPMN/DMN editor.',
    warningLevel: 'high',
    icon: '⚠',
  },
  native: {
    label: 'Native Code',
    description: 'Load compiled native modules. Bypasses sandboxing entirely.',
    warningLevel: 'critical',
    icon: '🔴',
  },
  'system-info': {
    label: 'System Information',
    description: 'Read basic OS info (platform, architecture).',
    warningLevel: 'low',
    icon: 'ℹ',
  },
};
