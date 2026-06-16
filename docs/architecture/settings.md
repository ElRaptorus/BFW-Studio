# Settings System

---

## Overview

The Studio's settings system provides a **schema-based**, flat key/value store for customizable behavior. Every setting must be registered with a `SettingDescriptor` that defines its type, default value, label, description, and validation rules.

Settings are **app-wide** (not per-window), persisted in JSON format via `localStorage`, and propagated across Electron windows via IPC.

```
┌──────────────────────────────────────────────────────────────────┐
│  Module / Component                                           │
│    studio.settings.get('key')  /  studio.settings.set('key', v) │
├──────────────────────────────────────────────────────────────────┤
│  SettingsMediator  (studio.settings)                             │
│    ├─ SettingsManager  (in-memory: config + schemaRegistry)      │
│    ├─ SettingsValidator (runtime type/enum/object validation)    │
│    └─ LocalStorageItem (persistence: serialize ↔ localStorage)   │
├──────────────────────────────────────────────────────────────────┤
│  BifrostLocalStorage  (window.localStorage)                       │
│    key: "${appKey}/Settings"  (default: "chrn/Settings")         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Storage and Persistence

### Where settings are stored

Settings are stored in the browser's `localStorage` under the key `${appKey}/Settings`. The default `appKey` is `chrn`, so the typical storage key is **`chrn/Settings`**.

- **Electron**: `localStorage` is backed by Chromium's internal storage under the app's user data directory.
- **Web**: Standard browser `localStorage` for the origin.

### What is persisted

Only **user overrides** are persisted — settings that were explicitly changed from their defaults. Default values are derived from the `schemaRegistry` and never stored. The `serialize()` method returns only the user `config` object; `deserialize()` replaces it on load after validation.

### Multi-window propagation (Electron)

Settings are app-wide. When one window changes a setting, it broadcasts via IPC (`IPC_MESSAGE_RELOAD_SETTINGS`). Other windows receive the message and reload from storage.

---

## Architecture

### SettingDescriptor (Type Contract)

**Path:** `studio-sdk/src/contracts/SettingTypes.ts`

Every setting is described by a `SettingDescriptor` — a discriminated union that ensures type safety:

```typescript
export type SettingDescriptor =
  | SettingDescriptorBoolean    // type: 'boolean', default: boolean
  | SettingDescriptorString     // type: 'string', default: string | null, enum?, enumLabels?, enumDescriptions?, pattern?
  | SettingDescriptorNumber     // type: 'number' | 'integer', default: number, minimum?, maximum?
  | SettingDescriptorColor      // type: 'color', default: string (CSS hex #RGB / #RRGGBB / #RRGGBBAA)
  | SettingDescriptorDate       // type: 'date', default: string (YYYY-MM-DD)
  | SettingDescriptorArray      // type: 'array', default: unknown[], items?, minItems?, maxItems?, uniqueItems?
  | SettingDescriptorObject;    // type: 'object', default: Record<string, unknown>, properties?
