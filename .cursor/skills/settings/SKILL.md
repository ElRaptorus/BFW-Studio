---
name: settings
description: >-
  Read, write, and observe Studio settings from modules and components.
  Use when registering settings with descriptors, reading or writing settings,
  reacting to settings changes, or working with the Settings editor.
---

# Settings System

Settings are flat key/value pairs stored in JSON. Every key a module reads must be registered with a `SettingDescriptor` that defines its type, default value, label, and description. Settings are app-wide and propagated across Electron windows automatically.

For architectural details (storage internals, SettingsManager/SettingsMediator, validation, persistence), see `docs/architecture/settings.md`.

## Registering Settings

Call `register()` in your module's `onLoad` function, before any `get()` calls. Every setting must have a descriptor. Calling `get()` on an unregistered key throws.

```typescript
export function onLoad(bifrost: Bifrost): void {
  bifrost.settings.register({
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
    'myModule.feature.excludePatterns': {
      type: 'array',
      label: 'Exclude Patterns',
      description: 'Glob patterns to exclude.',
      default: ['node_modules', '.*'],
      items: { type: 'string' },
    },
    'myModule.internal.columnWidths': {
      type: 'object',
      label: 'Column Widths',
      description: 'Per-engine column width configuration.',
      default: { '*': 250 },
      hidden: true,
    },
  });
}
```

### SettingDescriptor types

- `SettingDescriptorBoolean` — `type: 'boolean'`, `default: boolean`
- `SettingDescriptorString` — `type: 'string'`, `default: string | null`, optional `enum`, `enumLabels`, `enumDescriptions`, `pattern`, `patternErrorMessage`
- `SettingDescriptorNumber` — `type: 'number' | 'integer'`, `default: number`, optional `minimum`, `maximum`
- `SettingDescriptorColor` — `type: 'color'`, `default: string` (CSS hex `#RGB`, `#RRGGBB`, or `#RRGGBBAA`; Settings GUI shows SDK color picker + hex field)
- `SettingDescriptorDate` — `type: 'date'`, `default: string` (ISO date `YYYY-MM-DD`; native date input in the GUI)
- `SettingDescriptorArray` — `type: 'array'`, `default: unknown[]`, optional `items` (`SettingArrayItemsDescriptor`: primitive `{ type: 'string' \| 'color' \| … }` or `{ type: 'object', properties: Record<string, SettingDescriptor> }` for homogeneous object lists), `minItems`, `maxItems`, `uniqueItems`
- `SettingDescriptorObject` — `type: 'object'`, `default: Record<string, unknown>`, optional `properties`

#### Common fields (all descriptors)

All descriptors include `label`, `description`, optional `hidden`, `category`, `deprecated`, and `markdownDescription`.

- **`category`**: Sets the group heading in the Settings GUI. If omitted, it is inferred from the first key segment (e.g., `engineBrowser` becomes "Engine Browser"). Use `category` when the inferred label would be unclear (e.g., `std` -> `category: 'General'`, `bpmn` -> `category: 'BPMN Editor'`).
- **`deprecated`**: Deprecation message string. Triggers strikethrough + hover message in the JSON editor. Shows a warning badge in the GUI.
- **`markdownDescription`**: Rich description for Monaco hover tooltips. Falls back to `description`.

#### Constraint fields

- **String**: `enumDescriptions` (array of strings, one per enum value — shown in JSON autocomplete and GUI dropdown), `pattern` (regex), `patternErrorMessage`
- **Number/Integer**: `minimum`, `maximum` (inclusive bounds — enforced at runtime and in JSON editor)
- **Array**: `minItems`, `maxItems`, `uniqueItems`

## Reading a Setting

```typescript
const enabled = studio.settings.get('myModule.feature.enabled');
```

`get()` returns the user override if one exists, otherwise the registered default. Objects and arrays are returned as **shallow copies** to prevent accidental mutation.

