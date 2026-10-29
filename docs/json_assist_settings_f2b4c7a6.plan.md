---
name: JSON assist for CodeMirror (replaces codemirror-json-schema)
overview: Replace codemirror-json-schema with a small Studio-owned JSON/JSON5 assist layer (lint, completion, hover) driven by a pluggable backend. The Settings JSON editor gets a descriptor-based backend that validates exactly like the save path; the layer is shaped so later contract-authoring and contract-testing backends plug in unchanged.
todos:
  - id: validator-paths
    content: Add a `path` to every SettingsValidator error (Studio-internal located error type), keys and messages unchanged
    status: pending
  - id: json-syntax-paths
    content: Create components/code-editor/jsonSyntaxPaths.ts (path at position, range of path) for the JSON and JSON5 syntax trees
    status: pending
  - id: json-assist
    content: Create components/code-editor/jsonAssist.ts (JsonAssistBackend interface, extensions for lint, completion and hover, backend swap effect)
    status: pending
  - id: deprecated-style
    content: Add the strikethrough mark class for deprecated settings to component.code-editor.scss
    status: pending
  - id: multiline-editor
    content: Switch MultiLineCodeEditor from jsonSchema/updateJsonSchema to jsonAssist/updateJsonAssist; delete json5SchemaExtensions.ts and unknownSettingDiagnostics.ts; update code-editor/index.ts
    status: pending
  - id: settings-backend
    content: Create std/settings/validation/settingsJsonAssist.ts; delete schemaToJsonSchema.ts
    status: pending
  - id: settings-models
    content: Replace getJsonSchema with getJsonAssist in both settings document models; extract the scoped save-time validation into one method used by save and editor
    status: pending
  - id: settings-renderer
    content: Wire SettingsJsonDocumentRenderer to jsonAssist with language json5
    status: pending
  - id: remove-dependency
    content: npm uninstall codemirror-json-schema; confirm the 48 exclusive packages and the audit findings are gone
    status: pending
  - id: unit-tests
    content: Add unit tests (syntax paths, completion via public extensions, settings backend, validator paths); delete the obsolete tests
    status: pending
  - id: integration-test
    content: Add test/integration/studio-core/settings-json-editor.test.ts (lint, completion, hover in the real editor)
    status: pending
  - id: docs
    content: Update code-editors.md, settings.md, decisions.md and common-pitfalls.md
    status: pending
  - id: verify
    content: Run build, tsc, lint:fix, format, test:unit; check bundle and audit; review the diff
    status: pending
  - id: integration-run
    content: Ask the user, then run npm run test:integration:core
    status: pending
isProject: false
---

# JSON assist for CodeMirror (Option C+)

**Ziel:** Replace `codemirror-json-schema` with a Studio-owned JSON/JSON5 assist layer whose Settings backend validates exactly like saving, and whose backend interface already fits the planned contract-authoring and contract-testing tools.

## Eingaben-Nachweis

- **`components/code-editor/json5SchemaExtensions.ts`**: builds `json5()`, a `json5ParseLinter()` linter, a schema linter wrapped by `rewriteUnknownSettingDiagnostics` with `needsRefresh: handleRefresh`, `json5Completion()` via `json5Language.data`, `hoverTooltip(json5SchemaHover())` and `stateExtensions(schema)`. This is the complete surface to replace.
- **`components/MultiLineCodeEditor.tsx`**: the `jsonSchema?: object` prop switches to the JSON5 bundle and turns on the lint gutter. `updateJsonSchema()` and a `useEffect` on `props.jsonSchema` call `updateSchema()`. The editor mounts once; schema changes go through the imperative method.
- **`components/code-editor/unknownSettingDiagnostics.ts`** and its test: they rewrite json-schema-library's "should not match schema" / "Additional property" messages to the warning `Unknown setting.`. This workaround exists only because editor and save validate with different rules.
- **`bifrost/common/SettingsValidator.ts`**: `validateSetting(key, value, descriptor)` recurses with string keys. Object items use `` `${key}[${i}].prop` ``. Primitive items report the bare `key` plus the message "Item at index i". `validateSettings` skips unregistered keys. Callers: `SettingsManager`, `SettingsMediator` (4×), `ScopedSettingsDocumentModel`; none compares error objects structurally.
- **`std/settings/validation/schemaToJsonSchema.ts`** and `test/unit/settings/schemaToJsonSchema.test.ts`: they map descriptors to JSON Schema, with root `additionalProperties: false`, VS Code fields (`markdownDescription`, `enumDescriptions` from `enumDescriptions` or `enumLabels`, `deprecationMessage`, `patternErrorMessage`) and color/date patterns. The test checks that the scoped schema marks ineligible keys with `ineligibleSettingMessage(scope)`.
- **`studio-sdk/src/contracts/SettingTypes.ts`**: `SettingValidationError { key, message, expected, actual }`. Its doc comments promise a strikethrough deprecation on hover, a `markdownDescription` hover and `enumDescriptions` in autocomplete; today's library delivers none of them (docs: "not mapped").
- **`ScopedSettingsDocumentModel.ts` / `UserSettingsDocumentModel.ts` / `SettingsJsonDocumentRenderer.tsx`**:
  - Both models expose `getJsonSchema()`.
  - The scoped save loop skips unregistered keys and reports ineligible keys as errors (`ineligibleSettingMessage`); otherwise it calls `validateSetting`.
  - The user save goes through `settings.merge` → `validateSettings`.
  - Both parse with `comment-json`.
  - The renderer passes `language="json"` and `jsonSchema`, and calls `updateJsonSchema` on `EVENT_SETTINGS_SCHEMA_REGISTERED`.
