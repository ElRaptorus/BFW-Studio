# Integration Testing Skill

## Purpose

Guide agents on writing, maintaining, and verifying integration tests for the Studio's Electron application. This skill covers the StudioAgent API, test structure, selector conventions, and multi-root solution testing patterns.

## When to Use

- Writing new integration tests for features that affect the UI
- Verifying existing tests still pass after code changes
- Adding `data-test` attributes to new UI components
- Creating or modifying test fixtures
- Extending the StudioAgent API with new helper methods

## Key Principles

1. **Use StudioAgent, never raw WebDriverIO** — All test interactions go through `StudioAgent` methods. If a needed method doesn't exist, add it to `StudioAgent.ts`.
2. **Prefer `data-test--` attributes** — Never rely on CSS classes for test selectors unless no alternative exists. Add `data-test--` attributes to new UI elements that need testing.
3. **Always clean up** — Dynamic fixtures (like `.essln` files) must be created in `beforeEach` and removed in `afterEach`.
4. **End with error assertion** — Every test should end with `assertNoErrorsPresentAndIdle()` to catch unintended errors.
5. **Insiders = smoke, Stable = thorough** — Put basic "does it load" tests in `insiders/`, put comprehensive behavioral tests in `stable/`.

## Test Structure Template

```typescript
import * as assert from 'assert';
import { ASSERT_VISIBLE_TIMEOUT, StudioAgent, createAndStartStudioAgent } from '../../StudioAgent';

describe('feature-name', function () {
  this.slow(20000);
  this.timeout(120000);

  let studioAgent: StudioAgent;

  beforeEach(async function () {
    studioAgent = await createAndStartStudioAgent(this);
  });

  afterEach(async function () {
    await studioAgent.stopAndRecordErrors();
  });

  it('should do something', async function () {
    // Arrange
    await studioAgent.openFixturesDirectoryAsSolution('fixture-name');

    // Act
    await studioAgent.openViaQuickJump('file.bpmn');

    // Assert
    await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
```

## Selector Conventions

### Priority Order

1. `data-test--` attributes: `[data-test--tree="std/file-explorer/open-solution"]`
2. `data-test--tree-entry-type`: `[data-test--tree-entry-type="project"]`
3. CSS class with text content: `.treeview__label=filename.bpmn`
4. CSS structural classes: `.treeview__entry--depth-0` (last resort)

### Adding New `data-test` Attributes

When adding testable UI elements:

```tsx
// In the React component:
<div data-test--my-feature-element="value">...</div>
```

For tree entries, `data-test--tree-entry-type` and `data-test--tree-entry-uri` are already provided by `TreeItemRenderer`.

## Multi-Root Testing Pattern

### Dynamic `.essln` File Creation

```typescript
const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const ESSLN_PATH = path.join(FIXTURES_DIR, 'my-test.essln');

function createEsslnFile(folders: { path: string; name?: string }[]): void {
  const content = {
    folders: folders.map(f => f.name ? { path: f.path, name: f.name } : { path: f.path }),
    settings: {},
  };
  fs.writeFileSync(ESSLN_PATH, JSON.stringify(content, null, 2) + '\n');
}
```

### Opening Multi-Root Solutions

```typescript
await studioAgent.openSolutionFileFromFixtures('my-test.essln');
```

### Verifying Multi-Root State

```typescript
const projectCount = await studioAgent.getSolutionProjectCount();
assert.strictEqual(projectCount, 2);

const projectEntries = await studioAgent.getProjectEntryCount();
assert.strictEqual(projectEntries, 2);

const solutionFileUri = await studioAgent.getSolutionFileUri();
assert.ok(solutionFileUri?.endsWith('.essln'));
```

### Manipulating Solutions via Commands

StudioAgent action methods use **test commands** registered via `bifrost.commands.register()` with `{ visibleInSearch: true }` in `initializeTestCommands()`. These commands are invoked through the command search, just as a user would, rather than executing JavaScript directly in the renderer.

