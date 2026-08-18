// ─── Menu bar types ─────────────────────────────────────────────────
import type { MenuBarItem } from '../contracts/MenuBarTypes';
import type { MenuItem } from '../contracts/MenuTypes';
import type { SettingDescriptor } from '../contracts/SettingTypes';

// ─── Command types ──────────────────────────────────────────────────

/**
 * Options for registering a plugin command via `api.commands.register()`.
 */
export interface PluginCommandOptions {
  /** Human-readable description (or array of search aliases) shown in the command palette. */
  description?: string | string[];
  /** If `true`, the command appears in the command search palette. Defaults to `false`. */
  visibleInSearch?: boolean;
}

/**
 * Serializable version of a command result for cross-process transfer.
 * Error objects are converted to plain objects with `message` and optional `stack`.
 */
export type SerializedCommandResult<T = unknown> =
  { success: true; returnValue: T } | { success: false; error: { message: string; stack?: string } };

/**
 * Serializable subset of a registered command, stripped of non-transferable
 * fields (callback functions, enabled predicates).
 */
export interface SerializedCommandInfo {
  name: string;
  description: string;
  visibleInSearch: boolean;
}

// ─── Notification types ─────────────────────────────────────────────

/** Options for {@link NotificationsApi.open}. */
export interface PluginNotificationOpenOptions {
  /** Severity level of the notification. */
  type: 'info' | 'warning' | 'error';
  /** Text content shown in the notification toast. */
  content: string;
  /** Display name of the notification source. Defaults to the plugin name when omitted. */
  origin?: string;
  /** Action buttons shown alongside the notification content. */
  actions?: PluginNotificationAction[];
  /** If `true`, the notification stays visible until explicitly closed. */
  sticky?: boolean;
}

/** An action button on a notification toast. */
export interface PluginNotificationAction {
  /** Identifier passed to the response callback when this action is clicked. */
  action: string;
  /** Button label. */
  label: string;
  /** If `true`, this action is triggered by pressing Enter. */
  default?: boolean;
}

/** Payload delivered to a notification response callback. */
export interface PluginNotificationResponse {
  /** The `action` string from the clicked {@link PluginNotificationAction}. */
  action: string;
  /** The button label. */
  label: string;
}

/** Options for {@link NotificationsApi.update}. Only provided fields are changed. */
export interface PluginNotificationUpdateOptions {
  content?: string;
}

// ─── Settings types ─────────────────────────────────────────────────

/**
 * A map of setting keys to their descriptors, passed to {@link SettingsApi.register}.
 *
 * Each key is a dot-separated setting path (e.g. `"myPlugin.theme"`),
 * and the value is a {@link SettingDescriptor} that defines the setting's
 * type, default value, label, and validation constraints.
 */
export type SettingDescriptorMap = Record<string, SettingDescriptor>;

// ─── Webview panel types ────────────────────────────────────────────

/** Options for {@link WebviewApi.createPanel}. */
export interface WebviewPanelOptions {
  /** Title shown in the panel's tab or header. */
  title: string;
  /** Relative path to the webview's HTML entry point (resolved from the plugin directory). */
  entryPoint: string;
  /** Directories the webview is allowed to load local resources from. */
  localResourceRoots?: string[];
}

// ─── Editor document type types ─────────────────────────────────────

/** Webview options embedded in {@link RegisterWebviewDocumentTypeOptions}. */
export interface WebviewDocumentTypeWebviewOptions {
  /** Relative path to the webview's HTML entry point. */
  entryPoint: string;
  /** Directories the webview is allowed to load local resources from. */
  localResourceRoots?: string[];
}

