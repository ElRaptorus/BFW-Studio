# Status Bar

---

## Overview

The status bar is a 22px strip at the bottom of the workbench that displays contextual information and lightweight actions. Modules register factory functions that produce `StatusBarItem` arrays; these factories are re-evaluated whenever relevant state changes. Items are sorted by priority within their area (left, center, right). The status bar has `overflow: hidden` to prevent visual overflow from animated icons.

The status bar also supports a progress indicator system for long-running operations and a workspace-wide diagnostics count (`std/problems`) fed by the BPMN linter and the BPMN/DMN sanitizers.

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
| `std/machine-sanctum` | left | 200 |
| `git-cruiser/not-found` | left | 100 |
| `git-cruiser/branch` | left | 100 |
| `git-cruiser/sync` | left | 80 |
| `std/solution-name` | left | 60 |
| `std/problems` | left | 50 |
| `std/line-ending` | right | 60 |
| `std/encoding` | right | 50 |
| `std/theme-switcher` | right | 40 |
| `std/status/inspectdocument` | right | 20 |
| `std/notifications` | right | 10 |

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
- `dmn` — `*.dmn` files

Encoding is hardcoded to `UTF-8` (reflecting current file I/O). Line ending is detected by checking `data.current` for `\r\n`.

### Diagnostics Count

The `std/problems` item always renders one button: error icon + count, warning icon + count. Counts come from `bifrost.diagnostics.getCount()` (workspace-wide, all URIs). Click runs `std.workbench.showProblemsPane` (opens the right-area linter group with no BPMN-only `enabledWhen`, so the item stays clickable on DMN and engine views). Tooltip is always `${n} Error(s), ${n} Warning(s)`.

Producers: BPMN linter (`bpmn-linter`), BPMN sanitizer (`bpmn-sanitizer`), DMN sanitizer (`dmn-sanitizer`). Each modeler instance binds diagnostics to the document URI captured at `import.done` / first push, and clears **that** URI on `diagram.destroy`. Clearing the focused URI instead would leak diagnostics from closed tabs onto the next focused document.

### Factory output normalization

`StatusBarManager.buildStatusBarItems` runs every factory result through `normalizeStatusBarItems` before `Array.concat`, then normalizes the combined list again (cross-factory id dedupe).

`normalizeStatusBarItems` (`studio/src/bifrost/common/normalizeStatusBarItems.ts`):

- Treats non-arrays as a **single** candidate. Array-like objects (`{ 0: …, length }`) are not iterated — `Array.concat` would otherwise flatten them into bare `0`/`1` cells.
- Keeps only `button` / `divider` / `menu` items with a non-empty string `id`.
- Dedupes by `id` (first wins).
- Coerces string content to `{ type: 'text', label }`, stringifies finite numeric labels, drops primitives and nested arrays inside `content`.

Plugin host `registerStatusBarItem` / `updateStatusBarItem` coerce payloads with the same non-flattening rule. A second register for the same plugin id updates stored items instead of throwing after `statusBarItems.set`.

---

## Rendering

### Layout

`.status-bar` packs left-to-right (`justify-content: flex-start`). Left and right areas are `flex: 0 0 auto`; center is `flex: 1 1 auto` and `overflow: hidden`; right uses `margin-left: auto`. Item rows use `gap`, not `span { padding-left }`, so a single button with several content pieces does not look like many separate items.

### React keys

`StatusBar.tsx` keys each `ErrorBoundary` as `${area}:${item.id}` (ids are unique after normalization). `StatusBarContentRenderer` keys content pieces as `${kind}:${value}:${occurrence}` so two `"0"` labels do not share `text:0`. Keys that are only `item.id` or `text:${label}` collide and leave stale cells after `EVENT_CONTENT_UPDATE`.

### Icon Clip Wrapper

`StatusBarContentRenderer` wraps every `type: 'icon'` content item in a `<span className="status-bar__icon-clip">`. This span uses `display: inline-flex`, `overflow: hidden`, and centering to contain the icon within a stable bounding box. Without the wrapper, animated icons (especially duotone icons using `ph-spin`) can visually overflow the 22px status bar height during rotation, triggering the Electron window scrollbar.

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

## Design Philosophy

The status bar is primarily an information tool. Items may trigger lightweight, contextual actions (e.g. switching branches, syncing, toggling a setting), but must not be required for core workflow navigation. Users should always be able to accomplish the same action through the command search, menus, or pane controls.

---

## File Path Reference

| Component | Path |
|-----------|------|
| StatusBarManager | `studio/src/bifrost/common/StatusBarManager.ts` |
| normalizeStatusBarItems | `studio/src/bifrost/common/normalizeStatusBarItems.ts` |
| StatusBarMediator | `studio/src/bifrost/browser/StatusBarMediator.ts` |
| StatusBar (React) | `studio/src/components/status_bar/StatusBar.tsx` |
| StatusBarButton | `studio/src/components/status_bar/StatusBarButton.tsx` |
| StatusBarContentRenderer | `studio/src/components/status_bar/StatusBarContentRenderer.tsx` |
| StatusBarTypes (host) | `studio/src/bifrost/contracts/StatusBarTypes.ts` |
| StatusBar SCSS | `studio/src/components/status_bar/workbench.status-bar.scss` |
| DiagnosticsManager | `studio/src/bifrost/common/DiagnosticsManager.ts` |
| DiagnosticsMediator | `studio/src/bifrost/browser/DiagnosticsMediator.ts` |
| Std status bar items | `studio/src/modules/std/initializers/initializeStatusBarItems.ts` |
| Git status bar items | `studio/src/modules/git-cruiser/initializers/initializeStatusBar.ts` |
| StatusBarTypes (plugin POJO) | `studio-sdk/src/contracts/StatusBarTypes.ts` |