```

#### Common fields (SettingDescriptorBase)

All subtypes share: `label`, `description`, `hidden?`, `category?`, `deprecated?`, `markdownDescription?`.

- **`hidden`**: Validated but not shown in the Settings GUI.
- **`category`**: Human-readable group name for the GUI. If omitted, inferred from the first key segment (e.g., `engineBrowser` → "Engine Browser").
- **`deprecated`**: Deprecation message string. In the JSON editor, the key is shown with strikethrough and the message appears on hover. In the GUI, the label is struck through and the message is shown as a warning.
- **`markdownDescription`**: Markdown-formatted description for richer hover tooltips in the JSON editor. Falls back to `description` when not set.

#### Type-specific constraint fields

| Type | Field | Effect |
|------|-------|--------|
| `string` | `enum`, `enumLabels` | Restrict to allowed values with display labels. Both accept a static value or a factory function (`() => T`) evaluated lazily at read time — see "Dynamic Enum Support" below. |
| `string` | `enumDescriptions` | One description per enum value (shown in JSON autocomplete + GUI dropdown) |
| `string` | `pattern`, `patternErrorMessage` | Regex constraint with custom error message |
| `color` | — | CSS hex string; GUI uses color picker + hex field; JSON schema uses `type: string` + pattern |
| `date` | — | ISO calendar date `YYYY-MM-DD`; GUI uses native date input; JSON schema uses `type: string` + pattern |
| `number` / `integer` | `minimum`, `maximum` | Inclusive range bounds (validated at runtime + JSON editor) |
| `array` | `items` | Per-element schema: either a **primitive** (`{ type: 'string' \| 'color' \| … }`, excluding `object` / `array`) or **objects** (`{ type: 'object', properties: Record<string, SettingDescriptor> }`). The Settings GUI renders a string/color/date list for primitives, or one row per object with nested controls (string, color, date, number, boolean). An empty array with no `items` is not treated as a string list (avoids accidental plain-text editing of object arrays). |
| `array` | `minItems`, `maxItems` | Array length bounds |
| `array` | `uniqueItems` | Rejects duplicate items |

### Dynamic Enum Support

The `enum` and `enumLabels` fields on `SettingDescriptorString` and `SettingDescriptorNumber` accept either a static value or a **factory function** that is evaluated lazily each time the value is needed:

```typescript
type EnumField = string[] | (() => string[]);
type EnumLabelsField = Record<string, string> | (() => Record<string, string>);
```

The SDK provides a `resolveSettingEnum<T>(value)` utility that handles both forms transparently. All consumers of enum fields (`SettingsValidator`, `SettingRow`, `schemaToJsonSchema`) use this resolver.

**Use case**: The `workbench.general.theme` setting uses factory functions that read from `bifrost.theme.getRegisteredThemes()`, so the Settings GUI dropdown dynamically reflects all themes registered at runtime — including those added by the `themes` module or by plugins.

```typescript
'workbench.general.theme': {
  type: 'string',
  label: 'Theme',
  description: 'Controls the color theme of the Studio.',
  default: 'dark',
  enum: () => this.theme.getRegisteredThemes().map((theme) => theme.id),
  enumLabels: () =>
    Object.fromEntries(this.theme.getRegisteredThemes().map((theme) => [theme.id, theme.label])),
},
```

### SettingsValidator

**Path:** `studio/src/bifrost/common/SettingsValidator.ts`

Performs runtime validation of setting values against their descriptors:

- Type checking (boolean, string, number, integer, color, date, array, object)
- Enum membership for string settings with `enum` constraint
- Pattern matching for string settings with `pattern` constraint
- Range validation for number/integer settings with `minimum`/`maximum`
- Array item validation (primitive element types, or object elements with the same nested checks as `object.properties`)
- Array size validation (`minItems`, `maxItems`) and uniqueness (`uniqueItems`)
- Recursive object property validation

### SettingsManager

**Path:** `studio/src/bifrost/common/SettingsManager.ts`

The in-memory model. Holds:

- `config` — User overrides (persisted)
- `schemaRegistry` — `Map<string, SettingDescriptor>` of all registered schemas (not persisted)

`get(key)` checks `config` first, falls back to the descriptor's `default`. Returns defensive copies of objects and arrays.

`set(key, value)` validates the value against the schema before storing. Invalid values are rejected with a console warning.

`register(descriptors)` emits `EVENT_SETTINGS_SCHEMA_REGISTERED` after inserting all descriptors into the registry. This allows the Settings GUI and JSON editor to react to late-registered schemas (e.g., from plugins that load after the editor is already open).

`deserialize(dump)` validates the entire dump against the schema registry. If validation fails, the merge is rejected and a `SettingsValidationResult` with errors is returned.

### SettingsMediator

**Path:** `studio/src/bifrost/common/SettingsMediator.ts`

The public API layer on `studio.settings`. Wires `SettingsManager` to `LocalStorageItem` for auto-persistence.

---

## Public API

### Registering Settings

Settings are registered with their descriptors at module load time using `register()`:

```typescript
studio.settings.register({
  'myModule.feature.enabled': {
    type: 'boolean',
    label: 'Enable Feature',
    description: 'Controls whether the feature is active.',
    default: true,
  },
  'myModule.feature.maxRetries': {
    type: 'number',
    label: 'Max Retries',
    description: 'Maximum number of retry attempts.',
    default: 3,
    minimum: 1,
    maximum: 10,
  },
  'myModule.feature.mode': {
    type: 'string',
    label: 'Mode',
    description: 'The operating mode for the feature.',
    default: 'auto',
    enum: ['auto', 'manual', 'disabled'],
    enumLabels: { auto: 'Automatic', manual: 'Manual', disabled: 'Disabled' },
    enumDescriptions: [
      'Automatically select the best strategy',
      'Require explicit user action',
      'Turn the feature off entirely',
    ],
  },
  'myModule.feature.oldSetting': {
    type: 'boolean',
    label: 'Old Setting',
    description: 'This setting is no longer used.',
    default: false,
    deprecated: 'Use myModule.feature.enabled instead.',
  },
});
```

Every key that a module reads **must** have a registered descriptor. Calling `get()` on an unregistered key throws.

### Reading

```typescript
const theme = studio.settings.get('workbench.general.theme');
const defaultTheme = studio.settings.getDefault('workbench.general.theme');
const allDefaults = studio.settings.getDefaults();
const exists = studio.settings.has('workbench.general.theme');

