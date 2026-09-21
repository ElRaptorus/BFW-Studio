# Bifrost Forge World SDK

The Bifrost Forge World SDK for plugin developers. Provides type definitions, reusable UI components, and design tokens for building Bifrost Forge World plugins.

## What this package is

| Surface                                | Use it for                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plugin-api/`                      | `StudioPluginApi`, sub-APIs, manifest types, `acquireStudioApi()`, `ThemeToken`                                                             |
| `src/contracts/`                       | Serializable POJOs already used by the plugin API (`MenuItem`, `SettingDescriptor`, `MenuBarItem`, `StatusBarItem`, property-search helper) |
| `src/webview/studio-webview-theme.css` | Documentation of `--theme-*` tokens with Bifrost Night fallbacks (not loaded at runtime)                                                    |
| `src/components/`                      | Webview-safe content controls (see below)                                                                                                   |

Internal Studio modules do **not** use this package as a host facade. They type `Bifrost` from `#bifrost/Bifrost`. Plugin authors type `StudioPluginApi`.

## Content controls

These render inside plugin iframes (and in the host). They take props only — no `studio` / `Bifrost` instance:

- `FeelEditor`, `OneLineFeelEditor`
- `PaneProperty`, `PropertyValidation`, `PropertyValueWithSuggestions`
- `FormInput`
- `PresentationalContextMenu`

**Phosphor:** use `<span className="ph-…">` in webviews. The host does not inject icon fonts into iframes. Manifest `icon` on panes and tabs is host-rendered.

**Theme:** live `--theme-*` values are injected by the host. Use `ThemeToken` for typed names, and `acquireStudioApi().getThemeType()` for `'light' | 'dark'`. `--theme-table-*` and `--theme-icon-*` stay on the token contract so plugins can theme their own tables and icons.

## Not in this package

Host chrome (editor title/toolbar, pane shells), Tree, host CodeMirror wrappers, Markdown, host widgets (`Icon`, `Table`, `Checkbox`, `ColorPicker`), `EditorDocumentModel`, and the old `Studio` class live in `studio/src/`. Plugins contribute trees via `api.views.registerTreeView` + `PluginTreeItem`.
