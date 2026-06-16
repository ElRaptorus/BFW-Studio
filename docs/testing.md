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

**Important:** Integration tests require a built Electron application. Run `npm run build` before running integration tests.

### TypeScript Configuration

- Tests are compiled on-the-fly by Vitest (via esbuild) — they are not included in any build-time tsconfig
- Path aliases (`#bifrost`, `#components`, `#modules`) are configured in `studio/vitest.config.ts`

## Test Framework

- **Vitest** — Test runner for both unit and integration tests (configured in `studio/vitest.config.ts`)
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
│   ├── test-solution-simple/   # Single-root fixture with BPMN files
│   ├── test-solution-bpmn/     # BPMN-specific test files
│   ├── test-solution-navigator/ # Navigation history test files
│   ├── test-solution-multi-a/  # Multi-root fixture: project A
│   ├── test-solution-multi-b/  # Multi-root fixture: project B
│   └── ...
└── integration/
    ├── bpmn-editor/            # BPMN editor tests
    │   ├── bpmn-smoke.test.ts
    │   ├── bpmn-elements.test.ts
    │   ├── bpmn-drilldown.test.ts
    │   └── form-builder.test.ts  # Form Builder fragment editor tests
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

### Key Methods

| Method | Purpose |
|---|---|
| `openFixturesDirectoryAsSolution(name)` | Opens a fixture directory as single-root solution |
| `openSolutionFileFromFixtures(filename)` | Opens a `.essln` file from fixtures as multi-root solution |
| `openDirectoryAsSolution(directory)` | Opens an arbitrary directory as solution |
| `openViaQuickJump(query)` | Opens a file via the Quick Jump dialog |
| `openViaCommandSearch(command)` | Executes a command via the command search |
| `clickOn(selector)` | Left-clicks on an element |
| `rightClickOn(selector)` | Right-clicks on an element |
| `sendKeyboardInput(keys)` | Types keys into the focused element |
| `assertVisible(selector, timeout)` | Waits for element to be visible |
| `assertNotVisible(selector)` | Asserts element is not in the DOM |
| `assertNoErrorsPresentAndIdle()` | Asserts no React error boundaries and no loading indicators |
| `assertPaneVisible(paneId)` | Asserts a pane is displayed |
| `assertContextMenuVisible(timeout)` | Asserts a context menu is displayed |
| `getElementCount(selector)` | Counts matching elements |
| `getText(selector)` | Gets text content of an element |
| `waitForSolutionEntryCountChanged(prev)` | Polls until file explorer entry count changes |
| `getSolutionProjectCount()` | Returns the number of projects in the current solution |
| `getSolutionFileUri()` | Returns the `.essln` file URI if present |
| `getSolutionProjectIds()` | Returns project IDs of the current solution |
| `addFolderToSolutionViaApi(uri)` | Adds a folder to the solution via test command |
| `removeFolderFromSolutionViaApi(id)` | Removes a folder from the solution via test command |
| `renameSolutionProjectViaApi(uri, name)` | Renames a project via test command |
| `closeSolutionViaApi()` | Closes the current solution via test command |
| `getProjectEntryCount()` | Counts visible project entries in the file explorer |
| `getProjectBaseUri(index)` | Returns the base URI of a project by index |
| `hasOpenSolution()` | Returns whether a solution is currently open |
| `isCommandEnabled(name)` | Returns whether a command is currently enabled |
| `isExplicitSolution()` | Returns whether the current solution is explicit (multi-root) |
| `isSolutionDirty()` | Returns whether the current solution has unsaved changes |
| `getFocusedDocumentUri()` | Returns the URI of the currently focused editor document |
| `getFixturesAbsolutePath(name)` | Returns absolute filesystem path for a fixture |
| `getFixturesAbsoluteFileUri(name)` | Returns `file://` URI for a fixture |

### Test Commands

The Studio registers test-only commands in `initializeTestCommands()` (available when `APP_TEST=true`). Actions that modify solution state are exposed as test commands rather than using direct renderer execution, so they flow through the same command search path as real user interactions.

| Command ID | Description |
|---|---|
| `std.test.openUriAsSolution` | Prompts for a URI, opens it as solution (detects `.essln`) |
| `std.test.openUriAsDocument` | Prompts for a URI, opens it as editor document |
| `std.test.addFolderToSolution` | Prompts for a directory URI, adds it to the solution |
| `std.test.removeFolderFromSolution` | Prompts for a project ID, removes it from the solution |
| `std.test.renameProjectInSolution` | Prompts for base URI then new name, renames the project |
| `std.test.closeSolution` | Closes the current solution without dirty-check dialog |