// Schema introspection
const schema = studio.settings.getSchema('workbench.general.theme');
const allSchemas = studio.settings.getSchemas();
```

### Writing

```typescript
// Set a value (validated against the descriptor)
studio.settings.set('workbench.general.theme', 'light');

// Add to array or merge into object
studio.settings.add('std.fileExplorer.exclude', '*.log');

// Merge an entire settings object (returns SettingsValidationResult)
const result = studio.settings.merge({ 'workbench.general.theme': 'dark' });
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### Observing changes

```typescript
studio.events.on('settingsUpdate', (settingName: string, value: any) => {
  if (settingName === 'bpmn.editor.showGrid') {
    // React to the change
  }
});
```

### Internal events

| Event | Emitted when | Subscribers |
|-------|-------------|-------------|
| `EVENT_SETTINGS_CHANGED` | A single setting value is created, updated, or deleted | Settings GUI (bumps revision to re-read values), Bifrost (broadcasts `settingsUpdate`), SettingsMediator (persists to storage) |
| `EVENT_SETTINGS_MERGED` | A bulk `deserialize` / `merge` replaces the entire config | Engine modules (re-apply connection settings) |
| `EVENT_SETTINGS_SCHEMA_REGISTERED` | `register()` adds new descriptors to the schema registry | Settings GUI (re-fetches schemas so newly registered settings appear), JSON editor (re-configures Monaco validation schema) |

---

## Key Naming Convention

Settings keys use a strict **3-segment** dot-separated pattern:

```
<domain>.<feature>.<setting>
```

Examples:

- `workbench.general.theme`
- `workbench.editor.temporaryTabs`
- `bpmn.editor.showGrid`
- `std.fileExplorer.exclude`
- `engineBrowser.processInstanceList.autoRefresh`
- `shell.commands.openTerminalInDirectory`

### Platform-specific suffixes

Shell command settings use platform suffixes (`.macos`, `.windows`). These are resolved at runtime via `std.shell.getUserSettingOrPlatformSpecificDefault`.

---

## Settings UI

### Settings Editors

The settings system provides two independent editor document types:

- **GUI Editor** (`about:settings`): Renders each visible setting with an appropriate control (checkbox, text input, number input, dropdown, color picker + hex field, date picker, array editor). Settings are grouped by category in a two-panel layout: a **category sidebar** on the left for quick navigation, and a scrollable settings body on the right. The sidebar highlights the currently visible category using `IntersectionObserver` and supports click-to-scroll. Boolean settings use a VS Code-style layout (label on top, checkbox + description on the row below). A search bar filters by key, label, or description. Changes are applied immediately. No editor document model is needed — the GUI reads live from `studio.settings`. The GUI subscribes to both `EVENT_SETTINGS_CHANGED` and `EVENT_SETTINGS_SCHEMA_REGISTERED`, so it reacts to both value changes and late schema registrations (e.g., plugins loading after the editor was restored from a previous session).
- **JSON Editor** (`about:settings-json`): Raw Monaco editor for editing the full settings JSON. Validation is performed via JSON Schema (generated from the registered descriptors). Changes are applied on save. Uses `UserSettingsDocumentModel` for dirty tracking and save/merge. The JSON editor provides VS Code-like highlighting:
  - **Unknown keys**: Yellow warning squiggle with "Unknown setting." message (via `additionalProperties: { not: true, errorMessage }` in the root schema)
  - **Invalid values**: Red squiggle for type mismatches, enum violations, range violations, pattern mismatches
  - **Deprecated settings**: Key shown with strikethrough, deprecation message on hover
  - **Hover tooltips**: Setting description (with optional markdown formatting via `markdownDescription`)
  - **Autocompletion**: Suggests registered setting keys and values, with enum value descriptions

