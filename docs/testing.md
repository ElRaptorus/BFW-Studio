# Testing Architecture

This document describes the Studio's testing infrastructure, conventions, and patterns. It covers the test framework, test hierarchy, the StudioAgent API, selector conventions, and fixture management.


## Test Hierarchy

Tests run via npm scripts defined in `studio/package.json`:

| Script | Scope | Description |
|---|---|---|
| `test` | All | Runs all integration tests |
| `test:unit` | Unit | Runs unit tests only |
| `test:integration` | Integration | Runs all integration tests (alias for `test:integration:all`) |
| `test:integration:all` | Integration | Full integration suite across all test directories |
| `test:integration:bpmn-editor` | Integration | BPMN editor tests only (`test/integration/bpmn-editor/`) |
| `test:integration:dmn-editor` | Integration | DMN editor tests only (`test/integration/dmn-editor/`) |
| `test:integration:core` | Integration | Studio core tests (`test/integration/studio-core/`) |
| `test:integration:git-cruiser` | Integration | Git integration tests (`test/integration/git-cruiser/`) |
| `test:integration:plugins` | Integration | Plugin host tests (`test/integration/plugins/`) |
| `test:integration:smoke` | Integration | Minimal smoke test only |

**Important:** Integration tests require a built Electron application. Run `npm run build` before running integration tests. Plugin host tests also compile the TypeScript fixture plugins (`text-file-editors`, `webview-showcase`) first — `npm run test:integration:plugins` and `npm run test:integration:all` invoke `npm run build:plugin-fixtures` automatically because those plugins' `dist/` output is gitignored.

`npm run test-prod:electron <script>` runs the same suites against a packaged build by setting `TEST_APP_PATH`. On Linux that path is the unpacked ELF `dist/electron/linux-unpacked/bfw-studio-<version>` (`linux.executableName`), not the AppImage and not the `*-launcher` script. The name contains dots, so discovery must not reject filenames that include `.`. If `TEST_APP_PATH` is already set, that path is used as-is. GitHub Actions workflow `.github/workflows/studio.yml` builds the Linux prod app, uploads `dist/electron/`, resolves that binary, then runs matrix suites (`core`, `bpmn-editor`, `dmn-editor`, `plugins`, `git-cruiser`) under `xvfb-run`. `TestDriver` adds `--no-sandbox`, `--disable-gpu`, and `--disable-dev-shm-usage` when `CI`, `GITHUB_ACTIONS`, or `APPVEYOR` is set.

Private Engine packages (`@elraptorus/bfw_engine_sdk`, `@elraptorus/bfw_engine_client`) are fetched from GitHub Packages. `studio/.npmrc` maps that scope to `https://npm.pkg.github.com` and leaves the default registry as npmjs. CI writes `//npm.pkg.github.com/:_authToken=…` to `~/.npmrc` from repo secret `CI_AUTH` (`read:packages`). Do **not** set `actions/setup-node` `registry-url` to GitHub — that makes GitHub the default registry and breaks public packages.

### TypeScript Configuration

- Tests are compiled on-the-fly by Vitest (via esbuild) — they are not included in any build-time tsconfig
- Path aliases (`#bifrost`, `#components`, `#modules`) are configured in `studio/vitest.config.mts`

## Test Framework

