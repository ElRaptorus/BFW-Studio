# Status Bar

---

## Overview

The status bar is a 22px strip at the bottom of the workbench that displays contextual information and lightweight actions. Modules register factory functions that produce `StatusBarItem` arrays; these factories are re-evaluated whenever relevant state changes. Items are sorted by priority within their area (left, center, right). The status bar has `overflow: hidden` to prevent visual overflow from animated icons.

The status bar also supports a progress indicator system for long-running operations and a diagnostics count for the upcoming BPMN linter.

---

## Architecture

### Item Lifecycle

```
Module registers factory  →  StatusBarManager stores { id, factoryFn, priority }
                                      ↓
EVENT_CONTENT_UPDATE fires    →  StatusBarMediator.updateStatusBarItems()
                                      ↓
StatusBarManager calls all factories, sorts by priority, JSON-compares
                                      ↓
If changed: emit EVENT_STATUS_BAR_UPDATED → Workbench re-renders StatusBar.tsx
```

### Priority-Based Ordering

Each factory has a `priority: number` (default `0`). Within an area, factories are sorted descending by priority before evaluation. Higher priority = closer to the area edge (further left in the left area, further right in the right area).

| Item | Area | Priority |
|------|------|----------|
| `std/solution-name` | left | 200 |
| `git-cruiser/not-found` | left | 100 |
| `git-cruiser/branch` | left | 90 |
| `git-cruiser/sync` | left | 80 |
| `std/problems` | left | 50 |
| `std/machine-sanctum` | left | 10 |
| `std/notifications` | right | 100 |
| `std/line-ending` | right | 40 |
| `std/encoding` | right | 30 |
| `std/status/inspectdocument` | right | 20 |
| `std/theme-switcher` | right | 10 |

### Progress Indicator

`bifrost.statusBar.showProgress(label)` returns a `ProgressHandle` with `update(label)` and `done()` methods. Internally, the manager maintains a `Map<number, string>` of active handles. The label of the most recent handle is serialized as `progressLabel` in the view data. `StatusBar.tsx` renders a spinning Phosphor icon + label text in the left area, after all regular items.

Multiple concurrent progress handles are supported; only the most recent label is shown. When all handles call `done()`, the spinner disappears.

```typescript
const progress = bifrost.statusBar.showProgress('Syncing...');
try {
  progress.update('Pulling...');
  await gitService.pull(resolved);
  progress.update('Pushing...');
  await gitService.push(resolved);
} finally {
  progress.done();
}
```

### Solution Name Badge

The `std/solution-name` item in the left area displays the current solution's name or "No Solution" when no solution is open. Styled with a semi-transparent background that distinguishes it from regular status bar items. Clicking opens the "Open Directory as Solution" dialog.

### Encoding & Line Ending

Two right-area items (`std/encoding`, `std/line-ending`) show the file encoding and line ending style of the focused editor document. They only appear for file-backed document types:

- `bpmn` — `*.bpmn` files

Encoding is hardcoded to `UTF-8` (reflecting current file I/O). Line ending is detected by checking `data.current` for `\r\n`.

### Diagnostics Count

The `std/problems` item shows error and warning counts from `bifrost.diagnostics.getCount()`. Currently shows `0 / 0` as no diagnostic producers exist yet. The upcoming BPMN linter will be the first producer.

---

## DiagnosticsService

A URI-keyed diagnostic store on `bifrost.diagnostics`. Modules push diagnostics; the status bar reads aggregated counts.

### API

```typescript
type DiagnosticSeverity = 'error' | 'warning' | 'info';
type Diagnostic = { severity: DiagnosticSeverity; message: string; source: string };

bifrost.diagnostics.setDiagnostics(uri, owner, diagnostics);
bifrost.diagnostics.clearDiagnostics(owner);
bifrost.diagnostics.getDiagnostics(uri?);   // Map<uri, Diagnostic[]>
bifrost.diagnostics.getCount();             // { errors, warnings, infos }
```

### Storage Model

Internally, diagnostics are stored as `Map<uri, Map<owner, Diagnostic[]>>`. This allows multiple modules to independently contribute diagnostics for the same URI without overwriting each other. `clearDiagnostics(owner)` removes all entries for that owner across all URIs.

### Event

`EVENT_DIAGNOSTICS_CHANGED` is emitted on every mutation. The `std/problems` status bar item listens for this event to trigger `updateStatusBarItems()`.

---

## Rendering

### Icon Clip Wrapper

`StatusBarContentRenderer` wraps every `type: 'icon'` content item in a `<span className="status-bar__icon-clip">`. This span uses `display: inline-flex`, `overflow: hidden`, and centering to contain the icon within a stable bounding box. Without the wrapper, animated icons (especially duotone icons using `ph-spin`) can visually overflow the 22px status bar height during rotation, triggering the Electron window scrollbar.

---

## Design Philosophy

The status bar is primarily an information tool. Items may trigger lightweight, contextual actions (e.g. switching branches, syncing, toggling a setting), but must not be required for core workflow navigation. Users should always be able to accomplish the same action through the command search, menus, or pane controls.

---

## File Path Reference

| Component | Path |
|-----------|------|
| StatusBarManager | `studio/src/bifrost/common/StatusBarManager.ts` |
| StatusBarMediator | `studio/src/bifrost/browser/StatusBarMediator.ts` |
| StatusBar (React) | `studio/src/components/status_bar/StatusBar.tsx` |
| StatusBarButton | `studio/src/components/status_bar/StatusBarButton.tsx` |
| StatusBarContentRenderer | `studio/src/components/status_bar/StatusBarContentRenderer.tsx` |
| StatusBarTypes | `studio/src/bifrost/contracts/StatusBarTypes.ts` |
| StatusBar SCSS | `studio/src/components/status_bar/workbench.status-bar.scss` |
| DiagnosticsManager | `studio/src/bifrost/common/DiagnosticsManager.ts` |
| DiagnosticsMediator | `studio/src/bifrost/browser/DiagnosticsMediator.ts` |
| Std status bar items | `studio/src/modules/std/initializers/initializeStatusBarItems.ts` |
| Git status bar items | `studio/src/modules/git-cruiser/initializers/initializeStatusBar.ts` |
| SDK StatusBarTypes | `studio-sdk/types/contracts/StatusBarTypes.ts` |
| SDK StatusBarMediator | `studio-sdk/types/browser/StatusBarMediator.ts` |
| SDK DiagnosticsMediator | `studio-sdk/types/browser/DiagnosticsMediator.ts` |
