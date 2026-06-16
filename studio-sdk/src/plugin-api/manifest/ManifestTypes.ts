/**
 * Type definitions for the `bifrostStudio` section in a plugin's `package.json`.
 *
 * These mirror the runtime types in
 * `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts`
 * and are intended for plugin developer consumption (autocompletion, documentation).
 * Validation logic is NOT included here.
 */

// ─── Top-level manifest ─────────────────────────────────────────────

/**
 * The `bifrostStudio` object in a plugin's `package.json`.
 *
 * @example
 * ```json
 * {
 *   "bifrostStudio": {
 *     "apiVersion": "1.0.0",
 *     "activationEvents": ["onStartup"],
 *     "contributes": {
 *       "commands": [{ "id": "hello", "title": "Say Hello" }]
 *     }
 *   }
 * }
 * ```
 */
export interface BifrostStudioManifest {
  /** Required Studio Plugin API version (semver). Must be compatible with the running Studio. */
  apiVersion: string;
  /** Human-readable name shown in the Plugins pane. Falls back to `package.json` `name` if omitted. */
  displayName?: string;
  /** Short description of what the plugin does. */
  description?: string;
  /** Icon identifier displayed alongside the plugin name. */
  icon?: string;
  /** Events that trigger plugin activation. The plugin code is not loaded until one of these fires. */
  activationEvents?: ActivationEvent[];
  /** Declarative contributions the plugin registers on load (before `activate()` runs). */
  contributes?: ManifestContributions;
}

// ─── Contributions ──────────────────────────────────────────────────

/** All declarative contribution types a plugin can declare in its manifest. */
export interface ManifestContributions {
  /** Commands registered in the Studio's command system. */
  commands?: ManifestCommand[];
  /** Menu items keyed by menu location (e.g. `"editor/context"`, `"menubar/file"`). */
  menus?: Record<string, ManifestMenuItem[]>;
  /** Settings contributed to the Studio's settings system. */
  settings?: ManifestSetting[];
  /** Keyboard shortcuts bound to commands. */
  keybindings?: ManifestKeybinding[];
  /** Icon definitions: a map of icon ID to icon resource path. */
  icons?: Record<string, string>;
  /** Pane contributions that add webview-backed panels to the Studio layout. */
  panes?: ManifestPaneContribution[];
  /** Pane toggle buttons added to the menu bar for left-area pane access. */
  paneToggles?: ManifestPaneToggle[];
  /** Service task type registrations for BPMN service task handlers. */
  serviceTaskTypes?: ManifestServiceTaskType[];
  /** CSS theme contributions with custom property overrides. */
  themes?: ManifestTheme[];
}

// ─── Individual contribution types ──────────────────────────────────

/** A command contribution. The `id` is auto-namespaced to `plugin.<name>.<id>`. */
export interface ManifestCommand {
  /** Command identifier (namespaced automatically). */
  id: string;
  /** Human-readable title shown in the command palette and menus. */
  title: string;
  /** Icon identifier for the command (used in toolbars and menus). */
  icon?: string;
  /** Category prefix for grouping in the command palette (e.g. `"Git"`, `"Debug"`). */
  category?: string;
}

/** An entry in a menu contribution. References a command by its (namespaced) ID. */
export interface ManifestMenuItem {
  /** Full command ID to invoke when this menu item is selected. */
  command: string;
  /** Menu group for ordering (e.g. `"navigation"`, `"1_modification"`). */
  group?: string;
  /** Condition expression controlling visibility. */
  when?: string;
}

/** A setting contributed via the manifest. */
export interface ManifestSetting {
  /** Dot-separated setting key (e.g. `"myPlugin.theme"`). */
  key: string;
  /** Data type of the setting value. */
  type: 'boolean' | 'string' | 'number' | 'string[]' | 'object';
  /** Default value used when the setting has not been explicitly set. */
  default?: unknown;
  /** Human-readable description shown in the Settings editor. */
  description?: string;
  /** Category name for grouping in the Settings editor. */
  category?: string;
  /** Allowed values (rendered as a dropdown when applicable). */
  enum?: unknown[];
}

