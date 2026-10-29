# Host Code Editors

---

## Overview

Host multi-line source editing uses CodeMirror 6. Two React wrappers — `MultiLineCodeEditor` and `DiffEditor` — keep the class + inner-function pattern, blur-to-commit `onChange`, and the existing import paths. A small kit under `studio/src/components/code-editor/` supplies theme, language map, default extensions, rainbow brackets, JSON parse lint, and the JSON assist layer (lint, completion and hover from a pluggable backend).

These wrappers are **host-only**. They are never exported from `@elraptorus/bfw_studio_sdk`. FEEL editing stays a separate SDK widget (`FeelEditor` / `OneLineFeelEditor` wrapping `@bpmn-io/feel-editor`). Markdown documentation stays on `@mdxeditor/editor` (Lexical WYSIWYG). Plugin `text-file-editors` owns its own CodeMirror instance inside a webview.

---

## Architecture

```
MultiLineCodeEditor / DiffEditor   (studio/src/components/)
        │
        ▼
code-editor kit
  theme + highlighting   language map   default extensions
  rainbowBrackets()      jsonParseLinter   jsonAssist + jsonSyntaxPaths
        │
        ▼
@codemirror/view EditorView   /   @codemirror/merge MergeView
```

#### MultiLineCodeEditor

**Path:** `studio/src/components/MultiLineCodeEditor.tsx`

Public host API for JSON, JavaScript, XML, HTML, and plaintext. Mounts an `EditorView` once. Imperative methods: `focus()`, `getCurrentValue()`, `resetValue()`, `setValue()`. A changed `initialValue` prop replaces the document when it differs from the current text, so read-only views (Selection Inspectors) follow their input without a remount. Editable panes still remount with a **parent-identity** `key` (element id / flow-node-instance id) — never the live value — so undo history and cursor do not leak across elements.

| Prop | Notes |
|------|-------|
| `language` | Mapped by `getLanguageSupport`. `html` is HTML; XML inspectors pass `xml`. |
| `jsonAssist` | A `JsonAssistBackend`. When set, uses `createJsonAssistExtensions(language === 'jsonc' ? 'jsonc' : 'json', backend)` instead of the plain language and turns on the lint gutter. Settings JSON passes `language="jsonc"`. A new backend object is swapped in through `updateJsonAssist` without a remount. See §JSON assist. |
| `minimap` | No-op. Kept so existing callsites compile. |
| `modelPath` | Removed. Replaced by `jsonAssist`. |

The host div carries `data-code-editor="multiline"`. Tests click `.cm-content` inside that wrapper.

#### DiffEditor

**Path:** `studio/src/components/DiffEditor.tsx`

Side-by-side `@codemirror/merge` `MergeView`. Used by dialog `diff` content (`DialogRenderer`). Also used by the Git Cruiser text diff (`git.text-diff`) and by the XML view of `bpmn.diff` / `dmn.diff`. Left (`a`) is read-only ours; right (`b`) is theirs/result and is editable unless `readOnly`. `getCurrentValue()` returns the `b` document. `layout()` is a no-op. Host div: `data-code-editor="diff"`. The merge highlights (changed lines, changed text, change gutter) are themed in `component.code-editor.scss` through `--theme-cm-diff-*` aliases derived from `--theme-validation-success-fg` / `--theme-validation-error-fg`; the `@codemirror/merge` base theme colours are overridden, not used. Also used read-only for the Visual | XML view of `bpmn.diff` / `dmn.diff` documents.

#### Shared kit

**Path:** `studio/src/components/code-editor/`

