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
  'commands.plugins': {
    label: 'Cross-Plugin Commands',
    description: 'Execute commands registered by other plugins.',
    warningLevel: 'high',
    icon: '⚠',
  },
  bpmn: {
    label: 'BPMN Editor Access',
    description: 'Read BPMN element data, subscribe to editor events, and place overlays on diagram elements.',
    warningLevel: 'low',
    icon: 'ℹ',
  },
  'bpmn.modelling': {
    label: 'BPMN Modelling',
    description:
      'Modify the BPMN diagram: update element properties, add/remove elements, and contribute palette and context pad entries.',
    warningLevel: 'medium',
    icon: '⚠',
  },
  'bpmn.renderer': {
    label: 'BPMN Renderer Module Injection',
    description:
      'Inject custom diagram-js modules directly into the BPMN editor renderer. Has full access to all diagram-js services.',
    warningLevel: 'high',
    icon: '⚠',
  },
  'renderer-modules': {
    label: 'Editor Integration (Legacy)',
    description: 'Inject code into the BPMN/DMN editor. Superseded by bpmn.renderer.',
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