/** Options for {@link EditorsApi.registerWebviewDocumentType}. */
export interface RegisterWebviewDocumentTypeOptions {
  /** Unique identifier for this document type (namespaced automatically to `plugin.<name>.<id>`). */
  id: string;
  /** Human-readable name shown in the editor tab. */
  displayName: string;
  /** Icon identifier for the document type. */
  icon: string;
  /** URI pattern that determines which documents this type handles (e.g. `"*.myext"`). */
  uriPattern: string;
  /** Webview configuration for the editor surface. */
  webviewOptions: WebviewDocumentTypeWebviewOptions;
  /** Called when a document of this type is opened. Receives the iframe ID and document URI. */
  onDidOpen?: (iframeId: string, uri: string) => void;
  /**
   * Glob patterns (e.g. `["**\/*.md"]`) for files this document type handles that should be
   * shown in the File Explorer by default, without the user having to enable "Show hidden files".
   *
   * Equivalent to the internal-module-only `studio.solution.registerDefaultIncludedFiles()` API.
   * The File Explorer's default view only shows files matching *some* registered include pattern
   * (from any module or plugin) — an editor document type with no matching include pattern here
   * means files it handles stay hidden by default even though they can be opened.
   *
   * Automatically unregistered when the plugin is disabled, reloaded, or uninstalled.
   */
  includedFilePatterns?: string[];
}

/**
 * Declarative config for {@link MenuBarApi.registerMenuBarItemModifier}.
 *
 * Expresses the same `insertAfter` / `insertBefore` positioning intent
 * that internal modules achieve with modifier closures.
 */
export interface MenuBarItemModifierConfig {
  /** Insert items after the menu bar item with this ID. Mutually exclusive with `insertBefore`. */
  insertAfter?: string;
  /** Insert items before the menu bar item with this ID. Mutually exclusive with `insertAfter`. */
  insertBefore?: string;
  /** The items to insert. */
  items: MenuBarItem[];
}

/**
 * Positioning specification for {@link MenuModifierConfig}.
 */
export type MenuModifierPosition =
  | { type: 'append' }
  | { type: 'prepend' }
  | { type: 'appendToSubmenu'; submenuId: string }
  | { type: 'prependToSubmenu'; submenuId: string }
  | { type: 'insertAfter'; id: string }
  | { type: 'insertBefore'; id: string };

/**
 * Declarative config for {@link MenusApi.registerMenuModifier}.
 */
export interface MenuModifierConfig {
  /** The menu items to add. */
  items: MenuItem[];
  /** Where to place the items. Defaults to `{ type: 'append' }`. */
  position?: MenuModifierPosition;
}

// ─── Status bar types ───────────────────────────────────────────────

/**
 * Handle returned by {@link StatusBarApi.showProgress}.
 *
 * The handle is a proxy — `update` and `done` cross the IPC boundary
 * to operate on the real `ProgressHandle` held by the bridge.
 */
export interface PluginProgressHandle {
  /** Replace the progress label text. */
  update(label: string): void;
  /** Complete and remove the progress indicator. */
  done(): void;
}

// ─── Diagnostics types ──────────────────────────────────────────────

/** Severity levels for plugin diagnostics. */
export type PluginDiagnosticSeverity = 'error' | 'warning' | 'info';

/** A diagnostic item contributed by a plugin. */
export interface PluginDiagnostic {
  /** Severity level. */
  severity: PluginDiagnosticSeverity;
  /** Human-readable diagnostic message. */
  message: string;
}

/** Aggregate counts returned by {@link DiagnosticsApi.getCount}. */
export interface PluginDiagnosticCounts {
  errors: number;
  warnings: number;
  infos: number;
}

// ─── Pane types ─────────────────────────────────────────────────────

/** Webview options embedded in {@link RegisterWebviewPaneOptions}. */
export interface WebviewPaneWebviewOptions {
  /** Relative path to the webview's HTML entry point. */
  entryPoint: string;
  /** Directories the webview is allowed to load local resources from. */
  localResourceRoots?: string[];
}

/** Options for {@link PanesApi.registerWebviewPane}. */
export interface RegisterWebviewPaneOptions {
  /** Unique identifier for this pane (namespaced automatically to `plugin.<name>.<id>`). */
  id: string;
  /** Title shown in the pane's tab header. */
  title: string;
  /** Layout area where the pane is placed. */
  area: 'left' | 'bottom' | 'right';
  /** Group ID within the area. Panes in the same group share a tab bar. */
  groupId?: string;
  /** Icon identifier for the pane's tab. */
  icon?: string;
  /** Webview configuration for the pane content. */
  webviewOptions: WebviewPaneWebviewOptions;
}