- **`codemirror-json5` (dist)**: exports `json5()` (with `json5ParseCache` and `jsonCursorPath`), `json5Language` and `json5ParseLinter(structureLinter?)`. `json5ParseLinter` reports parse errors itself and passes the parsed object to a structure linter. `jsonCursorPath` only tracks the selection and has no path→range direction, so it is not enough.
- **Lezer trees (checked by parsing real samples)**:
  - JSON names: `JsonText Object Property PropertyName : , Array String Number True False Null ⚠`.
  - JSON5 names: `File Object Property PropertyName PropertyColon Array … LineComment BlockComment ⚠`, with no comma nodes.
  - Half-typed text: `{ "a": [1, 2], "b` yields `⚠[15,16] Property > PropertyName[16,17]`. `{ "a": ` yields `Property > PropertyName, :, ⚠`.
- **`plugins/PluginReadmeRenderer.tsx` and `electron-main/BifrostWindow.ts`**: the Studio's pattern for plugin-supplied Markdown is `marked.parse` → `DOMPurify.sanitize`. The main window guards `will-navigate` and `setWindowOpenHandler`, so links in rendered HTML cannot navigate the app.
- **`test/unit/components/jsonParseLinter.test.ts`**: headless CodeMirror tests with `EditorState.create` work in the unit runner, which has no DOM.
- **Contract panes (`PropertiesPayloadContract.tsx`, `PropertiesResultContract.tsx`, `PropertiesDataObject.tsx`, `PropertiesExamplePayload.tsx`)**: they use `MultiLineCodeEditor language="json"` without a schema. They are the future consumers of the JSON dialect; this plan does not change them.
- **`npm audit` / lockfile**: deepmerge GHSA-gcqx-w48m-w2h4 (low) via json-schema-library 9.3.5 via codemirror-json-schema. 48 packages exist only for codemirror-json-schema (shiki stack, markdown-it, json-schema-library, deepmerge, …).

## Design

### Layer 1 — `components/code-editor/jsonSyntaxPaths.ts` (syntax-tree navigation, no CodeMirror UI)

```ts
export type JsonPath = (string | number)[];
export type JsonPathLocation = { path: JsonPath; slot: 'key' | 'value'; from: number; to: number; existingKeys: string[] };
export function jsonPathAt(state: EditorState, pos: number): JsonPathLocation | null;
export function jsonRangeOf(state: EditorState, path: JsonPath): { from: number; to: number } | null;
```

- It works on `syntaxTree(state)` for both grammars:
  - the root is `JsonText` or `File`;
  - comments are skipped;
  - array indices count only value nodes (`Object Array String Number True False Null ⚠`), never punctuation.
