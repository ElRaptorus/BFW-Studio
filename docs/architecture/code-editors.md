# Host Code Editors

---

## Overview

Host multi-line source editing uses CodeMirror 6. Two React wrappers — `MultiLineCodeEditor` and `DiffEditor` — keep the class + inner-function pattern, blur-to-commit `onChange` (except Machine Sanctum live playgrounds), and the existing import paths. A small kit under `studio/src/components/code-editor/` supplies theme, language map, default extensions, rainbow brackets, and JSON parse lint.

These wrappers are **host-only**. They are never exported from `@evil/bifrost_fw_sdk`. FEEL editing stays a separate SDK widget (`FeelEditor` / `OneLineFeelEditor` wrapping `@bpmn-io/feel-editor`). Markdown documentation stays on `@mdxeditor/editor` (Lexical WYSIWYG). Plugin `text-file-editors` owns its own CodeMirror instance inside a webview.

---

## Architecture

```
MultiLineCodeEditor / DiffEditor   (studio/src/components/)
        │
        ▼
code-editor kit
  theme + highlighting   language map   default extensions
  rainbowBrackets()      jsonParseLinter   json5Schema (Settings only)
        │
        ▼
@codemirror/view EditorView   /   @codemirror/merge MergeView
```

#### MultiLineCodeEditor

**Path:** `studio/src/components/MultiLineCodeEditor.tsx`

Public host API for JSON, JavaScript, XML, HTML, and plaintext. Mounts an `EditorView` once. Imperative methods: `focus()`, `getCurrentValue()`, `resetValue()`, `setValue()`, `updateJsonSchema()`.

| Prop | Notes |
|------|-------|
| `language` | Mapped by `getLanguageSupport`. `html` is HTML; XML inspectors pass `xml`. |
| `jsonSchema` | When set, uses `createJson5SchemaExtensions` (JSON5 + schema lint/hover/complete). Settings JSON only. Unknown top-level keys are warnings (`Unknown setting.`), not errors. |
| `minimap` | No-op. Kept so existing callsites compile. |
| `liveUpdate` | When true, `onChange` fires on every document change (Machine Sanctum). Default is blur-to-commit. |
| `modelPath` | Removed. Replaced by `jsonSchema`. |

The host div carries `data-code-editor="multiline"`. Tests click `.cm-content` inside that wrapper.

#### DiffEditor

**Path:** `studio/src/components/DiffEditor.tsx`

Side-by-side `@codemirror/merge` `MergeView`. Used by dialog `diff` content (`DialogRenderer`). Not used by Git Cruiser — merge visualization is BPMN/DMN only. Left (`a`) is read-only ours; right (`b`) is theirs/result and is editable unless `readOnly`. `getCurrentValue()` returns the `b` document. `layout()` is a no-op. Host div: `data-code-editor="diff"`.

#### Shared kit

**Path:** `studio/src/components/code-editor/`

| File | Responsibility |
|------|----------------|
| `CodeEditorTheme.ts` | `studioCodeMirrorTheme` + `studioCodeMirrorHighlighting` (`--theme-feel-*`, `tok-*` via `classHighlighter`) |
| `languageSupport.ts` | `getLanguageSupport(language)` — ids the host actually passes (`json`, `javascript`, `html`, `xml`); unknown → plaintext |
| `defaultExtensions.ts` | History, keymap (including Mod-Y redo), search, wrapping, bracket matching, close brackets, rainbow brackets, optional line numbers / lint gutter, read-only |
| `jsonParseLinter.ts` | Strict `JSON.parse` linter for contracts/tokens/dialogs — not Settings. Empty / whitespace-only docs are not linted |
| `json5SchemaExtensions.ts` | Settings JSON5 schema bundle; unknown keys → warning `Unknown setting.` |
| `unknownSettingDiagnostics.ts` | Rewrites json-schema-library additional-property errors to `Unknown setting.` |
| `rainbowBrackets.ts` | In-house `ViewPlugin`; viewport decorations `cm-rainbow-bracket-0` … `5` |
| `component.code-editor.scss` | `--theme-cm-*` aliases on `.bifrost`; `tok-*` syntax colors; six bracket colors |

Language map (only ids host wrappers pass): `json`, `javascript`, `html`, `xml`. Unknown ids, `plaintext`, and `''` (documentation fragments) get no language package. FEEL is not in this map — it uses `FeelEditor`. Do not add `@codemirror/legacy-modes` or extra `@codemirror/lang-*` packages unless a real callsite needs them.

