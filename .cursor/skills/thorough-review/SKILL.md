---
name: thorough-review
description: >-
  Comprehensive review checklist for the Bifrost Forge World project. Covers build
  verification, TypeScript compilation, integration tests, architecture docs
  freshness, code quality spot checks, and documentation integrity. Use when
  the user asks for a "thorough review", "final review", "full review",
  "verify everything", or any similar request to validate the project state.
---

# Thorough Review

When the user requests a thorough review, execute every section below **in order**. Check off each item as you go and report the results at the end.

## 1. Build Verification

### SDK (if changed)

```bash
cd studio-sdk && npm run build && npm run lint:fix && npm run format
```

Then verify the studio still builds against the updated SDK:

```bash
cd studio && npm run build
```

### Studio

```bash
cd studio && npm run build
cd studio && npm run lint:fix
cd studio && npm run format
```

All three must exit 0. If `lint:fix` reports errors that cannot be auto-fixed, list them.

## 2. TypeScript Compilation

```bash
cd studio && npx tsc --noEmit -p tsconfig.electron-renderer.json && npx tsc --noEmit -p tsconfig.electron-main.json
```

Must exit 0 with no type errors.

## 3. Integration Tests

```bash
cd studio && npm run test:integration:electron:insiders
cd studio && npm run test:integration:electron:stable
```

All tests must pass. If tests fail, report the failure with test name, file, and error summary.

## 4. Architecture Documentation

- [ ] All new or modified subsystems are reflected in the appropriate file under `docs/architecture/`
- [ ] `docs/architecture/index.md` lists all topic files (no missing entries)
- [ ] `docs/architecture/common-pitfalls.md` updated if new gotchas were encountered
- [ ] `docs/decisions.md` updated if significant design choices were made during this work
- [ ] No architecture doc describes code that no longer exists

## 5. Code Quality Spot Check

- [ ] **Module isolation**: No direct cross-module imports. Cross-module communication goes through `bifrost.commands.executeCommand()` or mediator events.
- [ ] **No inline imports**: No `import('...').Type` in type annotations. All imports are at the top of the file using `import` / `import type`.
- [ ] **Pane group safety**: No `registerPaneGroup` calls were removed (even if the pane array is empty)
- [ ] **Theme token ownership**: Module-specific CSS tokens defined in module SCSS, not in core theme files
- [ ] **`data-test--` attributes**: New interactive UI elements have `data-test--` attributes for test selectors
- [ ] **Naming**: No abbreviated variable names (use full descriptive names)
- [ ] **React Compiler compliance**: `ref.current` not read/written during render; hooks called unconditionally; components used in JSX are stable references
- [ ] **Dialog vs notification**: Informational-only messages use `bifrost.notifications.open`, not `bifrost.dialog.open`
- [ ] **No orphaned commands**: All registered commands are either used in menus, keybindings, or called from other code

## 6. Documentation Cross-References

- [ ] `docs/introduction.md` documentation map is accurate
- [ ] `docs/architecture/index.md` topic list matches the actual files in the folder
- [ ] Links between architecture docs are not broken
- [ ] `docs/testing.md` reflects the current test infrastructure

## 7. Report

After completing the review, provide a structured summary:

```
## Review Summary

### Passed
- [list of checks that passed]

### Issues Found
- [list of issues with severity: Critical / Important / Minor]

### Recommendations
- [list of suggested improvements, if any]
```