// ─── Dialog types ───────────────────────────────────────────────────

/** Options for {@link DialogsApi.open}. */
export interface PluginDialogOpenOptions {
  /** Dialog title. */
  title: string;
  /** Content items defining the dialog body (form fields, text, sections, etc.). */
  content: PluginDialogContentItem[];
  /** Action buttons at the bottom of the dialog. */
  actions: PluginDialogAction[];
  /** Optional CSS class name for additional styling. */
  className?: string;
  /** If `true`, the close (X) button in the top-right corner is hidden. */
  hideCloseButton?: boolean;
}

/**
 * A dialog content item. Matches the serializable subset of the
 * internal `DialogContentObject` union.
 */
export type PluginDialogContentItem =
  | {
      type: 'text_input';
      id: string;
      label?: string;
      value?: string;
      placeholder?: string;
      focus?: boolean;
      multiline?: boolean;
      hint?: string;
    }
  | {
      type: 'select';
      id: string;
      label?: string;
      value?: string;
      entries: { label: string; value: string }[];
      hint?: string;
    }
  | { type: 'checkbox'; id: string; label?: string; checked?: boolean }
  | { type: 'text'; text: string }
  | { type: 'section'; text: string }
  | { type: 'divider' }
  | { type: 'markdown'; text: string }
  | { type: 'markdown_container'; id: string; text?: string; size?: 'small' | 'medium' | 'tall' | 'huge' }
  | {
      type: 'json';
      id: string;
      label?: string;
      language?: string;
      value?: string;
      focus?: boolean;
      size?: 'small' | 'medium' | 'tall';
      readOnly?: boolean;
      hint?: string;
    }
  | {
      type: 'diff';
      id: string;
      label?: string;
      language?: string;
      beforeValue?: string;
      afterValue?: string;
      size?: 'small' | 'medium' | 'tall';
      readOnly?: boolean;
      hint?: string;
    }
  | { type: 'response_link'; label: string; sublabel?: string; icon?: string; response: string }
  | {
      type: 'path_list';
      id: string;
      label?: string;
      mode: 'file' | 'directory';
      initialValue?: string[];
      hint?: string;
    }
  | {
      type: 'path_picker';
      id: string;
      label?: string;
      mode: 'file' | 'directory';
      placeholder?: string;
      initialValue?: string;
      hint?: string;
    }
  | {
      type: 'key_value_builder';
      id: string;
      label?: string;
      keyLabel?: string;
      valueLabel?: string;
      keyPlaceholder?: string;
      valuePlaceholder?: string;
      initialEntries?: { key: string; value: string }[];
      hint?: string;
      optional?: boolean;
    };

/** An action button on a dialog. */
export interface PluginDialogAction {
  /** Response identifier returned in {@link PluginDialogResult.response}. */
  response: string;
  /** Button label. */
  label: string;
  /** If `true`, this action is the default (Enter key). */
  default?: boolean;
  /** If `true`, this action cancels the dialog (Escape key). */
  cancel?: boolean;
  /** If `true`, the button is styled as dangerous/destructive. */
  dangerous?: boolean;
}

/** Result from {@link DialogsApi.open}. */
export interface PluginDialogResult {
  /** `true` if the dialog was dismissed via cancel action or close button. */
  wasCancelled: boolean;
  /** The `response` string from the chosen action. */
  response?: string;
  /** Form data collected from content items, keyed by content item `id`. */
  formData?: Record<string, unknown>;
}

// ─── Workspace / File System types ──────────────────────────────

/** File or directory metadata returned by {@link WorkspaceApi.stat}. */
export interface FileStat {
  /** `true` if the path points to a directory. */
  isDirectory: boolean;
  /** `true` if the path points to a regular file. */
  isFile: boolean;
  /** `true` if the path exists on disk. */
  exists: boolean;
}

/** Type of change detected by a file watcher. */
export type FileChangeType = 'created' | 'changed' | 'deleted';

/** Event payload delivered by {@link WorkspaceApi.onDidChangeFile}. */
export interface FileChangeEvent {
  /** The kind of change that occurred. */
  type: FileChangeType;
  /** The `file://` URI of the affected file or directory. */
  uri: string;
}