Shift+Enter blurs `MultiLineCodeEditor` (dialog / pane commit). Paste is native CodeMirror.

`jsonParseLinterExtension` wraps `@codemirror/lang-json`'s `jsonParseLinter`. Blank and whitespace-only documents return no diagnostics — optional JSON fields (payload/result contracts, unset tokens) mount an empty editor, and `JSON.parse('')` would otherwise show "Unexpected end of JSON input". Invalid JSON still squiggles. Settings JSON uses `createJson5SchemaExtensions` instead and is not on this path.

---

## Settings JSON Schema

Settings JSON is JSONC (`comment-json` on save). The editor attaches `createJson5SchemaExtensions(buildJsonSchema(studio.settings.getSchemas()))` so comments and trailing commas parse. `EVENT_SETTINGS_SCHEMA_REGISTERED` calls `updateJsonSchema` on the wrapper.

Stock JSON Schema coverage from `codemirror-json-schema`: property-key completion, enum completion, type/enum/min/max/pattern squiggles, hover of `description`. VS Code dialect fields (`deprecationMessage`, `enumDescriptions`, `markdownDescription`, `patternErrorMessage`) are not mapped.

Root `additionalProperties` is `false`. Unregistered keys (leftover plugin settings) must not use `additionalProperties: { not: true, errorMessage: 'Unknown setting.' }` — json-schema-library ignores `errorMessage` and shows "Value `false` at pointer should not match schema `true`". `createJson5SchemaExtensions` rewrites additional-property diagnostics to a **warning** with message `Unknown setting.`. Save still succeeds: `validateSettings` ignores unknown keys.

Save remains gated by `UserSettingsDocumentModel.isInvalidJSON()` + `settings.merge()`.

---

## Theming

JSON / JavaScript / HTML / XML languages do not emit FEEL's `.string` / `.variableName` decoration classes. Host coloring is `syntaxHighlighting(classHighlighter)` (`tok-*` on tokens) plus:

1. `EditorView.theme()` in `CodeEditorTheme.ts` — `color: var(--theme-feel-*)` on `& .tok-*` (same tokens as `FeelEditorTheme`)
2. `[data-code-editor] .tok-*` in `component.code-editor.scss` — stylesheet backup so coloring does not depend on StyleModule injection

Do not paint host syntax with `--theme-cm-*`. Named themes (`vscode-dark`, `zed-dark`, …) only add `bifrost-theme--{id}`; they do **not** also add `--light` / `--dark` unless the id is a `plugin.*` theme. `--theme-feel-*` is defined in every theme file; `--theme-cm-*` aliases now live on `.bifrost` so they inherit those feel tokens. Rainbow brackets stay on `--theme-cm-bracket-0` … `5` (dark defaults on `.bifrost`, light overrides on known light theme classes). Theme switching is a CSS class swap; the wrappers do not subscribe to `EVENT_THEME_CHANGED`.

---

## Test selectors

All host code editors and FEEL editors expose `.cm-content`. `StudioAgent.clickOnCodeEditor` / `getCodeEditorText` always target `.cm-content`. `clickOnCodeEditor` also select-all + backspace before returning — CodeMirror inserts at the caret, so tests that type a replacement must start from an empty document. To distinguish FEEL from generic source, probe a `.feel-editor` ancestor, not a different engine. Native `PaneProperty` inputs are not CodeMirror; those tests use `clearTextInput`.

---

## File Path Reference

| Component | Path |
|-----------|------|
| MultiLineCodeEditor | `studio/src/components/MultiLineCodeEditor.tsx` |
| DiffEditor | `studio/src/components/DiffEditor.tsx` |
| CodeMirror kit | `studio/src/components/code-editor/` |
| Settings JSON renderer | `studio/src/modules/std/settings/SettingsJsonDocumentRenderer.tsx` |
| Schema builder | `studio/src/modules/std/settings/validation/schemaToJsonSchema.ts` |
| FEEL editors | `studio-sdk/src/components/FeelEditor.tsx`, `OneLineFeelEditor.tsx` |
| Agent helpers | `studio/test/StudioAgent.ts` (`clickOnCodeEditor`, `clearCodeEditor`, `getCodeEditorText`) |