- Property names are unquoted (`'…'`, `"…"`, bare JSON5 identifiers).
- `jsonPathAt` returns the path, whether the position is a key or a value, and the token range to replace (`from`/`to`; the partial token including an opening quote, also when the quote is a `⚠` node). It also returns the keys already present in the enclosing object.
- `jsonRangeOf` returns the value range for a path. If that node is missing, it falls back to the deepest existing ancestor, and for the empty path to the root value.
- Purpose split: this file is pure tree navigation, shared by the lint, completion and hover wiring in `jsonAssist.ts`. Contract tooling will reuse it with a different backend.

### Layer 2 — `components/code-editor/jsonAssist.ts` (CodeMirror wiring)

```ts
export type JsonAssistDiagnostic = { path: JsonPath; message: string; severity: 'error' | 'warning'; deprecated?: boolean };
export type JsonAssistCompletion = { label: string; insertText: string; detail?: string; info?: string };
export interface JsonAssistBackend {
  validate(value: unknown): JsonAssistDiagnostic[];
  describe?(path: JsonPath): string | null;            // Markdown
  complete?(location: JsonPathLocation): JsonAssistCompletion[];
}
export function createJsonAssistExtensions(dialect: 'json' | 'json5', backend: JsonAssistBackend): Extension[];
export function updateJsonAssist(view: EditorView, backend: JsonAssistBackend): void;
```

- The backend lives in a `StateField`. `updateJsonAssist` dispatches a `StateEffect`, and the linter's `needsRefresh` reacts to it (as `handleRefresh` does today).
- **Lint**:
  - JSON5 uses `linter(json5ParseLinter(structureLinter))` from `codemirror-json5`, which reports parse errors and passes the parsed value.
  - JSON uses `jsonParseLinterExtension()` for parse errors, plus `linter()` that parses with `JSON.parse` and returns `[]` when parsing fails.
  - Every backend diagnostic is mapped with `jsonRangeOf`. `deprecated: true` adds `markClass: 'cm-json-assist-deprecated'`.
- **Completion**: the source is registered through `json5Language.data.of` / `jsonLanguage.data.of`. It calls `jsonPathAt(state, pos)` and returns `{ from, to, options, validFor }`.
  - Key slot: replace the partial token with `insertText`. When the property already has a colon, insert only the quoted key.
  - Value slot: replace the value token.
  - Without a partial token, results appear only on explicit completion (Ctrl+Space) or after a typed character.
- **Hover**: `hoverTooltip` with `jsonPathAt` → `backend.describe(path)` → `marked.parse(md, { async: false })` → `DOMPurify.sanitize` → tooltip DOM (class `cm-json-assist-hover`).
- The paths reported by validators convert cleanly from both future sources: ajv `instancePath` (`/a/0/b`) and json-schema-library pointers (`#/a/0/b`).

### Layer 3 — `std/settings/validation/settingsJsonAssist.ts` (Settings backend)

```ts
export function createSettingsJsonAssist(
  registry: Map<string, SettingDescriptor>,
  options: { validateLayer: (layer: Record<string, unknown>) => LocatedSettingValidationError[]; isKeyOffered: (key: string) => boolean },
): JsonAssistBackend;
```

- **validate**:
  - a non-object root gives the error `Settings layer must be a JSON object.` at `[]`;
  - otherwise the result is `validateLayer(layer)` mapped to diagnostics (`path`, `message`, `error`);
  - unregistered keys get the warning `Unknown setting.` at `[key]`;
  - registered keys with `deprecated` get a warning carrying the deprecation message, with `deprecated: true`.
- **describe**: resolves the descriptor along the path (top-level key, `items.properties`, object `properties`). It returns `markdownDescription ?? description`, plus a deprecation line when set.
- **complete**:
  - key slot at the root: registered keys that pass `isKeyOffered` and are not in `existingKeys`. `insertText` is `"key": <JSON.stringify(default)>`, `detail` is the label, `info` is the description.
  - key slot inside object items or object settings: the property names from the descriptor.
  - value slot: enum values (detail from `enumDescriptions`, else `enumLabels`), `true`/`false` for booleans, and always the default.

### Validator paths (`SettingsValidator.ts`)

- New exported type `LocatedSettingValidationError = SettingValidationError & { path: (string | number)[] }`. The SDK type stays as it is; the extra field is Studio-internal and structurally compatible with every existing caller.
- `validateSetting(key, value, descriptor)` keeps its signature and delegates to a private recursive function that carries the path. Paths:
  - `[key]` for top-level values;
  - `[key, prop]` for object properties;
  - `[key, i, prop]` for object items;
  - `[key, i]` for primitive items, which fixes the "whole list underlined" case.