/**
 * Condition for when a keybinding is active.
 *
 * - `'*'` — always active
 * - `'editorFocused'` — any editor is focused
 * - `` `editorFocused:${documentTypeId}` `` — a specific editor document type is focused
 */
export type KeybindingWhenCondition = '*' | 'editorFocused' | `editorFocused:${string}`;

/** A keyboard shortcut bound to a command. */
export interface ManifestKeybinding {
  /** Full command ID to invoke. */
  command: string;
  /** Default key combination (e.g. `"Ctrl+Shift+P"`). */
  key: string;
  /** macOS-specific override. */
  mac?: string;
  /** Linux-specific override. */
  linux?: string;
  /** Windows-specific override. */
  windows?: string;
  /** Condition controlling when the keybinding is active. */
  when?: KeybindingWhenCondition;
}

/** A pane contribution that registers a webview-backed panel in the Studio layout. */
export interface ManifestPaneContribution {
  /** Pane identifier (namespaced automatically to `plugin.<name>.<id>`). */
  id: string;
  /** Title shown in the pane's tab header. */
  title: string;
  /** Layout area where the pane appears. */
  area: 'left' | 'right' | 'bottom';
  /** Group ID within the area. Panes in the same group share a tab bar. */
  groupId?: string;
  /** Icon identifier for the pane's tab. */
  icon?: string;
  /** Conditions controlling when the pane is visible. */
  visibleWhen?: {
    /** Only show when a document of this type is active. */
    documentType?: string;
    /** Only show when this boolean setting is truthy. */
    setting?: string;
  };
}

/** A menu bar toggle button that controls a pane's visibility. */
export interface ManifestPaneToggle {
  /** Unique identifier for the toggle (used as the menu bar item ID). */
  id: string;
  /** Icon identifier for the toggle button. */
  icon: string;
  /** Tooltip text displayed on hover. */
  tooltip: string;
  /** The pane area this toggle controls. */
  paneAreaId: 'left' | 'right' | 'bottom';
  /** The pane ID to select when clicked. */
  paneId: string;
  /** Insert after the menu bar item with this ID. Mutually exclusive with `insertBefore`. */
  insertAfter?: string;
  /** Insert before the menu bar item with this ID. Mutually exclusive with `insertAfter`. */
  insertBefore?: string;
}

/** A BPMN service task type registration. */
export interface ManifestServiceTaskType {
  /** The `implementation` value matched against BPMN service task elements. */
  implementation: string;
  /** Human-readable label shown in the modeler's service task type dropdown. */
  label: string;
}

/** A theme contribution with CSS custom property overrides. */
export interface ManifestTheme {
  /** Theme identifier (namespaced automatically to `plugin.<name>.<id>`). */
  id: string;
  /** Human-readable theme name shown in the Settings "Theme" dropdown. */
  label: string;
  /** Theme category — `'dark'` or `'light'`. Determines fallback on removal. */
  type: 'dark' | 'light';
  /**
   * CSS custom property overrides. Keys are token names — the leading
   * `--` prefix is auto-prepended if missing. Values must be valid CSS values.
   */
  tokens: Record<string, string>;
}

// ─── Activation events ──────────────────────────────────────────────

/**
 * Events that trigger plugin activation.
 *
 * - `'onStartup'` — activated when the Studio starts
 * - `'*'` — activated on any event (equivalent to `'onStartup'`)
 * - `` `onCommand:${commandId}` `` — activated when the specified command is first invoked
 * - `` `onDocumentType:${typeId}` `` — activated when a document of the specified type is opened
 * - `` `onUri:${pattern}` `` — activated when a document matching the URI pattern is opened
 * - `` `onSetting:${key}` `` — activated when the specified setting is accessed
 */
export type ActivationEvent =
  | `onCommand:${string}`
  | `onDocumentType:${string}`
  | `onUri:${string}`
  | `onSetting:${string}`
  | 'onStartup'
  | '*';
