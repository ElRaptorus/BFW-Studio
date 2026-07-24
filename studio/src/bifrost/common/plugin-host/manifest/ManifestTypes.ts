// ────────────────────────────────────────────────────────────────
// Manifest Types — Phase 4: Declarative Contribution Model
// ────────────────────────────────────────────────────────────────
import type { PluginPermission } from '../permissions/PermissionTypes';

export interface BifrostStudioManifest {
  apiVersion: string;
  displayName?: string;
  description?: string;
  icon?: string;
  activationEvents?: ActivationEvent[];
  contributes?: ManifestContributions;
  permissions?: PluginPermission[];
}

export interface ManifestContributions {
  commands?: ManifestCommand[];
  menus?: Record<string, ManifestMenuItem[]>;
  settings?: ManifestSetting[];
  keybindings?: ManifestKeybinding[];
  icons?: Record<string, string>;
  panes?: ManifestPaneContribution[];
  paneToggles?: ManifestPaneToggle[];
  serviceTaskTypes?: ManifestServiceTaskType[];
  themes?: ManifestTheme[];
  bpmnPalette?: ManifestBpmnPaletteEntry[];
  bpmnContextPad?: ManifestBpmnContextPadEntry[];
  bpmnModules?: ManifestBpmnModule[];
  dmnPalette?: ManifestDmnPaletteEntry[];
  dmnContextPad?: ManifestDmnContextPadEntry[];
  dmnModules?: ManifestDmnModule[];
}

export interface ManifestBpmnModule {
  entry: string;
  description?: string;
}

export interface ManifestDmnModule {
  entry: string;
  description?: string;
}

export interface ManifestCommand {
  id: string;
  title: string;
  icon?: string;
  category?: string;
}

export interface ManifestMenuItem {
  command: string;
  group?: string;
  when?: string;
}

export interface ManifestSetting {
  key: string;
  type: 'boolean' | 'string' | 'number' | 'string[]' | 'object';
  default?: unknown;
  description?: string;
  category?: string;
  enum?: unknown[];
}

export type KeybindingWhenCondition = '*' | 'editorFocused' | `editorFocused:${string}`;

export interface ManifestKeybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  windows?: string;
  when?: KeybindingWhenCondition;
}

export interface ManifestPaneContribution {
  id: string;
  title: string;
  area: 'left' | 'right' | 'bottom';
  groupId?: string;
  icon?: string;
  visibleWhen?: { documentType?: string; setting?: string };
}

export interface ManifestServiceTaskType {
  implementation: string;
  label: string;
}

export interface ManifestBpmnPaletteEntry {
  id: string;
  group?: string;
  icon: string;
  title: string;
  command: string;
}

export interface ManifestBpmnContextPadEntry {
  id: string;
  icon: string;
  title: string;
  command: string;
  elementTypes?: string[];
}

export interface ManifestDmnPaletteEntry {
  id: string;
  group?: string;
  icon: string;
  title: string;
  command: string;
}

export interface ManifestDmnContextPadEntry {
  id: string;
  icon: string;
  title: string;
  command: string;
  elementTypes?: string[];
}

export interface ManifestPaneToggle {
  id: string;
  icon: string;
  tooltip: string;
  paneAreaId: 'left' | 'right' | 'bottom';
  paneId: string;
  insertAfter?: string;
  insertBefore?: string;
}

export interface ManifestTheme {
  id: string;
  label: string;
  type: 'dark' | 'light';
  tokens: Record<string, string>;
}

export type ActivationEvent =
  `onCommand:${string}` | `onDocumentType:${string}` | `onUri:${string}` | `onSetting:${string}` | 'onStartup' | '*';

export interface ManifestReadResult {
  manifest: BifrostStudioManifest | null;
  errors: ManifestError[];
  warnings: ManifestWarning[];
}

export interface ManifestError {
  path: string;
  message: string;
}

export interface ManifestWarning {
  path: string;
  message: string;
}