```typescript
if (studio.settings.has('myModule.feature.enabled')) {
  const value = studio.settings.get('myModule.feature.enabled');
}

const defaultValue = studio.settings.getDefault('myModule.feature.enabled');
const allDefaults = studio.settings.getDefaults();

// Schema introspection
const schema = studio.settings.getSchema('myModule.feature.enabled');
const allSchemas = studio.settings.getSchemas(); // Map<string, SettingDescriptor>
```

## Writing a Setting

### Replace a value

```typescript
studio.settings.set('myModule.feature.enabled', false);
```

`set()` validates the value against the registered descriptor. Invalid values are rejected with a console warning and the setting is not updated.

### Add to an existing value

```typescript
// Array: pushes the value
studio.settings.add('myModule.feature.excludePatterns', '*.log');

// Object: shallow-merges the value
studio.settings.add('myModule.internal.columnWidths', { 'status': 100 });
```

### Merge multiple settings at once

```typescript
const result = studio.settings.merge({
  'myModule.feature.enabled': false,
  'myModule.feature.maxRetries': 5,
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

`merge()` returns a `SettingsValidationResult`. If validation fails, no settings are updated.

## Observing Changes

```typescript
const subscription = studio.events.on('settingsUpdate', (key: string, value: any) => {
  if (key === 'myModule.feature.enabled') {
    // React to the change
  }
});
```

The `settingsUpdate` event is debounced (~73ms). For immediate reaction inside Bifrost core, use `EVENT_SETTINGS_CHANGED` directly on `bifrost.settings`.

## Key Naming Convention

Keys use a strict **3-segment** dot-separated pattern:

```
<domain>.<feature>.<setting>
```

| Pattern | Examples |
|---------|----------|
| `workbench.*` | `workbench.general.theme`, `workbench.editor.temporaryTabs` |
| `std.*` | `std.fileExplorer.exclude`, `std.editor.askConfirmationForOpeningUriInBrowser` |
| `<module>.*` | `bpmn.editor.showGrid`, `engineBrowser.processInstanceList.autoRefresh` |

- Use dot-separated segments (flat strings, not hierarchical paths)
- Prefix with the module/domain name to avoid collisions
- Use camelCase for multi-word segments
- Internal/runtime settings should use `hidden: true`

## Common Patterns

### Boolean toggle command

```typescript
bifrost.commands.register('myModule.toggleFeature', () => {
  const current = bifrost.settings.get('myModule.feature.enabled');
  bifrost.settings.set('myModule.feature.enabled', !current);
});
```

### Open Settings GUI at a specific category

```typescript
bifrost.commands.executeCommand('settings.openUserSettingsAtCategory', ['Engine Debugger']);
```

This opens the Settings GUI and scrolls to the given category. The category string must match a registered `category` value or the inferred category from the first key segment (e.g., `engineDebugger` → "Engine Debugger").

### React component that reacts to setting changes

```typescript
function MyComponent(props: { studio: Studio }) {
  const [showGrid, setShowGrid] = useState(props.studio.settings.get('bpmn.editor.showGrid'));

  useEffect(() => {
    const sub = props.studio.events.on('settingsUpdate', (key, value) => {
      if (key === 'bpmn.editor.showGrid') setShowGrid(value);
    });
    return () => sub.dispose();
  }, [props.studio]);

  return showGrid ? <Grid /> : null;
}
```

### Platform-specific shell command setting

```typescript
bifrost.settings.register({
  'myModule.shell.command': {
    type: 'string',
    label: 'Shell Command',
    description: 'Custom shell command. Null means use platform default.',
    default: null,
  },
  'myModule.shell.command.macos': {
    type: 'string',
    label: 'Shell Command (macOS)',
    description: 'macOS-specific shell command.',
    default: 'open "$1"',
  },
  'myModule.shell.command.windows': {
    type: 'string',
    label: 'Shell Command (Windows)',
    description: 'Windows-specific shell command.',
    default: 'start "$1"',
  },
});
```

Resolution at runtime: check the base key first; if `null`, fall back to the platform-suffixed key.