- `key`, `message`, `expected` and `actual` stay byte-identical. `validateSettings` returns the located errors too.

### Consumers

- **`MultiLineCodeEditor`**:
  - prop `jsonAssist?: JsonAssistBackend` replaces `jsonSchema`;
  - method `updateJsonAssist(backend)` replaces `updateJsonSchema`;
  - with `jsonAssist` set, `buildExtensions` uses `createJsonAssistExtensions(language === 'json5' ? 'json5' : 'json', backend)` and turns on the lint gutter;
  - the `useEffect` on the prop calls `updateJsonAssist`.
- **`UserSettingsDocumentModel.getJsonAssist()`**: `validateLayer = (layer) => validateSettings(layer, schemas).errors`, `isKeyOffered = () => true`.
- **`ScopedSettingsDocumentModel`**:
  - the save loop moves into the private `validateLayer(layer)`, which `saveEditorDocument` and `getJsonAssist()` both use, so editor and save agree;
  - the ineligible error gets `path: [key]`;
  - `isKeyOffered = (key) => settings.isEligibleForScope(key, scope)`.
- **`SettingsJsonDocumentRenderer`**: `language="json5"`, `jsonAssist={backend}`. `EVENT_SETTINGS_SCHEMA_REGISTERED` and model init call `model.getJsonAssist()` and `updateJsonAssist`.

### Contract seam, checked on paper (not implemented)

- **Authoring** a contract (JSON dialect, Payload/Result/Value Contract panes):
  - `complete` returns JSON Schema keywords for key slots, and `type`/`format` values for value slots;
  - `describe` returns keyword docs;
  - `validate` checks keyword value types, or a meta-schema through a library added then.
  - It needs nothing beyond the interface above.
- **Testing** a contract (JSON dialect, Example Payload pane):
  - `validate` runs the element's contract through ajv or json-schema-library 11 and converts `instancePath` to `JsonPath`;
  - `complete` and `describe` resolve the subschema at the path (json-schema-library `getNode`).
  - It needs nothing beyond the interface above; the validator library arrives with that feature.

## Pre-conditions

- `codemirror-json5` ^1.0.3, `json5` ^2.2.3, `marked` ^18, `dompurify` ^3.4, `@codemirror/lint` ^6.9.7 (with `needsRefresh`) and `@codemirror/lang-json` ^6.0.2 are direct dependencies (verified in `studio/package.json`).
- The working tree builds and its unit tests pass (true at the end of the landscape work).

## Scope

- **New:**
  - `studio/src/components/code-editor/jsonSyntaxPaths.ts`
  - `studio/src/components/code-editor/jsonAssist.ts`
  - `studio/src/modules/std/settings/validation/settingsJsonAssist.ts`
  - `studio/test/unit/components/jsonSyntaxPaths.test.ts`
  - `studio/test/unit/components/jsonAssist.test.ts`
  - `studio/test/unit/settings/settingsJsonAssist.test.ts`
  - `studio/test/integration/studio-core/settings-json-editor.test.ts`
- **Changed:**
  - `SettingsValidator.ts`
  - `MultiLineCodeEditor.tsx`
  - `code-editor/index.ts`
  - `component.code-editor.scss`
  - `UserSettingsDocumentModel.ts`
  - `ScopedSettingsDocumentModel.ts`
  - `SettingsJsonDocumentRenderer.tsx`
  - `studio/package.json` and `package-lock.json`
  - docs
- **Deleted:**
  - `json5SchemaExtensions.ts`
  - `unknownSettingDiagnostics.ts`
  - `schemaToJsonSchema.ts`
  - `test/unit/components/unknownSettingDiagnostics.test.ts`
  - `test/unit/settings/schemaToJsonSchema.test.ts`
- **Not touched:** the SDK, contract panes, `languageSupport.ts`, the `comment-json` save path.

## Assumptions

- `MultiLineCodeEditor` with a JSON schema has a single consumer (Settings JSON); the SDK does not expose it (verified).
- Hidden settings stay offered in the User editor, as today (the current schema includes them).
- The scoped editor stops offering ineligible keys, because inserting one blocks saving. Typed ineligible keys show the save-time error in the editor.
- Diagnostic wording becomes the `SettingsValidator` wording, which matches the save-time toolbar message.