- **Vitest 5** — Test runner for both unit and integration tests (configured in `studio/vitest.config.mts`). The file is `.mts` so Node loads it as ESM; `studio/package.json` is CommonJS for Electron and must not set `"type": "module"`. `testTimeout` and `hookTimeout` are `80_000` in that config — do not repeat `{ timeout: … }` on `describe` / `it` / hooks. `sequence.shuffle` is `{ files: true, tests: true }` (same as Vitest 4's boolean `true`: file order and test order both randomize). Opt a lifecycle `describe` out with `{ shuffle: false }`. Do not use `describe.sequential` / `test.sequential` — those APIs were removed in Vitest 5; use `{ concurrent: false }` if a suite must not run concurrently. WebDriverIO waits (`ASSERT_VISIBLE_TIMEOUT`, `waitForDisplayed`) are a separate layer.
- **WebDriverIO** — Browser automation for integration tests (via `TestDriver`)
- **ChromeDriver** (`electron-chromedriver`) — Drives the Electron application
- **assert** (Node built-in) — Assertion library

## Directory Structure

```
studio/test/
├── StudioAgent.ts              # High-level test API (wraps TestDriver)
├── StudioAgentBpmnExtension.ts # BPMN-specific test extensions
├── TestDriver.ts               # Low-level WebDriverIO client wrapper
├── helpers/
│   ├── InputSimulator.ts       # Keyboard/mouse input simulation
│   ├── LogCapture.ts           # Console log capture during tests
│   ├── OsSpecificKeystroke.ts  # Cross-platform keystroke handling
│   └── ScreenCapture.ts        # Screenshot capture on failure
├── fixtures/                   # Test data directories
│   ├── test-solution-simple/   # Single-root smoke: call_activity_test.bpmn + hidden-file.fixture
│   ├── test-solution-bpmn/     # BPMN files named by editor / plugin / linter tests
│   ├── test-solution-navigator/ # Navigation history (001.bpmn)
│   ├── test-solution-multi-a/  # Multi-root fixture: project A
│   ├── test-solution-multi-b/  # Multi-root fixture: project B
│   └── ...
└── integration/
    ├── bpmn-editor/            # BPMN editor tests
    │   ├── bpmn-smoke.test.ts
    │   ├── bpmn-elements.test.ts
    │   ├── bpmn-drilldown.test.ts
    │   └── form-builder.test.ts  # Form Builder fragment editor tests
    ├── bpmn-linter/            # Explorer lint + live-linter UX
    │   └── explorer-lint.test.ts
    ├── dmn-editor/             # DMN editor tests
    │   ├── dmn-smoke.test.ts
    │   └── dmn-elements.test.ts
    ├── git-cruiser/            # Git integration tests (BPMN + DMN)
    │   ├── git-cruiser.test.ts
    │   ├── git-bpmn-diff.test.ts
    │   ├── git-dmn-diff.test.ts
    │   └── git-merge-resolver.test.ts
    ├── plugins/                # Plugin host tests
    └── studio-core/            # Core smoke, solutions, machine sanctum
        ├── studio-smoke.test.ts
        ├── workbench-panes.test.ts
        ├── solutions-smoke.test.ts
        └── solutions.test.ts
```

## StudioAgent API

`StudioAgent` is the primary test API. It wraps WebDriverIO with domain-specific methods for interacting with the Studio.

### Lifecycle

**Pattern A: shared agent across tests** (most integration suites):

```typescript
import { beforeAll, beforeEach, afterEach, afterAll, describe, it } from 'vitest';
import type { TestContext } from './StudioAgent';

let studioAgent: StudioAgent;

beforeAll(async () => {
  studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
});

beforeEach(({ task }) => {
  studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
});

afterEach(async ({ task }) => {
  studioAgent.updateTestContext({
    testName: task.name,
    testFile: __filename,
    state: task.result?.state === 'fail' ? 'failed' : 'passed',
  });
  await studioAgent.recordErrors();
});

afterAll(async () => {
  await studioAgent.stop();
});
```

**Pattern B: agent per test** (solution tests, plugin-host tests):

```typescript
beforeEach(async ({ task }) => {
  studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
});

afterEach(async ({ task }) => {
  studioAgent.updateTestContext({
    testName: task.name,
    testFile: __filename,
    state: task.result?.state === 'fail' ? 'failed' : 'passed',
  });
  await studioAgent.stopAndRecordErrors();
});
```

**Plugin Host suites** use `createAndStartStudioAgentForPluginHost` instead of `createAndStartStudioAgent`. It sets `BFW_PLUGINS_DIR` (and optionally `BFW_SKIP_PERMISSION_DIALOG` / `BFW_PLUGIN_STORAGE_PATH`) before boot, then waits for named plugins to reach `PluginInfo.status === 'loaded'`. Call it from `beforeAll` (shared agent) or `beforeEach` (agent per test). `stopPluginHostStudioAgent` stops the app and restores the env snapshot.

```typescript
studioAgent = await createAndStartStudioAgentForPluginHost(
  { testName: task.name, testFile: __filename },
  { pluginsDirectory: PLUGINS_FIXTURE_DIR, waitUntilLoaded: ['kitchen-sink'] },
);
```

Default plugin readiness is `studioAgent.pluginHost.waitUntilStatus(name, 'loaded')` — that is set only after `activate()` finishes. `pluginHost.waitUntilCommandRegistered` is only for lazy **stub** commands on `pending` plugins, or for asserting that a command exists. A command registered at the start of `activate()` (kitchen-sink `getStatus`) is not a loaded signal.

Do not wait for plugin load inside `it()`. Waits that observe an action the test just performed (toggle → `disabled`, stub command → lazy `loaded`, crash → `quarantined`) stay in the test body via `pluginHost.waitUntilStatus`. Shared-agent suites that disable a plugin restore it in `afterEach` with `toggleAndWaitUntilStatus`, not at the end of the `it()`.

### Key Methods

| Method | Purpose |
|---|---|
| `openFixturesDirectoryAsSolution(name)` | Opens a fixture directory as single-root solution |
| `openSolutionFileFromFixtures(filename)` | Opens a `.bfwsln` file from fixtures as multi-root solution |
| `openDirectoryAsSolution(directory)` | Opens an arbitrary directory as solution |
| `openViaQuickJump(query)` | Opens a file via the Quick Jump dialog |
| `openViaCommandSearch(command)` | Executes a command via the command search |
| `clickOn(selector)` | Left-clicks on an element |
| `rightClickOn(selector)` | Right-clicks on an element |
| `clearTextInput(selector)` | Clears a native `<input>` / `<textarea>` (select-all is not enough; the caret may sit mid-value) |
| `getValue(selector)` | Reads the `value` of a native `<input>` / `<textarea>` |
| `clickOnCodeEditor(parentSelector)` | Focuses `.cm-content` inside the parent and **clears** it (CodeMirror inserts at the caret) |
| `clearCodeEditor(parentSelector)` | Alias of `clickOnCodeEditor` |
| `getCodeEditorText(parentSelector)` | Trimmed visible text of `.cm-content` inside the parent |
| `clearSuggestionSelect(propertySelector)` | Clicks the CreatableSelect clear **X** and waits until the inner search input is empty. Do not type a replacement until this returns |
| `getSuggestionSelectValue(propertySelector)` | Reads the committed CreatableSelect value after the menu closes: `.react-select__single-value` if present, otherwise the search input. Keep `getValue` on the input only when asserting empty |
| `commitSuggestionCreateOption(propertySelector, createdValue)` | Clicks the CreatableSelect `Use "…"` option after typing a new value; waits for the menu to close |
| `sendKeyboardInput(keys)` | Types keys into the focused element. Named keys: `'enter'` (mapped), `'Escape'` / `'escape'` (Escape), `'Backspace'`, `'Tab'`. A lowercase `'escape'` used to be typed as the letters e-s-c-a-p-e |
| `assertVisible(selector, timeout)` | Waits for element to be visible |
| `assertNotVisible(selector)` | Asserts element is not in the DOM |
| `waitForNotVisible(selector)` | Polls until the selector matches no elements |
| `assertNoErrorsPresentAndIdle()` | Asserts no React error boundaries and no loading indicators |
| `assertPaneVisible(paneId)` | Asserts a pane is displayed |
| `assertContextMenuVisible(timeout)` | Asserts a context menu is displayed |
| `getElementCount(selector)` | Counts matching elements |
| `getText(selector)` | Gets text content of an element |
| `waitForSolutionEntryCountChanged(prev)` | Polls until file explorer entry count changes |
| `getSolutionProjectCount()` | Returns the number of projects in the current solution |
| `getSolutionFileUri()` | Returns the `.bfwsln` file URI if present |
| `getSolutionProjectIds()` | Returns project IDs of the current solution |
| `addFolderToSolutionViaApi(uri)` | Adds a folder to the solution via test command |
| `removeFolderFromSolutionViaApi(id)` | Removes a folder from the solution via test command |
| `renameSolutionProjectViaApi(uri, name)` | Renames a project via test command |
| `closeSolutionViaApi()` | Closes the current solution via test command |
| `getProjectEntryCount()` | Counts visible project entries in the file explorer |
| `getProjectBaseUri(index)` | Returns the base URI of a project by index |
| `hasOpenSolution()` | Returns whether a solution is currently open |
| `executeCommand(name, args?)` | Runs a Bifrost command in the renderer and **awaits the handler**. Do not use this for commands that await `bifrost.dialog.open()` — the test cannot dismiss the dialog until the command returns, so the call hangs until `testTimeout` |
| `executeCommandWithoutBlocking(name, args?)` | Fires the command without waiting for the handler. Use this for dialog-opening commands, then `waitUntilDialogActive` / `closeActiveDialog` |
| `waitUntilDialogActive(timeoutMsg?)` | Polls until `bifrost.dialog.isActive()` is true |
| `closeActiveDialog()` | Closes the active dialog via `bifrost.dialog.close()` |
| `isDialogActive()` | Returns whether a Bifrost dialog is currently open |
| `isCommandEnabled(name, args?)` | Returns whether a command is currently enabled (pass the same args `executeCommand` will use) |
| `waitUntilCommandEnabled(name, args?, timeout?)` | Polls `isCommandEnabled` until true or timeout |
| `isExplicitSolution()` | Returns whether the current solution is explicit (multi-root) |
| `isSolutionDirty()` | Returns whether the current solution has unsaved changes |
| `getFocusedDocumentUri()` | Returns the URI of the currently focused editor document |
| `getFixturesAbsolutePath(name)` | Returns absolute filesystem path for a fixture |
| `getFixturesAbsoluteFileUri(name)` | Returns `file://` URI for a fixture |

### Test Commands

The Studio registers test-only commands in `initializeTestCommands()` (available when `APP_TEST=true`). Actions that modify solution state are exposed as test commands rather than using direct renderer execution, so they flow through the same command search path as real user interactions.

| Command ID | Description |
|---|---|
| `std.test.openUriAsSolution` | Prompts for a URI, opens it as solution (detects `.bfwsln`) |
| `std.test.openUriAsDocument` | Prompts for a URI, opens it as editor document |
| `std.test.addFolderToSolution` | Prompts for a directory URI, adds it to the solution |
| `std.test.removeFolderFromSolution` | Prompts for a project ID, removes it from the solution |
| `std.test.renameProjectInSolution` | Prompts for base URI then new name, renames the project |
| `std.test.closeSolution` | Closes the current solution without dirty-check dialog |

Test commands that accept parameters use `bifrost.dialog.prompt()`. StudioAgent types the parameter into the prompt dialog automatically. Read-only queries (e.g., `getSolutionProjectCount`) use `testDriver.client.execute()` internally within StudioAgent helper methods, since command search cannot return values to the test harness. Test files must never read `studioAgent.testDriver` — it is `protected`. Keyboard input goes through `sendKeyboardInput`; canvas deletion is `sendKeyboardInput(['Backspace'])` then `waitForNotVisible('[data-element-id=…]')`.

## Selector Conventions

### `data-test--` Attributes (Preferred)

Prefer `data-test--` attributes over CSS classes for element identification. These are stable across design changes.

```typescript
await studioAgent.assertVisible('[data-test--tree="std/file-explorer/open-solution"]');
await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]');
await studioAgent.assertVisible('[data-test--pane="activities/search"]');
await studioAgent.assertVisible('[data-menu-bar-item-id="pane/left/search"]');
```

For tree entries, the following `data-test` attributes are available:

| Attribute | Value | Applied to |
|---|---|---|
| `data-test--tree-entry-type` | `"project"`, `"file"`, `"directory"` | All tree item entries |
| `data-test--tree-entry-uri` | The entry's URI | Tree items with a metadata URI |

### CSS Class Selectors (When Necessary)

CSS classes can be used when no `data-test` attribute is available:

```typescript
// Tree entry by depth
await studioAgent.assertVisible('.treeview__entry--depth-0');

// Tree label with text content (WebDriverIO text match)
await studioAgent.assertVisible('.treeview__label=filename.bpmn');
```

### URI Selectors

When matching elements by URI, always use `getUriForSelector()` for cross-platform compatibility:

```typescript
const uriForSelector = await studioAgent.getUriForSelector(fileUri);
await studioAgent.assertVisible(`[data-test--tab="${uriForSelector}"]`);
```

## Fixture Management

### Static Fixtures

Place static test files in `studio/test/fixtures/<fixture-name>/`. Fixtures are referenced by name in tests (`jumpToFileInSolution`, `readFileSync`, directory copy). Do not keep BPMN/DMN files that no test names. Default Configured Start Payload tests use `untyped-task.bpmn` (`StartEvent_1` + `UntypedTask_1`); there is no dedicated pre/post-script fixture. Form Builder tests open `form-builder.bpmn` (`UserTask_1` with no `bfw:formFields` so the summary pane shows Create Form). Do not use `user-task.bpmn` for those tests — it already has form fields and shows Edit Form. Do not create a new untitled BPMN (`Ctrl+N` / `BpmnEmptyDocument.bpmn`); that template is a pool plus a start event and has no user task. `test-solution-simple` is a single-root smoke folder (`call_activity_test.bpmn` plus `hidden-file.fixture` for the hidden-files toggle).

### Dynamic Fixtures (`.bfwsln` Files)

Multi-root solution files (`.bfwsln`) require absolute filesystem paths, so they must be generated at test time:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const SOLUTION_FILE_PATH = path.join(FIXTURES_DIR, 'test-solution-multi.bfwsln');

function createEsslnFile(folders: { path: string; name?: string }[]): void {
  const content = {
    folders: folders.map(f => f.name ? { path: f.path, name: f.name } : { path: f.path }),
    settings: {},
  };
  fs.writeFileSync(SOLUTION_FILE_PATH, JSON.stringify(content, null, 2) + '\n');
}

// In beforeEach:
createEsslnFile([
  { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
  { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
]);

// In afterEach: clean up
if (fs.existsSync(SOLUTION_FILE_PATH)) fs.unlinkSync(SOLUTION_FILE_PATH);
```

## Test Patterns

### Single-Root Solution Test

```typescript
it('should open single-root solution', async () => {
  await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');
  const count = await studioAgent.getSolutionProjectCount();
  assert.strictEqual(count, 1);
  await studioAgent.assertNoErrorsPresentAndIdle();
});
```

### Multi-Root Solution Test

```typescript
it('should open multi-root solution', async () => {
  createEsslnFile([
    { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
    { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
  ]);
  await studioAgent.openSolutionFileFromFixtures('test-solution-multi.bfwsln');
  const count = await studioAgent.getSolutionProjectCount();
  assert.strictEqual(count, 2);
  await studioAgent.assertNoErrorsPresentAndIdle();
});
```

### Adding Folders via API

```typescript
it('should add folder to solution', async () => {
  await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');
  const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
  await studioAgent.addFolderToSolutionViaApi(folderBUri);
  const count = await studioAgent.getSolutionProjectCount();
  assert.strictEqual(count, 2);
});
```

## Test Coverage Areas

### Studio Core (`studio-core/`)

- Open directory as solution, toggle hidden files, open document via click / quick jump / search, navigation history
- **Single-root backwards compatibility**: open directory, file flattening, quick jump
- **Multi-root via `.bfwsln`**: open file, project entries, cross-project search
- **Custom project names**, add/remove folders, context menus, `.bfwsln` file persistence
- **Workbench pane toggles** (`workbench-panes.test.ts`): hide/show Property Panel and Sidebar; parked left icons restore the sidebar; property-panel control is a button, not a Layout context menu

### BPMN Editor (`bpmn-editor/`)

- **Smoke**: export as PNG/SVG/BPMN, context menu
- **Elements**: 131 tests covering all element types, property panes, palette, replace popup, participants, loops, custom attributes
- **Drilldown**: subprocess drill-down/up, breadcrumbs, overlay click

### BPMN Linter (`bpmn-linter/`)

- **Explorer lint** (`explorer-lint.test.ts`): live lint off still shows Explorer Lint File and the ruleset selector; closed-file lint writes `bfw:LinterRulesetScore`; View → Live Linter checkbox tracks `bpmn.linter.toggle`

### DMN Editor (`dmn-editor/`)

- **Smoke**: open `.dmn` file, view switcher, export as SVG/DMN copy, global search
- **Elements**: 62 tests covering DRD property panes (definitions, decision, input data, BKM, knowledge source, requirements), expression view panes (decision table, inputs, outputs, literal expression, boxed expression), item definitions, imports, validation, documentation pane, delete via keyboard

### Git Cruiser (`git-cruiser/`)

- **Git operations**: stage, commit, git pane commands
- **BPMN diff/history**: working-tree diff, history preview
- **DMN diff/history**: working-tree diff, change navigation, summary dialog, history preview, preview/diff mode toggle, change overview pane
- **Merge resolver**: BPMN + DMN merge conflict detection, accept ours/theirs, resolver navigation

## Testing Workbench Layout

Hide/show of the left and right pane areas uses always-visible menu bar **buttons**, not a Layout dropdown.

- **Property Panel**: `[data-test--menubar--button-for-command="std.workbench.togglePropertyPanel"]` (stable id `menu-bar-menu-layout`). Prefer `clickOnMenubarButtonForCommand('std.workbench.togglePropertyPanel')`. After hide, the same selector must still match — the right `MenuBarSection` is parked on the center row. Assert the area with `.app-layout__panes-right`.
- **Sidebar**: `[data-test--menubar--button-for-command="std.workbench.toggleSidebar"]` (id `menu-bar-toggle-sidebar`). After hide, parked left `pane_content_toggle` icons still work (`leftMenuBar.togglePane('pane/left/explorer')`). Assert the area with `.app-layout__panes-left`.
- Do **not** expect a context menu on `menu-bar-menu-layout`. That id is a `MenuBarButton`, not `MenuBarMenu`.
- Reset both areas with `executeCommand('std.workbench.showPanels')` at the start of a test when the shared agent may have left a pane hidden.
- Ctrl/Cmd+B is still `std.workbench.togglePanels` (both sides). View → Appearance remains the menu path.

## Testing BPMN Diagrams

When testing interactions with BPMN diagrams:

- **Maximize the window** at the start of each BPMN test. The context pad rendered by `bpmn-js` has a fixed size and may overlap neighboring elements, causing clicks to land on the wrong target.
- **Close the context pad** (`sendKeyboardInput(['Escape'])`) before clicking small property-pane controls (radios). After a canvas select the pad stays open; WebDriverIO `click()` waits until the target is unobstructed and can hang until `testTimeout` with no "not displayed" error. Click the **label** (`[data-test--…-radio]` on the label, not `#id` on the native `input`) — the label is the larger hit target. Do not add Escape inside `selectBpmnElementByIdAndWaitForElement`; some tests wait for `.djs-context-pad`.

```typescript
await studioAgent.maximize();
```

- **Keep enough spacing** between selectable elements in test BPMN diagrams. This prevents context pads from covering adjacent elements that the test needs to interact with next.
- **`PaneProperty type="select"`**: `htmlId` is on the wrapper `div` (label + control). `getText('#…-property')` returns `"Label\nVALUE"`. Read the committed option with `getText('#…-property .react-select__single-value')` (same as timers / ad-hoc ordering in this file).

## Testing DMN Diagrams

When testing interactions with DMN diagrams:

- **Maximize the window** at the start of each DMN test (same overlap risk as bpmn-js: dmn-js context pad is fixed-size).
- **Close the context pad** (`closeContextPad()` / `sendKeyboardInput(['Escape'])`) after a canvas select and before clicking small property-pane controls (Hit Policy select, Add/Remove on Item Definitions and Imports). `clickOn` waits until the target is unobstructed and can hang until `testTimeout`. Do not add Escape inside `selectDmnElementByIdAndWaitForElement`.
- **Deselect** with `clickOnDrdCanvas()`. That helper fits the diagram then calls `model.selection.clearSelection()`. Do not click the center of `.djs-container` — after fit-to-viewport that pixel often hits a shape.
- **Native DMN text fields**: `setDmnPropertyValue` already closes the context pad, then `clearTextInput`, types, and Tabs. Do **not** use it for `typeRef` (Output Type / Type) — those are suggestion selects.
- **DMN `typeRef`** (Decision Output Type `#dmn-decision-variable-type-property`, Input Data Type `#dmn-inputdata-variable-type-property`, BKM Output Type `#dmn-bkm-variable-type-property`, Literal Expression Output Type `#dmn-le-type-ref-property`, simple Item Definition Type `#dmn-item-definition-type-property-{id}`): same CreatableSelect rules as BPMN suggestion selects. Close the context pad before clicking the control. Read with `getSuggestionSelectValue('#…-property')`. Pick an existing option (builtin or catalog name such as `tAge`): click the control, then `[data-test-option-value="…"]`. Do not `getDmnPropertyValue` / `setDmnPropertyValue` / `getValue` on the wrapper.
- **Hit Policy / other `PaneProperty type="select"`**: `htmlId` is on the wrapper `div`; `instanceId` is on the Select. Use `selectDmnDropdownOption(htmlId, optionValue)` / `getDmnSelectValue(htmlId)`. Wait for `[data-test-option-value="…"]` before clicking the option.
- **Pane groups**: each test must call `switchToPaneGroup` for the group it is about to assert. Do **not** rely on the right-area fallback (`visibleGroups.find(g => g.visible) ?? visibleGroups[0]`). The suite shares one Studio window (`beforeAll` agent; `afterEach` only `closeOpenEditors`); `group.visible` is the last tab clicked and is **not** reset between tests. Validation is always displayable on a DMN document, so it never drops out of `visibleGroups`. Empty-canvas Scripting stays displayable, so Definitions will not show if Scripts is still the active tab.
  - `'property'` — Definitions, DRG element panes, Decision Table, Literal Expression
  - `'scripting'` — Item Definitions, Imports (after `clickOnDrdCanvas` so no DRG element is selected)
  - `'validation'` — Validation findings list
  - `'documentation'` — after selecting a DRG element, before asserting `[data-test--pane="dmn/panes/properties/PropertiesDocumentation"]`
- **WDIO 9**: `await` `.length` on `$$` results (`getViewSwitcherItemCount`, `getElementCount`, remove-button lists).
- **Quick Jump (files)**: `typeInQuickJump(query)` is Ctrl+J recent files. Type without Enter so results stay visible. `openViaQuickJump` submits and waits for the overlay to close. File jump does **not** list DRG element names.
- **Go to Symbol**: DMN element names live in the symbol index. `typeInGoToSymbol(query)` is Ctrl+Shift+O (document symbols) and types without Enter. Wait until `.quick-jump` text contains the name (index may still be filling). Do not use `typeInQuickJump` for element search.

```typescript
await studioAgent.maximize();
```

### Replacing values in property panes

Host editors are CodeMirror 6 (`.cm-content`). Native pane fields are ordinary inputs. Neither replaces existing text on the first keystroke — typing appends at the caret. That is why `'10'` + `'100'` becomes `'10100'`.

| Field type | How to replace |
|---|---|
| Native input (`PaneProperty` text/number/textarea) | `clearTextInput(selector)` then `clickOn` then `sendKeyboardInput`; read with `getValue`. There is no `setInputValue` / `getInputValue` on `StudioAgent`. Do not send `enter` into a textarea — it inserts a newline. Text Annotation (`#text-annotation-text-property`) is a textarea |
| Suggestion select (`text-with-suggestions`) | Pre-filled controls show a clear **X**. The committed value is `.react-select__single-value`; the search input stays empty so opening the menu lists every option. Create a new value: `clearSuggestionSelect(propertySelector)` (waits until the search input is empty), click the control, type (no Enter), then `commitSuggestionCreateOption(propertySelector, createdValue)`. After picking an option, read with `getSuggestionSelectValue(propertySelector)`. Do not click the X and type immediately. Do not clear before picking an existing option. Wait for `[data-test-option-value="…"]`. Do not press Enter after clicking an already-selected option. Closing an open menu without committing uses `sendKeyboardInput(['Escape'])`. `htmlId` is on the CreatableSelect — jump-to-symbol lives in the label (`[data-test--jump-to-symbol-in-solution]`). Business Rule Task fixture is already `dmn` / `discount-rules` |
| CodeMirror / FEEL (`.cm-content`) | `clickOnCodeEditor(parentSelector)` then `sendKeyboardInput` — the helper already select-all + backspace. Process Correlation Key (`#process-correlation-key-property`) is `OneLineFeelEditor`, not `PaneProperty type="text"` — `getValue` on that id is `''`. One-line FEEL maps Enter to blur; Escape only closes autocomplete and leaves focus in CodeMirror. After typing a one-line FEEL value, send `['Escape', 'enter']` before a canvas click (otherwise `.cm-tooltip` can cover `StartEvent_1`). Multi-line `FeelEditor` (e.g. Conditional Flow) inserts a newline on Enter — do not send `enter` there as if it were a native input. Read with `getCodeEditorText` |
| JSON panes (`MultiLineCodeEditor`, e.g. Data Object value contract) | Same as CodeMirror — do not `clickOn` the wrapper or `getValue` |
| `KeyValueJsonEditor` (Default Configured Start Payload, Example Payload, Example Result) | Empty/flat JSON is the key-value builder, not CodeMirror. Click `[data-test--kv-builder-add-button]`, type `[data-test--kv-builder-key-input]` / `[data-test--kv-builder-value-input]`, read with `getValue`. Use `clickOnCodeEditor` only after `[data-test--kv-json-editor-toggle]` or in the open-in-new-tab fragment |
| DMN native properties | `setDmnPropertyValue` already calls `clearTextInput`. Not for `typeRef` — use suggestion-select helpers |

Do not click a filled field and type a new value. Fixture XML often already has `loopMaximum`, `bfw:LoopInterval`, FEEL conditions, and collection expressions.

## Harness gotchas

Architecture constraints that tests also hit live in [`architecture/common-pitfalls.md`](architecture/common-pitfalls.md). This section is only the test runner / StudioAgent surface.

- **Open a solution before jumping to a file.** `jumpToFileInSolution` walks the explorer of the current solution. Opening a fixture URI as a document without `openFixturesDirectoryAsSolution` / `openSolutionFileFromFixtures` first fails to find the file.
- **Canvas clicks after FEEL.** `prepareCanvasPointer` (used by BPMN select helpers) blurs `document.activeElement` and waits until `.cm-tooltip` is gone, then fits the viewport. After typing a one-line FEEL value, still send `['Escape', 'enter']` first — Escape alone does not blur `OneLineFeelEditor`.
- **Custom Properties fixtures.** Keep only rows tests assert (or Custom Attributes indexes, Timer Start `enabled`, merge-diff payload). Do not leave ProcessEngine leftovers (`module` / `method` / `params` / `role`, Task-level `enabled`, `payload` on `##external`) in fixture XML.
- **`client.execute` return shape.** A renderer execute callback must not return a top-level `error` property — WebDriverIO treats that as a protocol failure. Rename the field.
- **Named Escape.** `sendKeyboardInput(['Escape'])` or `['escape']` both send the Escape key. A lowercase `'escape'` used to be typed as the letters e-s-c-a-p-e; do not invent other spellings.

## Adding New Tests

When adding new functionality:

1. Place tests in the appropriate feature directory (`bpmn-editor/`, `dmn-editor/`, `git-cruiser/`, `studio-core/`, `plugins/`)
2. Add `data-test--` attributes to new UI elements that need to be tested
3. If new fixtures are needed, place them in `studio/test/fixtures/`
4. For `.bfwsln`-based tests, generate the file in `beforeEach` and clean up in `afterEach`
5. Always end tests with `assertNoErrorsPresentAndIdle()` to catch unexpected errors
6. For DMN tests, use `StudioAgentDmnExtension` from `test/StudioAgentDmnExtension.ts`
7. For plugin-host tests, start via `createAndStartStudioAgentForPluginHost` and wait for `loaded` in `beforeAll` / `beforeEach` (`studioAgent.pluginHost.waitUntilStatus`). Do not poll for a command registered mid-`activate()`, and do not `waitUntil` for View-menu entries inside the test — those contributions exist once status is `loaded`.
8. For commands whose handler awaits `bifrost.dialog.open()` (for example `dmn.diff.showChangeSummaryDialog`), use `executeCommandWithoutBlocking`, then `waitUntilDialogActive` / `closeActiveDialog`. `executeCommand` waits for the handler, so the test never reaches the dismiss step and times out; an open dialog then also hangs `afterEach` (`closeOpenEditors`).

## File Path Reference

| Concern | Key Files |
|---|---|
| StudioAgent API | `studio/test/StudioAgent.ts` |
| Plugin Host test collaborator | `studio/test/StudioAgent/PluginHost.ts` |
| BPMN test extensions | `studio/test/StudioAgentBpmnExtension.ts` |
| TestDriver (WebDriverIO) | `studio/test/Driver/TestDriver.ts` |
| Input simulation | `studio/test/StudioAgent/InputSimulator.ts` |
| BPMN editor tests | `studio/test/integration/bpmn-editor/` |
| DMN editor tests | `studio/test/integration/dmn-editor/` |
| Git cruiser tests | `studio/test/integration/git-cruiser/` |
| Plugin host tests | `studio/test/integration/plugins/` |
| DMN test agent extension | `studio/test/StudioAgentDmnExtension.ts` |
| Static fixtures | `studio/test/fixtures/` |
| Test commands registration | `studio/src/modules/std/initializers/initializeCommands.ts` |
| Tree entry data-test attrs | `studio/src/components/Tree/HeadlessTreeItem.tsx` |