/** A project folder in the current solution. */
export interface ProjectFolder {
  /** The `file://` URI of the project root directory. */
  uri: string;
  /** Human-readable project name. */
  name: string;
}

/** An entry returned by {@link WorkspaceApi.listDirectory}. */
export interface FileListEntry {
  /** File or directory name (basename only). */
  name: string;
  /** Full `file://` URI. */
  uri: string;
  /** Whether this entry is a file or directory. */
  type: 'file' | 'directory';
}

// ─── Tree view types ────────────────────────────────────────────

/** Item types supported by plugin tree views. */
export type PluginTreeItemType = 'directory' | 'file' | 'section' | 'property';

/** A badge displayed alongside a tree item label. */
export type PluginTreeBadge =
  { type: 'character'; character: string } | { type: 'icon'; icon: string } | { type: 'number'; number: number };

/**
 * A serializable tree item pushed from the plugin to the bridge.
 *
 * Maps to the SDK's internal `TreeItem` type — the bridge performs
 * the translation at render time.
 */
export interface PluginTreeItem {
  /** Stable identifier for this item (used for reconciliation). */
  id: string;
  /** Visual type — controls indentation, icon behavior, and rendering. */
  type: PluginTreeItemType;
  /** Primary display text. */
  label: string;
  /** Secondary display text (shown after the label in a muted style). */
  sublabel?: string;
  /** Icon identifier (e.g. `"ph-folder"`, `"ph-file-ts"`). */
  icon?: string;
  /** Whether the item starts expanded (only relevant for items with `children`). */
  expanded?: boolean;
  /** Child items. Presence makes the item expandable. */
  children?: PluginTreeItem[];
  /** Command ID to execute when the item is clicked (without the `plugin.<name>.` prefix). */
  command?: string;
  /** Badges displayed alongside the label. */
  badges?: PluginTreeBadge[];
  /** Context menu ID shown on right-click. */
  contextMenuId?: string;
  /** Opaque metadata forwarded to the command handler on click. */
  metadata?: unknown;
}

/** Options for {@link ViewsApi.registerTreeView}. */
export interface TreeViewOptions {
  /** Unique identifier for this tree view (namespaced to `plugin.<name>.<id>`). */
  id: string;
  /** Title shown in the pane's tab header. */
  title: string;
  /** Layout area where the tree view pane is placed. */
  area: 'left' | 'right' | 'bottom';
  /** Group ID within the area. Panes in the same group share a tab bar. */
  groupId?: string;
  /** Icon identifier for the pane's tab. */
  icon?: string;
}

// ─── Theme types ────────────────────────────────────────────────

/**
 * A theme definition contributed by a plugin, either via manifest
 * `contributes.themes` or runtime `api.themes.register()`.
 */
export interface PluginThemeDefinition {
  /** Theme identifier (auto-namespaced to `plugin.<pluginName>.<id>`). */
  id: string;
  /** Human-readable theme name shown in the Settings dropdown. */
  label: string;
  /** Theme category — determines fallback when the theme is removed. */
  type: 'dark' | 'light';
  /**
   * CSS custom property overrides. Keys are token names — the leading
   * `--` prefix is auto-prepended if missing. Values must be valid CSS
   * values (colors, lengths, etc.).
   */
  tokens: Record<string, string>;
}

// ─── Dialog types ───────────────────────────────────────────────

/** Options for {@link DialogsApi.showOpenFile}. */
export interface PluginFileDialogOpenOptions {
  /** Dialog window title. */
  title?: string;
  /** Default path to open the file picker in. */
  defaultPath?: string;
  /** File type filters. */
  filters?: { name: string; extensions: string[] }[];
}

/** Options for {@link DialogsApi.showSaveFile}. */
export interface PluginFileDialogSaveOptions {
  /** Dialog window title. */
  title?: string;
  /** Default path for the save dialog. */
  defaultPath?: string;
  /** Label for the confirm button. */
  buttonLabel?: string;
  /** File type filters. */
  filters?: { name: string; extensions: string[] }[];
}