Test commands that accept parameters use `bifrost.dialog.prompt()`. StudioAgent types the parameter into the prompt dialog automatically. Read-only queries (e.g., `getSolutionProjectCount`) use `testDriver.client.execute()` internally within StudioAgent helper methods, since command search cannot return values to the test harness.

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

Place static test files in `studio/test/fixtures/<fixture-name>/`. Fixtures are referenced by name in tests.

### Dynamic Fixtures (`.essln` Files)

Multi-root solution files (`.essln`) require absolute filesystem paths, so they must be generated at test time:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const ESSLN_PATH = path.join(FIXTURES_DIR, 'test-solution-multi.essln');

function createEsslnFile(folders: { path: string; name?: string }[]): void {
  const content = {
    folders: folders.map(f => f.name ? { path: f.path, name: f.name } : { path: f.path }),
    settings: {},
  };
  fs.writeFileSync(ESSLN_PATH, JSON.stringify(content, null, 2) + '\n');
}

// In beforeEach:
createEsslnFile([
  { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
  { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
]);

// In afterEach: clean up
if (fs.existsSync(ESSLN_PATH)) fs.unlinkSync(ESSLN_PATH);
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
  await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');
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
- **Multi-root via `.essln`**: open file, project entries, cross-project search
- **Custom project names**, add/remove folders, context menus, `.essln` file persistence

### BPMN Editor (`bpmn-editor/`)

- **Smoke**: export as PNG/SVG/BPMN, context menu
- **Elements**: 131 tests covering all element types, property panes, palette, replace popup, participants, loops, custom attributes
- **Drilldown**: subprocess drill-down/up, breadcrumbs, overlay click

### DMN Editor (`dmn-editor/`)

- **Smoke**: open `.dmn` file, view switcher, export as SVG/DMN copy, global search
- **Elements**: 62 tests covering DRD property panes (definitions, decision, input data, BKM, knowledge source, requirements), expression view panes (decision table, inputs, outputs, literal expression, boxed expression), item definitions, imports, validation, documentation pane, delete via keyboard

### Git Cruiser (`git-cruiser/`)

- **Git operations**: stage, commit, git pane commands
- **BPMN diff/history**: working-tree diff, history preview
- **DMN diff/history**: working-tree diff, change navigation, summary dialog, history preview, preview/diff mode toggle, change overview pane
- **Merge resolver**: BPMN + DMN merge conflict detection, accept ours/theirs, resolver navigation

## Testing BPMN Diagrams

When testing interactions with BPMN diagrams:

- **Maximize the window** at the start of each BPMN test. The context pad rendered by `bpmn-js` has a fixed size and may overlap neighboring elements, causing clicks to land on the wrong target.

```typescript
await studioAgent.maximize();
```

- **Keep enough spacing** between selectable elements in test BPMN diagrams. This prevents context pads from covering adjacent elements that the test needs to interact with next.

## Adding New Tests

When adding new functionality:

1. Place tests in the appropriate feature directory (`bpmn-editor/`, `dmn-editor/`, `git-cruiser/`, `studio-core/`, `plugins/`)
2. Add `data-test--` attributes to new UI elements that need to be tested
3. If new fixtures are needed, place them in `studio/test/fixtures/`
4. For `.essln`-based tests, generate the file in `beforeEach` and clean up in `afterEach`
5. Always end tests with `assertNoErrorsPresentAndIdle()` to catch unexpected errors
6. For DMN tests, use `StudioAgentDmnExtension` from `test/StudioAgentDmnExtension.ts`

## File Path Reference

| Concern | Key Files |
|---|---|
| StudioAgent API | `studio/test/StudioAgent.ts` |
| BPMN test extensions | `studio/test/StudioAgentBpmnExtension.ts` |
| TestDriver (WebDriverIO) | `studio/test/TestDriver.ts` |
| Input simulation | `studio/test/helpers/InputSimulator.ts` |
| BPMN editor tests | `studio/test/integration/bpmn-editor/` |
| DMN editor tests | `studio/test/integration/dmn-editor/` |
| Git cruiser tests | `studio/test/integration/git-cruiser/` |
| Core / solutions tests | `studio/test/integration/studio-core/` |
| DMN test agent extension | `studio/test/StudioAgentDmnExtension.ts` |
| Static fixtures | `studio/test/fixtures/` |
| Test commands registration | `studio/src/modules/std/initializers/initializeCommands.ts` |
| Tree entry data-test attrs | `studio-sdk/src/components/Tree/HeadlessTreeItem.tsx` |