Both editors can be open simultaneously. Each has a toolbar button to open the other.

### Access

- **Command search**: `View: Settings`, `View: Settings (JSON)`, `View: Default Settings`, `View: Key Bindings`
- **Programmatic**: `bifrost.commands.executeCommand('settings.openUserSettingsAtCategory', ['Category Name'])` opens the GUI and scrolls to the specified category. Used by modules like `engine-debugger` and `engine-bpmn-viewer` for their "Open Settings" commands.
- **Keyboard shortcut**: `Ctrl+,` / `Cmd+,` for Settings (GUI)
- **Application menu**: Settings, Settings (JSON), and Default Settings in the main menu

### Hidden settings

Settings marked with `hidden: true` are validated but not shown in the GUI. These are typically internal/runtime settings (e.g., engine connection state, column widths). They can still be edited via the JSON editor.

---

## File Reference

| File | Purpose |
|------|---------|
| `studio-sdk/src/contracts/SettingTypes.ts` | `SettingDescriptor` discriminated union, `SettingsValidationResult` |
| `studio-sdk/src/contracts/internal/SettingsEvents.ts` | Internal event constants |
| `studio/src/bifrost/common/SettingsManager.ts` | In-memory settings model (config + schemaRegistry) |
| `studio/src/bifrost/common/SettingsMediator.ts` | Public API layer, persistence wiring |
| `studio/src/bifrost/common/SettingsValidator.ts` | Runtime validation engine |
| `studio/src/bifrost/common/LocalStorageItem.ts` | Single-key read/write over BifrostLocalStorage |
| `studio/src/modules/std/settings/index.ts` | Settings sub-feature of `std`: document types, commands, menus, keybindings (loaded via `loadSettings()`) |
| `studio/src/modules/std/settings/configureMonacoJsonValidation.ts` | Builds JSON Schema from registry and configures Monaco diagnostics |
| `studio/src/modules/std/settings/settingsNavigation.ts` | Shared state for programmatic category navigation (open settings at category) |
| `studio/src/modules/std/settings/UserSettingsDocumentModel.ts` | JSON Settings editor model (save → validate → merge) |
| `studio/src/modules/std/settings/SettingsGuiDocumentRenderer.tsx` | GUI Settings editor (about:settings) |
| `studio/src/modules/std/settings/SettingsJsonDocumentRenderer.tsx` | JSON Settings editor (about:settings-json) |
| `studio/src/modules/std/settings/gui/SettingsGui.tsx` | Main GUI container with search, category sidebar, and domain grouping |
| `studio/src/modules/std/settings/gui/SettingsCategoryNav.tsx` | Category sidebar with active highlight and click-to-scroll |
| `studio/src/modules/std/settings/gui/SettingsGroup.tsx` | Renders a group of settings under a domain label |
| `studio/src/modules/std/settings/gui/SettingRow.tsx` | Individual setting row with label, description, and control |
| `studio/src/modules/std/settings/gui/SettingsSearch.tsx` | Search input for filtering settings |
| `studio/src/modules/std/settings/gui/controls/*.tsx` | Type-specific controls (Boolean, String, Number, Enum, Color, Date, Array, Object, ObjectArrayItems) |
| `studio/src/modules/std/settings/validation/schemaToJsonSchema.ts` | Converts SettingDescriptor registry to JSON Schema for Monaco |
| `studio/src/modules/std/settings/DefaultSettingsDocumentRenderer.tsx` | Default Settings viewer (read-only) |
