# Settings System

---

## Overview

The Studio's settings system provides a **schema-based**, flat key/value store for customizable behavior. Every setting must be registered with a `SettingDescriptor` that defines its type, default value, label, description, and validation rules.

User settings are **app-wide** (not per-window), persisted in JSON format via `localStorage`, and propagated across Electron windows via IPC. Eligible settings can also be overridden per solution and per project. See [Scopes](#scopes-user--solution--project).

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

## Scopes (User / Solution / Project)

Resolution order is Default, then User (`localStorage`), then Solution (the `settings` object in the open `.bfwsln`), then Project (`<project>/.bifrostfw/settings.json`). The most specific defined, eligible, and valid value wins. Arrays and objects are replaced as a whole.

A descriptor field `scope` (`'application' | 'solution' | 'project'`, default `'application'`) is hierarchical: `'solution'` may be stored on User and Solution, `'project'` on User, Solution, and Project. Ineligible or invalid layer entries are ignored and left in the file. There is no Solution layer unless `solution.solutionFileUri` is set. `buffer:` URIs and files outside the solution resolve as User only. A resource belongs to the project whose `baseUri` is a prefix of its URI on a `/` boundary.

A resource and a project base URI are compared after `normalizeResourceUri` (`decodeURI`, no trailing `/`), so percent-encoded document URIs match unencoded project URIs.

### Reading and writing

Callers use only `bifrost.settings`. Application keys ignore the resource argument. Scoped keys resolve as follows: omit the resource to use the focused editor document (any type), pass `null` for User, or pass a string for that resource.

| Method | Behaviour |
|---|---|
| `get(key, resourceUri?)` | Application keys return User or the default. Scoped keys use the resource rule above. |
| `inspect(key, resourceUri?)` | `{ value, definedIn }` with the same resource rule. |
| `set(key, value, resourceUri?)` | `Promise<SettingsScopeTarget \| null>`. Application keys are written to User before the promise resolves; an invalid value returns `null` and `console.warn`. Scoped keys write to the most specific layer that already defines a valid entry, otherwise User. `null` means the value was invalid or the write failed. |
| `onDidChange(handler, resourceUri?)` | Without a resource, every change. With `string` or `() => string \| null`, User changes, layer changes that affect that resource, and a move of that resource. |

Code bound to a document or file passes its URI (`this.getUri()`, `editorDocument.uri`, or the batch URI). Menus and commands omit it. diagram-js services receive `bifrostSettings` (the mediator) and `documentUri` (`() => string`) from `BpmnModelerComponentAdapter` and call the same methods.

`set` returns `null` when a scoped write fails; the reason has already been reported. When a Solution or Project entry exists but is invalid, the write goes to User; the invalid entry stays in the file and wins again once corrected.

The Settings GUI still writes an explicit layer with `setInScope(target, key, value)` and `removeFromScope(target, key)`. Both return `Promise<boolean>`. Reset in User scope removes the override (`SettingsManager.clearOverride`). Other GUI helpers: `inspectForTarget`, `getScopeValues`, `listOverridingScopes`, `getAvailableScopeTargets`, `readScopeText` / `writeScopeText`, `isEligibleForScope`, `getProjectBaseUriForResource`.

`Bifrost.ts` calls `attachWorkspace({ fileHandling, readSolution, solutionEvents, readFocusedEditorDocument, reportError })`. The mediator creates `SettingsLayerManager`. Until that runs, scoped keys resolve as User and errors go to `console.warn`. The reporter opens an error notification with source `Settings`.

### Caller, mediator, managers

| File | Role | Imported by |
|---|---|---|
| `SettingsMediator.ts` | The only public entry point. Also holds the scope resolution rules as module-private functions (precedence, eligibility, write target, project matching) | Everyone |
| `SettingsManager.ts` | User layer | Mediator |
| `SettingsLayerManager.ts` | Solution and project layer files | Mediator and unit tests |
| `SettingsValidator.ts` | Runtime validation | Mediator and managers |

The resolution rules are not exported, so they can only be reached through the mediator. Their unit tests go through `get`, `inspect`, `set` and `getProjectBaseUriForResource`.

### Events and moves

`EVENT_SETTINGS_CHANGED` is `(key, value, addedValue?, scopeTarget?)`. User changes leave `scopeTarget` undefined. Layer changes set `value` to `get(key)` for the focused document and set `scopeTarget`. Layer entries for unregistered keys or application keys are not emitted, because they never resolve from a layer. Cross-window IPC in `initializeBifrostWindowSettingsPropagation` returns early when `scopeTarget` is defined, because each window watches the layer files itself. `settingsUpdate` still forwards every `EVENT_SETTINGS_CHANGED`, including layer changes.

When a document model changes its URI, `EditorMediator` calls `settings.resourceMoved(before, after)` before any tab bookkeeping, so models without a tab are covered too. It notifies `onDidChange` subscribers whose resource is now `after` when the effective value differs.

### Store and file watching

`SettingsLayerManager` owns the Solution layer and the project layers. It talks to the mediator with the file-local event `EVENT_SETTINGS_LAYER_CHANGED`. `readLayer(target)` returns a copy of a layer.

- The `.bfwsln` is JSONC. Solution settings writes go through `SolutionFile.updateSolutionSettings`, and the Solution JSON editor round-trips the raw `settings` text including comments. An unreadable solution file opens `std.solution.offerSolutionFileRepair`. Accepting repairs the file (with a backup) and the write is retried once. Declining resolves `set` to `null` and `setInScope` / `removeFromScope` to `false` without a second error notification; `writeScopeText` rethrows so the JSON editor shows the error.
- chokidar cannot observe a file whose parent directory does not exist. A project without `.bifrostfw/` is watched with `watchFile(baseUri, cb, { depth: 0 })` until `.bifrostfw` appears, then the settings file is watched. The watcher is re-armed after every project write.
- Watch failures are ignored (the web build loads once).
- When a project leaves the solution, the manager emits a project-target event for every key of that project layer and of the Solution layer. The mediator matches project targets by path prefix, so documents of the removed project are notified.

### JSON editors

- `about:settings-json` edits User settings. `about:settings-json?scope=solution` and `?scope=project&project=<encoded baseUri>` edit a layer through `ScopedSettingsDocumentModel`.
- Both models expose `getJsonSchema()`. The scoped schema marks registered but ineligible keys as deprecated with "Not eligible for <scope> scope. This entry is ignored and blocks saving.". Unregistered keys still show "Unknown setting.". Hidden eligible keys are editable, as in the User editor.
- Both models emit `EVENT_SETTINGS_SAVE_VALIDATED` with a `SettingsValidationResult` after every save attempt. The renderer shows the errors in the toolbar hint.
- `std.settings.openSettingsAtScope(target)` opens the GUI at a scope (used by the JSON editor's "Open GUI Editor" button).
- The scoped JSON model reloads on `EVENT_SETTINGS_CHANGED` only when the fourth argument matches its target.

### Scope

v1 project-scoped keys are the BPMN Editor settings, the BPMN Linter settings, and the DMN Editor settings. Plugin descriptors have `scope` stripped because plugin reads are not scope-aware. The plugin bridge reads with `get(key, null)` and does not forward layer events to plugin `onDidChange` callbacks.

Layer values are validated on every read; there is no validation cache. Per read this is a handful of `validateSetting` calls on small layers, and a cache would have to track in-place mutation of the User layer (`SettingsManager.config`), which risks stale results for no measured gain.

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
- **`category`**: Human-readable group name for the GUI. If omitted, inferred from the first key segment (e.g., `engine` → "Engine").
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
| `EVENT_SETTINGS_SCHEMA_REGISTERED` | `register()` adds new descriptors to the schema registry | Settings GUI (re-fetches schemas so newly registered settings appear), JSON editor (calls `updateJsonSchema` on the CodeMirror editor) |

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
- `engine.processExplorer.autoRefresh`
- `shell.commands.openTerminalInDirectory`

### Platform-specific suffixes

Shell command settings use platform suffixes (`.macos`, `.windows`). These are resolved at runtime via `std.shell.getUserSettingOrPlatformSpecificDefault`.

---

## Settings UI

### Settings Editors

The settings system provides two independent editor document types:

- **GUI Editor** (`about:settings`): Renders each visible setting with an appropriate control (checkbox, text input, number input, dropdown, color picker + hex field, date picker, array editor). Settings are grouped by category in a two-panel layout: a **category sidebar** on the left for quick navigation, and a scrollable settings body on the right. The sidebar highlights the currently visible category using `IntersectionObserver` and supports click-to-scroll. Boolean settings use a VS Code-style layout (label on top, checkbox + description on the row below). A search bar filters by key, label, or description. Changes are applied immediately. No editor document model is needed — the GUI reads live from `studio.settings`. The GUI subscribes to both `EVENT_SETTINGS_CHANGED` and `EVENT_SETTINGS_SCHEMA_REGISTERED`, so it reacts to both value changes and late schema registrations (e.g., plugins loading after the editor was restored from a previous session).
- **JSON Editor** (`about:settings-json`): Raw CodeMirror 6 editor for editing the full settings JSON (JSONC). Validation uses `createJson5SchemaExtensions(buildJsonSchema())` plus save-time `isInvalidJSON()` / `settings.merge()`. Changes are applied on save. Uses `UserSettingsDocumentModel` for dirty tracking and save/merge. Stock schema coverage:
  - **Property-key completion** from registered `properties`
  - **Enum value completion**
  - **Type / enum / min / max / pattern squiggles**
  - **Hover** of `description` (not `markdownDescription`)
  - **Unknown keys** as warnings (`Unknown setting.`) — leftover keys from unloaded plugins; save is not blocked
  - VS Code dialect fields (`deprecationMessage` strikethrough, `enumDescriptions`, custom unknown-key copy) are not mapped natively; unknown-key copy is rewritten in `createJson5SchemaExtensions`

See [code-editors.md](code-editors.md).

Both editors can be open simultaneously. Each has a toolbar button to open the other.

### Access

- **Command search**: `View: Settings`, `View: Settings (JSON)`, `View: Default Settings`, `View: Key Bindings`
- **Programmatic**: `bifrost.commands.executeCommand('std.settings.openUserSettingsAtCategory', ['Category Name'])` opens the GUI and scrolls to the specified category. Used by modules like `engine-debugger` and `engine-decision-viewer` for their "Open Settings" commands.
- **Keyboard shortcut**: `Ctrl+,` / `Cmd+,` for Settings (GUI)
- **Application menu**: Settings, Settings (JSON), Solution Settings, Project Settings, and Default Settings in the main menu

### Hidden settings

Settings marked with `hidden: true` are validated but not shown in the GUI. These are typically internal/runtime settings (e.g., engine connection state, column widths). They can still be edited via the JSON editor.

---

## File Reference

| File | Purpose |
|------|---------|
| `studio-sdk/src/contracts/SettingTypes.ts` | `SettingDescriptor` discriminated union, `SettingsValidationResult` |
| `studio/src/bifrost/contracts/internal/SettingsEvents.ts` | Internal event constants |
| `studio/src/bifrost/common/SettingsManager.ts` | In-memory settings model (config + schemaRegistry) |
| `studio/src/bifrost/common/SettingsMediator.ts` | Public settings API: User, Solution, and Project; module-private scope resolution |
| `studio/src/bifrost/common/SettingsLayerManager.ts` | Solution and project layer files |
| `studio/src/bifrost/contracts/SettingsScopeTypes.ts` | `SettingsScopeTarget`, `SettingInspection` |
| `studio/src/bifrost/common/SettingsValidator.ts` | Runtime validation engine |
| `studio/src/bifrost/common/LocalStorageItem.ts` | Single-key read/write over BifrostLocalStorage |
| `studio/src/modules/std/settings/index.ts` | Settings sub-feature of `std`: document types, commands, menus, keybindings (loaded via `loadSettings()`) |
| `studio/src/modules/std/settings/settingsNavigation.ts` | Shared state for programmatic navigation: category (`requestCategoryNavigation`, `consumePendingCategory`, `onCategoryNavigationRequested`) and scope (`requestScopeNavigation`, `peekPendingScope`, `clearPendingScope`, `onScopeNavigationRequested`) |
| `studio/src/modules/std/settings/UserSettingsDocumentModel.ts` | JSON Settings editor model (save → validate → merge) |
| `studio/src/modules/std/settings/SettingsGuiDocumentRenderer.tsx` | GUI Settings editor (about:settings) |
| `studio/src/modules/std/settings/SettingsJsonDocumentRenderer.tsx` | JSON Settings editor (about:settings-json); passes `jsonSchema` into `MultiLineCodeEditor` |
| `studio/src/modules/std/settings/gui/SettingsGui.tsx` | Main GUI container with scope bar, search, category sidebar, and domain grouping |
| `studio/src/modules/std/settings/gui/SettingsScopeBar.tsx` | User / Solution / Project scope bar |
| `studio/src/modules/std/settings/ScopedSettingsDocumentModel.ts` | JSON editor for a solution or project layer |
| `studio/src/modules/std/settings/gui/SettingsCategoryNav.tsx` | Category sidebar with active highlight and click-to-scroll |
| `studio/src/modules/std/settings/gui/SettingsGroup.tsx` | Renders a group of settings under a domain label |
| `studio/src/modules/std/settings/gui/SettingRow.tsx` | Individual setting row with label, description, and control |
| `studio/src/modules/std/settings/gui/SettingsSearch.tsx` | Search input for filtering settings |
| `studio/src/modules/std/settings/gui/controls/*.tsx` | Type-specific controls (Boolean, String, Number, Enum, Color, Date, Array, Object, ObjectArrayItems) |
| `studio/src/modules/std/settings/validation/schemaToJsonSchema.ts` | Converts SettingDescriptor registry to JSON Schema for `codemirror-json-schema` |
| `studio/src/components/code-editor/json5SchemaExtensions.ts` | Settings JSON5 schema bundle; unknown keys → warning `Unknown setting.` |
| `studio/src/modules/std/settings/DefaultSettingsDocumentRenderer.tsx` | Default Settings viewer (read-only) |