```typescript
// Add folder (uses std.test.addFolderToSolution → prompt for URI)
const folderUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
await studioAgent.addFolderToSolutionViaApi(folderUri);

// Remove folder (uses std.test.removeFolderFromSolution → prompt for project ID)
const projectIds = await studioAgent.getSolutionProjectIds();
await studioAgent.removeFolderFromSolutionViaApi(projectIds[1]);

// Rename project (uses std.test.renameProjectInSolution → two prompts)
const baseUri = await studioAgent.getProjectBaseUri(0);
await studioAgent.renameSolutionProjectViaApi(baseUri!, 'New Name');

// Close solution (uses std.test.closeSolution)
await studioAgent.closeSolutionViaApi();
```

### Querying Solution State

For read-only queries, StudioAgent provides typed helper methods. These use `testDriver.client.execute()` internally, but encapsulate the pattern so test files never call `executeInRenderer` directly.

```typescript
const projectCount = await studioAgent.getSolutionProjectCount();
const isExplicit = await studioAgent.isExplicitSolution();
const isDirty = await studioAgent.isSolutionDirty();
const hasSolution = await studioAgent.hasOpenSolution();
const isEnabled = await studioAgent.isCommandEnabled('std.solution.saveSolution');
const baseUri = await studioAgent.getProjectBaseUri(0);
const focusedUri = await studioAgent.getFocusedDocumentUri();
```

## Test Command Pattern

When a test needs to trigger Bifrost functionality, **register a test command** in `initializeTestCommands()` (in `studio/src/modules/std/initializers/initializeCommands.ts`) rather than using `executeInRenderer`. Test commands use `bifrost.dialog.prompt()` to accept parameters, which StudioAgent types into the dialog automatically.

**Do NOT** use `executeInRenderer` in test files. If you need a new interaction, add a test command and a corresponding StudioAgent method.

**Exception:** Read-only queries that return values (e.g., checking solution state) may use `testDriver.client.execute()` inside StudioAgent helper methods, since commands executed via command search cannot return data to the test harness.

## Fixture Naming & Personality

When creating test fixtures (plugins, sample files, mock data), use **creative, memorable names** rather than sterile technical labels. Fixtures with personality are easier to remember, more fun to work with, and make test output more readable at a glance.

Examples of good fixture names:
- `kitchen-sink` — the fixture that exercises every feature
- `happy-plugin` — the well-behaved baseline
- `error-on-activate` — descriptive but still reads naturally

Avoid names like `test-plugin-1`, `fixture-a`, or `sample-003`. If a fixture has a specific purpose, give it a name that tells a story.

## MANDATORY: Fix ALL Test Failures

**Every agent MUST fix ALL test failures, warnings, and errors encountered
during test runs — no exceptions.**

This is a **non-negotiable** rule. Violations of this rule directly endanger
the CI pipeline and block every other contributor.

### Why "pre-existing" is not an excuse

Bifrost Forge World is a highly interconnected application. A change to a
shared component can break tests in unrelated modules. A new command
registration can cause cascading failures in integration tests. **It is
never safe to assume a failing test is unrelated to your changes.**

Even if a failure genuinely predates your work, the CI pipeline does not
distinguish "your fault" from "someone else's fault" — it sees red and
blocks the merge. Leaving a known failure for "someone else to fix" is
functionally identical to introducing it yourself.

### Rules

1. **Run the build verification steps after every logical change.** This is
   defined in `.cursor/rules/build.mdc` and is non-optional.
2. **If any test fails, fix it.** Do not move on to the next task. Do not
   mark your work as complete. Do not report "N tests failed but they seem
   pre-existing."
3. **If a test that previously passed now fails, the cause is almost
   certainly your change.** Investigate the connection before assuming
   otherwise.
4. **If you genuinely cannot fix a failure** (e.g., it requires domain
   knowledge you lack, or it depends on infrastructure you cannot access),
   **explicitly report it as a blocker** with full error output, your
   analysis of the root cause, and what you tried. Do not silently skip it.

---

## Reference

See `docs/testing.md` for comprehensive testing documentation.

### Key File Paths

| File | Purpose |
|---|---|
| `studio/test/StudioAgent.ts` | Primary test API |
| `studio/test/TestDriver.ts` | WebDriverIO client wrapper |
| `studio/test/fixtures/` | Static test data |
| `studio/test/integration/insiders/` | Pre-release tests |
| `studio/test/integration/stable/` | Full release tests |
| `studio-sdk/src/components/Tree/HeadlessTreeItem.tsx` | Tree entry `data-test` attributes |
| `docs/testing.md` | Full testing reference |