## Risks

- **Completion in half-typed text** (main risk): Lezer error recovery produces `⚠` nodes, identifier-like property names and missing values. Mitigation: unit tests on real trees for each case in the checklist, in both dialects.
- **Behaviour changes users notice**: deprecated keys become warnings with strikethrough; ineligible keys become errors in the scoped editor (save already rejected them); messages change wording. All three match the SDK's documented intent or the save path.
- **Security**: descriptions come from plugins. Markdown goes through `DOMPurify.sanitize`; window navigation is already guarded in the main process.
- **Performance**: validation runs per lint pass (debounced by `@codemirror/lint`); settings documents are small. Path lookup is a tree walk per diagnostic.
- **Pre-existing, unchanged**: the editor accepts JSON5 while saving parses with `comment-json`. Unquoted keys and single quotes pass the editor but fail on save with "Please provide valid JSON.". Out of scope; the plan neither worsens nor fixes it.
- **Backward compatibility**: the SDK is unchanged. `MultiLineCodeEditor`'s `jsonSchema` prop and `updateJsonSchema` method disappear; there are no other callers.
- **Operations/topology**: single-window renderer code only; no IPC, persistence or engine contact.

## Definition of Done

- `codemirror-json-schema` is no longer in `studio/package.json`. `npm ls codemirror-json-schema json-schema-library deepmerge shiki markdown-it` is empty, and `npm audit` no longer lists the deepmerge advisory.
- The renderer bundle (`studio/out/bundle-electron-renderer.js`) no longer contains `createHighlighterCore`.
- The Settings JSON editor shows:
  - completion for keys, enum values and booleans;
  - hover with `markdownDescription` / `description`;
  - type/enum/range/pattern errors at the exact value, including primitive list items;
  - `Unknown setting.` warnings;
  - deprecated warnings with strikethrough;
  - in the scoped editor, the same ineligible-key error as on save.
- The new unit tests and the new integration test pass. `npm run build`, both `tsc --noEmit` configs, `lint:fix`, `format` and `test:unit` are green. The `test:integration:core` suite passes after user approval.
- Docs describe the new layer; no reference to `codemirror-json-schema`, `json5SchemaExtensions`, `unknownSettingDiagnostics` or `schemaToJsonSchema` remains in `docs/` or `studio/src`.

## Checklist

1. **validator-paths** — In `SettingsValidator.ts`:
   - export `LocatedSettingValidationError`;
   - add the private recursive function with a `path` parameter, and have `validateSetting` and `validateObjectProperties` delegate to it;
   - set the paths as listed in the Design section;
   - type `validateSettings`' result as `{ valid: boolean; errors: LocatedSettingValidationError[] }`.

   Do not change `key`, `message`, `expected` or `actual`.
2. **json-syntax-paths** — Create `jsonSyntaxPaths.ts` with `JsonPath`, `JsonPathLocation`, `jsonPathAt` and `jsonRangeOf` as designed. It handles both root names, comments, the value-node-only index counting, quote stripping, and partial tokens including a `⚠` opening quote.
3. **json-assist** — Create `jsonAssist.ts`:
   - the backend `StateField`, the `StateEffect` and `updateJsonAssist`;
   - the dialect-specific language plus parse linting, the structure lint mapped with `jsonRangeOf` and `needsRefresh` on the effect;
   - the completion source via `json5Language.data` / `jsonLanguage.data`;
   - `hoverTooltip` with `marked` → `DOMPurify`.
4. **deprecated-style** — Add `.cm-json-assist-deprecated { text-decoration: line-through; }` and a hover content style (`.cm-json-assist-hover`, padding and max width, using existing theme tokens) to `component.code-editor.scss`.
5. **multiline-editor** — In `MultiLineCodeEditor.tsx`:
   - replace the `jsonSchema` prop with `jsonAssist`, and `updateJsonSchema` with `updateJsonAssist`;
   - update `buildExtensions` and the `useEffect`;
   - drop the `codemirror-json-schema` and `json-schema` imports;
   - update the doc comment.

   Delete `json5SchemaExtensions.ts` and `unknownSettingDiagnostics.ts`. In `code-editor/index.ts`, replace the `createJson5SchemaExtensions` export with `createJsonAssistExtensions`, `updateJsonAssist` and the types.
