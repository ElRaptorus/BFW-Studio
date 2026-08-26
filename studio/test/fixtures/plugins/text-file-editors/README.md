# Text File Editors

A TypeScript example plugin providing Markdown and JSON editing via CodeMirror 6, replacing the Studio's removed built-in `editor-document-markdown-editor` and `editor-document-default-editor` document types.

## What is this?

Bifrost Forge World is purpose-built for BPMN/DMN process modelling. Generic text editors used to ship as a built-in fallback, but that blurred the Studio's scope and invited requests to support arbitrary file formats. They have been removed from Studio core (see [docs/decisions.md](../../../../docs/decisions.md)); this plugin demonstrates how to restore equivalent functionality using only the public Plugin API.

It registers two iframe-backed **Editor Document Types**:

- **Markdown** — matches `.md`, `.mdx`, `.mdc`, `.markdown`, `.mdown`, `.mkd`, `.mkdn` (the exact extension set the old built-in editor matched). Split-pane CodeMirror editor + live preview.
- **JSON** — matches `.json`. CodeMirror editor with a "Format" button and inline parse-error banner.

It exercises the following APIs:

| API                                                        | Namespace   | Purpose                                                                                   |
| ---------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `bifrostStudio.contributes.editorDocumentTypes` (manifest) | —           | Declares both document types statically, before activation — see "Lazy activation" below  |
| `api.editors.registerWebviewDocumentType()`                | `editors`   | Replaces the manifest placeholder with the real iframe-backed editor, inside `activate()` |
| `api.editors.onDidOpen()`                                  | `editors`   | Wires up per-document messaging when a tab opens                                          |
| `api.editors.onSaveRequest()`                              | `editors`   | Handles host-triggered saves (Save menu, command palette)                                 |
| `api.editors.setDirty()`                                   | `editors`   | Marks/clears the unsaved-changes indicator                                                |
| `api.workspace.readFile()` / `writeFile()`                 | `workspace` | Reads file content on open, writes it back on save                                        |
| `api.webviews.postMessage()` / `onMessage()`               | `webviews`  | Bidirectional messaging between the plugin and each iframe                                |

## Lazy activation via `contributes.editorDocumentTypes`

This plugin does **not** declare `activationEvents` and is not loaded at Studio boot. Instead, `package.json`'s `bifrostStudio.contributes.editorDocumentTypes` declares both document types (`id`, `displayName`, `icon`, `uriPattern`, `includedFilePatterns`) statically. The Studio registers a lightweight **placeholder** editor document type for each entry at plugin-discovery time — before this plugin's code has ever run — which is enough to:

- make `.md`/`.mdx`/`.mdc`/`.markdown`/`.mdown`/`.mkd`/`.mkdn`/`.json` files visible in the File Explorer immediately (no "Show hidden files" needed), and
- let a user open one of those files, which shows a brief "Activating plugin…" tab, triggers this plugin's real activation (including the permission dialog, since it declares `filesystem`), and then automatically swaps in the real CodeMirror editor once `activate()` calls `api.editors.registerWebviewDocumentType()`.

See [docs/architecture/plugin-host.md](../../../../docs/architecture/plugin-host.md) §"Static editor document type contributions" for the full placeholder-and-swap mechanism, and [docs/architecture/common-pitfalls.md](../../../../docs/architecture/common-pitfalls.md#declaring-contributeseditordocumenttypes-does-not-by-itself-register-a-webview) for what goes wrong if the manifest declaration and the real `registerWebviewDocumentType()` call ever drift out of sync (e.g. a typo in `id`).

**Important**: `includedFilePatterns` is declared **only once**, in the manifest's `contributes.editorDocumentTypes` entry — it is intentionally **not** repeated in the `activate()`-time `registerWebviewDocumentType()` call (see `src/index.ts`'s `registerDocumentType` helper), since that call's only job is to replace the placeholder's renderer, not to re-declare File Explorer visibility.

## Opening a file

Any `.md`/`.mdx`/`.mdc`/`.markdown`/`.mdown`/`.mkd`/`.mkdn` or `.json` file opened through the File Explorer, Quick Open, or `focusOrOpenEditorDocument` is routed to these document types automatically — exactly like a core module's registration. No commands are required.

## Saving — two paths

Because the editor content lives inside a sandboxed `<iframe>`, saving is handled through two independent paths that both funnel into the same `persist(uri)` helper in `src/index.ts`:

1. **Host-triggered saves** (File > Save, the Save command, or the unsaved-changes-on-close dialog) call `bifrost.editors.saveEditorDocument()` directly, regardless of keyboard focus. These are handled via `api.editors.onSaveRequest(uri, callback)`.
2. **In-iframe Ctrl+S** — pressing Ctrl+S / Cmd+S while the cursor is inside the CodeMirror instance. Keydown events originating inside an `<iframe>` never bubble to the host's `KeybindingsMediator` (bound to `document.body` of the main renderer window) — this is standard DOM/browser iframe isolation, not a Studio bug. Both `webview/src/markdown.ts` and `webview/src/json.ts` therefore install their own `keydown` listener that calls `event.preventDefault()` and relays a `{ type: 'save-requested' }` message to the backend, which the backend handles identically to `onSaveRequest`.

See [docs/architecture/common-pitfalls.md](../../../../docs/architecture/common-pitfalls.md) §"Ctrl+S does not reach the host from inside a plugin webview iframe" for the full write-up — this constraint applies to any webview-backed editor, not just this plugin.

Edits are relayed to the backend as undebounced `change` messages on every keystroke (a `postMessage` of a text string is cheap), so the backend's cached content is always fresh enough to answer either save path immediately without risking a stale write.

## Known limitations

- **Ctrl+S focus dependency**: Ctrl+S only reaches the host's keybinding system when focus is outside the iframe. While typing, the webview must intercept and relay the shortcut itself (see above) — a general constraint for any webview-backed editor, worth remembering if you copy this plugin as a template.

## File Explorer visibility

Each manifest `contributes.editorDocumentTypes` entry carries `includedFilePatterns` (e.g. `['**/*.md', '**/*.mdx', ...]`), the declarative counterpart to the internal-module-only `bifrost.solution.registerDefaultIncludedFiles()`. `ContributionRegistrar` forwards these patterns to `registerDefaultIncludedFiles()` at discovery time — before this plugin ever activates — so `.md`/`.json` files are visible in the File Explorer immediately, rather than only after the plugin has run. Without it, these files would stay hidden unless "Show hidden files" is enabled, since the Studio's file tree only shows files matching _some_ registered include pattern by default (the Studio is scoped to BPMN/DMN file types). The patterns are automatically unregistered when the plugin is disabled, reloaded, or uninstalled.

## Project structure

```
text-file-editors/
├── package.json           # Plugin manifest (main: dist/index.js)
├── tsconfig.json           # Backend TypeScript config
├── README.md                # This file
├── src/
│   └── index.ts             # Plugin backend (activate/deactivate)
├── dist/
│   └── index.js              # Compiled backend (CommonJS)
└── webview/
    ├── package.json          # Frontend dependencies (CodeMirror, marked, dompurify, esbuild)
    ├── tsconfig.json          # Frontend TypeScript config
    ├── build.mjs               # esbuild bundler script
    ├── src/
    │   ├── types.ts            # Shared StudioWebviewApi types + Ctrl+S interceptor helper
    │   ├── markdown.ts          # CodeMirror EditorView + live preview (markdown editor)
    │   ├── json.ts              # CodeMirror EditorView + Format button (JSON editor)
    │   ├── markdown.html / markdown.css
    │   └── json.html / json.css
    └── dist/
        ├── markdown.html / markdown.js / markdown.css
        └── json.html / json.js / json.css
```

## Building from source

From `studio/`, compile both TypeScript fixtures (backend + webview) in one step:

```bash
npm run build:plugin-fixtures
```

**Backend only** (plugin host code):

```bash
cd studio/test/fixtures/plugins/text-file-editors
npx tsc
```

**Frontend** (iframe CodeMirror editors):

```bash
cd studio/test/fixtures/plugins/text-file-editors/webview
npm install
node build.mjs
```

The backend compiles `src/index.ts` → `dist/index.js` (CommonJS). The frontend bundles `webview/src/markdown.ts` → `webview/dist/markdown.js` and `webview/src/json.ts` → `webview/dist/json.js` (both IIFE via esbuild), and copies the HTML/CSS files to `webview/dist/`.

## Using this as a starting point

Copy this directory, rename the plugin in `package.json`, adjust `uriPattern`/`includedFilePatterns` in `package.json`'s `contributes.editorDocumentTypes` (keeping the matching `uriPattern` string in sync in `src/index.ts`'s `registerDocumentType` call) to match your target file type(s), and swap the CodeMirror language extension (`@codemirror/lang-*`) for the one you need. The `onSaveRequest` + `save-requested` dual save path and the undebounced `change` message pattern are reusable as-is for any text-based webview editor.