| File | Responsibility |
|------|----------------|
| `CodeEditorTheme.ts` | `studioCodeMirrorTheme` + `studioCodeMirrorHighlighting` (`--theme-feel-*`, `tok-*` via `classHighlighter`) |
| `languageSupport.ts` | `getLanguageSupport(language)` — ids the host actually passes (`json`, `javascript`, `html`, `xml`); unknown → plaintext |
| `defaultExtensions.ts` | History, keymap (including Mod-Y redo), search, wrapping, bracket matching, close brackets, rainbow brackets, optional line numbers / lint gutter, read-only |
| `jsonParseLinter.ts` | Strict `JSON.parse` linter for contracts/tokens/dialogs — not Settings. Empty / whitespace-only docs are not linted |
| `jsonSyntaxPaths.ts` | `jsonPathAt(state, pos, side?)` → `JsonPathLocation`; `jsonRangeOf(state, path, target?)` → range. Pure syntax-tree navigation for both grammars |
| `jsonAssist.ts` | `JsonAssistBackend`, `createJsonAssistExtensions(dialect, backend)`, `updateJsonAssist(view, backend)` |
| `rainbowBrackets.ts` | In-house `ViewPlugin`; viewport decorations `cm-rainbow-bracket-0` … `5` |
| `component.code-editor.scss` | `--theme-cm-*` aliases on `.bifrost` (including `--theme-cm-diff-*`); `tok-*` syntax colors; six bracket colors; search panel (Ctrl+F: panel, text fields, buttons) and search-match highlights through `--theme-feel-*` (selectors under `.bifrost .cm-editor` outrank CodeMirror's `&dark` base theme); merge-view highlight overrides |

Language map (only ids host wrappers pass): `json`, `javascript`, `html`, `xml`. Unknown ids, `plaintext`, and `''` (documentation fragments) get no language package. FEEL is not in this map — it uses `FeelEditor`. Do not add `@codemirror/legacy-modes` or extra `@codemirror/lang-*` packages unless a real callsite needs them.

Shift+Enter blurs `MultiLineCodeEditor` (dialog / pane commit). Paste is native CodeMirror.

`jsonParseLinterExtension` wraps `@codemirror/lang-json`'s `jsonParseLinter`. Blank and whitespace-only documents return no diagnostics — optional JSON fields (payload/result contracts, unset tokens) mount an empty editor, and `JSON.parse('')` would otherwise show "Unexpected end of JSON input". Invalid JSON still squiggles. Settings JSON uses `createJsonAssistExtensions('jsonc', …)` instead and is not on this path.

---

## JSON assist

Lint, completion and hover for JSON and JSONC documents (dialects `json` and `jsonc`). Three layers; only the backend knows what the document means.

| Layer | Path | Role |
|-------|------|------|
| Syntax paths | `studio/src/components/code-editor/jsonSyntaxPaths.ts` | Position ↔ `JsonPath` (`(string \| number)[]`) on the Lezer tree |
| Wiring | `studio/src/components/code-editor/jsonAssist.ts` | CodeMirror extensions driven by a backend |
| Backend | e.g. `studio/src/modules/std/settings/validation/settingsJsonAssist.ts` | Validation, descriptions, completion items |

```ts
type JsonAssistDiagnostic = { path: JsonPath; message: string; severity: 'error' | 'warning'; target?: 'key' | 'value'; deprecated?: boolean };
type JsonAssistCompletion = { label: string; insertText: string; detail?: string; info?: string };
interface JsonAssistBackend {
  validate(value: unknown): JsonAssistDiagnostic[];
  describe?(path: JsonPath): string | null;          // Markdown
  complete?(location: JsonPathLocation): JsonAssistCompletion[];
}
type JsonPathLocation = { path: JsonPath; slot: 'key' | 'value'; key: string | null; from: number; to: number; existingKeys: string[] };
```

- **Location**: `slot: 'key'` → `path` is the enclosing object and `key` the name typed so far; `slot: 'value'` → `path` is the value. `from`/`to` cover the token including its quotes (equal in whitespace). Array indices count value nodes only.
- **Backend swap**: the backend lives in a `StateField`; `updateJsonAssist` dispatches a `StateEffect`, and the linters' `needsRefresh` re-lints on it.
- **Lint**: `jsonc` → the JSON5 grammar (`json5()`, for comments and trailing commas) and `json5ParseLinter(structureLinter)` from `codemirror-json5`. `JSON5.parse` errors come first; on a parsed document the structure linter reports, in this order, whatever `comment-json` (the Settings save parser) would reject, then the backend:
  - Token checks, only on a tree without `⚠` error nodes: unquoted or single-quoted `PropertyName` → "Property names need double quotes."; single-quoted `String` → "Strings need double quotes."; `Number` outside JSON's number syntax (`0x1F`, `+1`, `.5`, `1.`, `Infinity`, `NaN`) → "Not a JSON number.". Each carries a `Diagnostic.actions` fix (**Use double quotes**, **Convert to JSON number**) that rewrites the token with `JSON.stringify` of its `JSON5.parse` value; non-finite numbers have none.
  - Backstop when no token check fired: `comment-json.parse` errors (JSON5-only string escapes, raw control characters) as one error on the line the message names.
  - The backend runs only when both are clean, so a lint-clean document saves.

  `json` → `jsonParseLinterExtension()` plus a linter that runs the backend only when `JSON.parse` succeeds. Diagnostics map through `jsonRangeOf` (`target: 'key'` marks the property name; a missing path falls back to the deepest existing value). `deprecated: true` adds mark class `cm-json-assist-deprecated` (strikethrough).
- **Completion**: registered with `json5Language.data` / `jsonLanguage.data`. Filtering starts after an opening quote; `apply` replaces the whole token including both quotes. In a key slot followed by `:` only `JSON.stringify(label)` is inserted. In whitespace, results appear only on explicit completion (Ctrl+Space).
- **Hover**: `hoverTooltip` → `describe(path)` (key slot: `[...path, key]`) → `marked.parse(md, { async: false })` → `DOMPurify.sanitize` → `.cm-json-assist-hover`.

### Settings backend

`createSettingsJsonAssist(registry, { validateLayer, isKeyOffered })`:

- **validate**: non-object root → error `Settings layer must be a JSON object.` at `[]`; `validateLayer(layer)` errors at their `path` (the save-time validation, see [settings.md](settings.md) §JSON editors); unregistered keys → warning `Unknown setting.` on the key; `deprecated` descriptors → warning with the deprecation message, strikethrough.
- **describe**: `**label**`, `markdownDescription ?? description`, and `**Deprecated:** …` when set. Resolves through object `properties` and object-array `items.properties`.
- **complete**: root keys passing `isKeyOffered` and absent from `existingKeys` (`"key": <default>`, detail = label, info = description); keys of object settings and object items; values = enum entries (detail from `enumDescriptions`, else `enumLabels`), `true`/`false`, and the default.

---

## Theming

JSON / JavaScript / HTML / XML languages do not emit FEEL's `.string` / `.variableName` decoration classes. Host coloring is `syntaxHighlighting(classHighlighter)` (`tok-*` on tokens) plus:

1. `EditorView.theme()` in `CodeEditorTheme.ts` — `color: var(--theme-feel-*)` on `& .tok-*` (same tokens as `FeelEditorTheme`)
2. `[data-code-editor] .tok-*` in `component.code-editor.scss` — stylesheet backup so coloring does not depend on StyleModule injection

Do not paint host syntax with `--theme-cm-*`. Named themes (`vscode-dark`, `zed-dark`, …) only add `bifrost-theme--{id}`; they do **not** also add `--light` / `--dark` unless the id is a `plugin.*` theme. `--theme-feel-*` is defined in every theme file; `--theme-cm-*` aliases now live on `.bifrost` so they inherit those feel tokens. Rainbow brackets stay on `--theme-cm-bracket-0` … `5` (dark defaults on `.bifrost`, light overrides on known light theme classes). Theme switching is a CSS class swap; the wrappers do not subscribe to `EVENT_THEME_CHANGED`.

---

## Test selectors

All host code editors and FEEL editors expose `.cm-content`. `StudioAgent.clickOnCodeEditor` / `getCodeEditorText` always target `.cm-content`. `clickOnCodeEditor` also select-all + backspace before returning — CodeMirror inserts at the caret, so tests that type a replacement must start from an empty document. To distinguish FEEL from generic source, probe a `.feel-editor` ancestor, not a different engine. Native `PaneProperty` inputs are not CodeMirror; those tests use `clearTextInput`. `KeyValueJsonEditor` (Default Configured Start Payload, Example Payload, Example Result) starts in builder mode for empty or flat JSON — there is no `.cm-content` until "Switch to JSON".

---

## File Path Reference

| Component | Path |
|-----------|------|
| MultiLineCodeEditor | `studio/src/components/MultiLineCodeEditor.tsx` |
| DiffEditor | `studio/src/components/DiffEditor.tsx` |
| CodeMirror kit | `studio/src/components/code-editor/` |
| Settings JSON renderer | `studio/src/modules/std/settings/SettingsJsonDocumentRenderer.tsx` |
| Settings JSON assist backend | `studio/src/modules/std/settings/validation/settingsJsonAssist.ts` |
| FEEL editors | `studio-sdk/src/components/FeelEditor.tsx`, `OneLineFeelEditor.tsx` |
| Agent helpers | `studio/test/StudioAgent.ts` (`clickOnCodeEditor`, `clearCodeEditor`, `getCodeEditorText`) |