6. **settings-backend** — Create `settingsJsonAssist.ts` with `createSettingsJsonAssist(registry, { validateLayer, isKeyOffered })` (validate, describe, complete as designed; enums via `resolveSettingEnum`). Delete `schemaToJsonSchema.ts`.
7. **settings-models** — `UserSettingsDocumentModel`: replace `getJsonSchema` with `getJsonAssist()`. `ScopedSettingsDocumentModel`:
   - move the save loop into the private `validateLayer`, adding `path: [key]` to the ineligible error;
   - use it in `saveEditorDocument`;
   - replace `getJsonSchema` with `getJsonAssist()`.
8. **settings-renderer** — In `SettingsJsonDocumentRenderer.tsx`:
   - state holds the backend;
   - pass `language="json5"` and `jsonAssist`;
   - on schema registration and model init, call `getJsonAssist()` and `updateJsonAssist`;
   - remove the `buildJsonSchema` import.
9. **remove-dependency** — In `studio/`: `npm uninstall codemirror-json-schema`. Check `npm ls codemirror-json-schema json-schema-library deepmerge shiki markdown-it` (empty) and `npm audit` (no deepmerge finding).
10. **unit-tests** — Add:
    - `jsonSyntaxPaths.test.ts`, both dialects:
      - nested object/array paths;
      - comments between items (JSON5);
      - `jsonRangeOf` for `[key]`, `[key, i]`, `[key, i, prop]`;
      - missing path falls back to the ancestor;
      - partial tokens `{ "bpmn.ed`, `{ bpm` (JSON5), `{ "a": ` and `{ "a": [ { "x": `;
      - `existingKeys`.
    - `jsonAssist.test.ts`: completion through `state.languageDataAt('autocomplete', pos)` on a state built with `createJsonAssistExtensions(...)` and a stub backend:
      - correct `from`/`to` for quoted, unquoted and empty partials;
      - only the key is inserted when a colon follows;
      - nothing on an implicit request at whitespace.
    - `settingsJsonAssist.test.ts`:
      - unknown-key warning;
      - deprecated warning flag;
      - exact paths for a primitive item and an object item;
      - non-object root;
      - scoped ineligible error and `isKeyOffered` filtering (port the existing ineligible-scope test via `ScopedSettingsDocumentModel.create`);
      - enum/boolean/default value completions with descriptions;
      - `describe` prefers `markdownDescription`.
    - A validator path test in `test/unit/settings/settingsValidatorPaths.test.ts`, via `validateSetting`.

    Delete the two obsolete test files.
11. **integration-test** — Add `test/integration/studio-core/settings-json-editor.test.ts`. Open `about:settings-json` and set a document containing:
    - an unknown key;
    - a wrong-typed registered value;
    - a primitive-list item of the wrong type (if a registered primitive-array setting exists; else skip that case).

    Assert:
    - `.cm-lintRange-warning` on the unknown key and `.cm-lintRange-error` on the exact wrong values;
    - Ctrl+Space after a partial key opens `.cm-tooltip-autocomplete` containing the registered key;
    - hovering a key shows `.cm-json-assist-hover` with its description;
    - `assertNoErrorsPresentAndIdle()`.
12. **docs**:
    - `code-editors.md`: replace §Settings JSON Schema with §JSON assist (layers, interface, dialects); update the props table and file table.
    - `settings.md`: update the JSON Editor bullets (line ~349), §84 (getJsonAssist), and the file-table rows for the deleted and new files.
    - `decisions.md`: entry "Own JSON assist instead of codemirror-json-schema" (Context / Options A, B, C, C+ / Decision C+ / Rationale / See `architecture/code-editors.md`).
    - `common-pitfalls.md`: entry "Lezer JSON and JSON5 trees differ" (root name, comma nodes, PropertyColon, `⚠` partial quotes).
    - Grep that no stale references remain.
13. **verify** — In `studio/`, run `npm run build`, both `npx tsc --noEmit -p` configs, `npm run lint:fix`, `npm run format` and `npm run test:unit`. Check that the bundle no longer contains `createHighlighterCore`. Review the full diff.
14. **integration-run** — Ask the user before running `npm run test:integration:core` (studio-core suite including the new test, about 10 minutes); run only after a yes.

Plan-Gate: bestanden.
