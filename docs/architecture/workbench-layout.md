# Workbench Layout

The Studio's main UI is rendered by `studio/src/components/Workbench.tsx`. It orchestrates the top-level layout: menu bars, pane areas, editor area, and status bar.

## Three-Column Split-Bar Model

The layout uses a three-column design where each column can have its own independent menu bar header:

```
┌──────────────┬──────────────────────────────┬──────────────┐
│ Left MenuBar │ Center MenuBar (optional)    │ Right MenuBar│
│ (icons)      │ (engine menubar items)       │ (layout)     │
├──────────────┼──────────────────────────────┼──────────────┤
│              │                              │              │
│  Left Pane   │  Editor Area + Bottom Pane   │  Right Pane  │
│  (Explorer,  │                              │  (Property   │
│   Search,    │                              │   Panel)     │
│   Engines)   │                              │              │
└──────────────┴──────────────────────────────┴──────────────┘
│                     Status Bar                             │
└────────────────────────────────────────────────────────────┘
```

Each column is wrapped in a `div.app-layout__column` (flex column) where the last child flexes to fill remaining space. If a menu bar section has no items, it is not rendered, and the pane below extends to the top.

The center column requires special handling: `SplitterLayout` uses `position: absolute; width: 100%; height: 100%`, which breaks out of flex flow. To prevent the editor area from overlapping the center menu bar, the inner `SplitterLayout` is wrapped in `div.app-layout__center-content` (`position: relative`), which provides a positioned container for the absolutely-positioned splitter. The wrapper receives `flex: 1; min-height: 0` from the `.app-layout__column > *:last-child` rule, so it fills remaining space after the menu bar. The left and right columns do not need this wrapper because their last child (`PaneArea`) uses normal flex positioning.

### Menu Bar Sections

Each column's menu bar is rendered by `MenuBarSection` (`studio/src/components/menu_bar/MenuBarSection.tsx`), a lightweight component that receives an array of `MenuBarItem` objects and an optional `align` prop (`'left' | 'center' | 'right'`). Left and center sections use centered alignment; the right section uses right-alignment. The old monolithic `<MenuBar>` component (which rendered left/center/right in a single row) is no longer used in the Workbench.

Menu bar sections have a fixed height of 34px (`flex: 0 0 34px`), use `--color-border-menu-bar` for the bottom border, and are conditionally rendered based on whether items exist. Buttons within a section use compact sizing (26px min, 18px icons) and the active state is themed via `--theme-menu-bar-active-bg`.

### Splitter Structure

The column layout is achieved via nested `SplitterLayout` components:

1. **Outer splitter** — splits left+center from right pane
2. **Inner splitter** — splits left pane from center (editor + bottom pane)
3. **Vertical splitter** — splits editor area from bottom pane

## MenuBarItem Types

Menu bar items are typed POJOs produced by factory and modifier functions registered via `MenuBarMediator`. The union type `MenuBarItem` is defined in `studio/src/bifrost/contracts/MenuBarTypes.ts`.

| Type | Rendering | Purpose |
|---|---|---|
| `button` | `MenuBarButton` | General-purpose clickable icon that executes a command |
| `pane_content_toggle` | `MenuBarPaneContentToggle` | Icon button that selects a specific pane within a pane area |
| `menu` | `MenuBarMenu` | Icon that opens a context menu on click |
| `select` | `MenuBarSelect` | Dropdown select element |
| `divider` | `<div>` | Visual separator |
| `icon` | `<span>` with Icon | Static icon display |
| `text` | `<div>` | Static text display |

### PaneContentToggle

The `pane_content_toggle` type (`MenuBarItem_PaneContentToggle`) is the primary mechanism for controlling which content fills a pane area from the menu bar. Properties:

| Property | Type | Description |
|---|---|---|
| `id` | `string?` | Unique identifier (used as `data-menu-bar-item-id` attribute) |
| `icon` | `string` | Icon ID |
| `tooltip` | `string` | Tooltip text |
| `paneAreaId` | `'left' \| 'right' \| 'bottom'` | Which pane area this toggle controls |
| `paneId` | `string` | The pane ID to select when clicked (e.g. `'activities/explorer'`) |

The component (`MenuBarPaneContentToggle.tsx`) determines its own `active` state at render time by calling `bifrost.panes.isPaneGroupVisibleByPaneId(paneId)`, which checks whether the pane group containing the given pane is the visible group in its area **and** the area itself is visible. When active, it applies the `menu-bar__button--active` CSS class and sets `data-test--active="true"`.

Clicking a `pane_content_toggle` calls `bifrost.panes.setVisibilityOfPaneAreaByPaneId(paneId, true)`, which shows the associated pane and makes the pane area visible. Clicking the already-active button is effectively a no-op (the pane is already displayed).

## Left Menu Bar Items

The left menu bar is populated by factories and modifiers registered in `initializeMenuBarItems.ts`:

1. **Explorer** (type `pane_content_toggle`, paneId `activities/explorer`)
2. **Search** (type `pane_content_toggle`, paneId `activities/search`)
3. **Engines** (type `pane_content_toggle`, paneId `pane/left/engines`) — injected by `engine-workspace` module via modifier
4. **Divider** + **Overflow menu** (`std/menubar/left-overflow`) — a chevron dropdown listing all toggle items with icons and keyboard shortcuts

Startpage and Settings are accessible through the **View** application menu, not the toolbar.

### Overflow Menu Keyboard Shortcuts

The overflow menu (`std/menubar/left-overflow`) maps known pane IDs to their specific focus commands via `PANE_FOCUS_COMMANDS` in `initializeMenus.ts`. This allows `renderBifrostMenu` to resolve keybindings automatically (e.g. `activities/explorer` → `std.workbench.focusExplorer`). Module-registered toggles without a mapped command fall back to `std.workbench.toggleActivity`.

## Pane Area Renderers (3-Way Split)

Each pane area has its own dedicated renderer component because their interaction models diverge significantly. The generic `PaneArea` component was removed.

### PaneAreaLeft

**File:** `studio/src/components/panes/PaneAreaLeft.tsx`

Maps over `paneGroups` and renders a `PanesList` per group. Only the group with `visible: true` shows content. Group switching is controlled externally by the left menu bar icons (via `setVisibilityOfPaneAreaByPaneId`).

### PaneAreaRight

**File:** `studio/src/components/panes/PaneAreaRight.tsx`

Supports multiple pane groups with a conditional icon-based tab bar:

- Computes `visibleGroups` by checking `shouldBeDisplayed` on each group's panes.
- **1 visible group:** Renders `PanesList` directly, no tab bar.
- **2+ visible groups:** Renders `PaneGroupTabBar` (icon variant) at top, followed by the active group's `PanesList`.
- Tab click calls `bifrost.panes.setActiveGroupInArea('right', groupId)`.

### PaneAreaBottom

**File:** `studio/src/components/panes/PaneAreaBottom.tsx`

Supports multiple pane groups with a conditional text-based tab bar:

- **1 group:** Renders identically to the previous implementation. No group tab bar.
- **2+ groups with displayable panes:** A text-based group tab bar appears above the pane-level tab bar. Each group independently remembers its `activePaneIndex`.

### PaneGroupTabBar

**File:** `studio/src/components/panes/PaneGroupTabBar.tsx`

Shared tab bar component for switching between pane groups. Two rendering variants:

| Variant | Used by | Rendering |
|---|---|---|
| `icon` | PaneAreaRight | 24x24 icon buttons, tooltip on hover, right-click context menu |
| `text` | PaneAreaBottom | Text tabs with labels, reuses `pane-tab` CSS patterns |

**Icon resolution order** (icon variant):
1. If `icon` is a function: call it, use returned string as CSS class (supports dynamic icons).
2. If `icon` is a string: use directly as CSS class.
3. If no `icon`: render 1-2 letter abbreviation from group label.

The `getDisplayableGroups()` helper iterates each group's panes and checks the registered provider's `shouldBeDisplayed`. Only groups with at least one displayable pane are rendered as tabs.

`PaneWrapper` (`studio/src/components/panes/PaneWrapper.tsx`) is the per-pane mount gate: if `shouldBeDisplayed` returns `false`, it returns `null` and never calls `Pane` / `PaneContent`. See **[panes.md](panes.md)** for the full PaneProvider contract.

## Pane Group Data Model

`PaneGroupObject` (defined in `studio-sdk/src/contracts/PaneTypes.ts`):

| Field | Type | Description |
|---|---|---|
| `groupId` | `string` | Unique identifier |
| `visible` | `boolean` | Whether this group is the active group in its area |
| `panes` | `PaneObject[]` | Ordered list of panes |
| `activePaneIndex` | `number?` | Index of the active pane (used by bottom area tab selection) |
| `label` | `string?` | Display name. Falls back to formatted `groupId` (e.g. `"property"` -> `"Property"`). |
| `icon` | `string \| (() => string)?` | Icon CSS class or factory function for dynamic icons. Used by `PaneGroupTabBar` icon variant. |

### Dynamic Icon Pattern

Modules can register a factory function as the `icon` field. The factory is called at render time and returns the full CSS class string for the icon element. This allows icons to reflect runtime state without additional API surface.

Example: The `bpmn-linter` module uses this to indicate lint severity in the group tab icon:
- `'ph ph-warning lint-severity--error'` when errors exist (renders red)
- `'ph ph-warning lint-severity--warning'` for warnings (renders orange)
- `'ph ph-warning'` when clean

When the underlying state changes, the module calls `bifrost.panes.requestPaneLayoutUpdate()` to trigger a re-render.

## Pane Area Content Selection

Pane content selection is handled by `PaneManager` and `PaneMediator`:

| Method | Behavior |
|---|---|
| `setVisibilityOfPaneAreaByPaneId(id, visible)` | Shows the pane area, activates the group containing the pane, sets activePaneIndex, and tracks `lastActivePaneIdPerArea` |
| `setActiveGroupInArea(area, groupId)` | Sets the specified group as visible and hides all others in that area. Emits `EVENT_PANE_LAYOUT_UPDATED`. |
| `requestPaneLayoutUpdate()` | Emits `EVENT_PANE_LAYOUT_UPDATED` without changing data. Used by modules to trigger re-renders when icon factories change. |
| `getActivePaneIdForArea(area)` | Returns the ID of the currently active pane in the given area, or `null` if the area is hidden |
| `isPaneGroupVisibleByPaneId(paneId)` | Returns `true` when the group containing the given pane is the visible group in its area and the area itself is visible. Used by `MenuBarPaneContentToggle` to determine its active/highlighted state. |
| `selectLastActivePaneInArea(area)` | Re-selects the last active pane. Used by Toggle Sidebar to restore after hiding. |
| `unregisterPane(paneId)` | Removes a single pane from its group, clamps `activePaneIndex`, emits `EVENT_PANE_LAYOUT_UPDATED`. No-op if pane not found. |
| `unregisterPaneGroup(paneGroupId)` | Removes an entire pane group from its area, emits `EVENT_PANE_LAYOUT_UPDATED`. No-op if group not found. |
| `unregisterPaneProvider(providerId)` | Removes a pane provider entry from the `PaneProviderManager`. |

`PaneManager` tracks `lastActivePaneIdPerArea` (serialized/deserialized with pane layout) to support restoring the last active pane when toggling sidebar visibility.

### Persistence

`PaneManager.serialize()` stores the full pane area state including which group has `visible: true` per area. `deserialize()` restores the active group by matching saved `groupId` values against currently registered groups. If a saved group no longer exists (module removed), the first group becomes active. For left and right sidebar areas, `restorePaneArea()` also restores `activePaneIndex` using ID-based lookup: the saved index is resolved to a pane ID from the backup, then that ID is matched against the current pane list to find the correct index. This ensures stability when panes are added or removed between sessions.

**Deferred save listener:** The `savePaneFn` listener (which writes pane state to localStorage) is registered in `PaneMediator.restoreFromLastSession()`, not in the constructor. During module loading, `prependToPaneGroup()` and `appendToPaneGroup()` emit `EVENT_PANE_LAYOUT_UPDATED`. If the save listener were active at that point, it would serialize the default initialization state (first group visible) and overwrite the user's saved state before `deserialize()` runs. By deferring listener registration until after restoration, module-init events are harmless -- they update the in-memory state and trigger React re-renders (via the event-forwarding listeners set up in the constructor), but do not write to storage.

## Interaction Model

- **Clicking a `pane_content_toggle` icon** in the left menu bar selects that pane content. Clicking the already-active icon is effectively a no-op.
- **Toggle Sidebar** (`std.workbench.toggleSidebar`) hides or shows the left pane area. When hiding, calls `hidePaneArea('left')`. When showing, calls `selectLastActivePaneInArea('left')`.
- **Right pane group tabs** (icon variant): Click switches active group. Right-click opens context menu listing all displayable groups with labels.
- **Bottom pane group tabs** (text variant): Click switches active group. Pane-level tabs below update to show the selected group's panes.

## Files

| File | Purpose |
|---|---|
| `studio/src/components/Workbench.tsx` | Top-level layout, event subscriptions, column structure |
| `studio/src/components/panes/PaneAreaLeft.tsx` | Left pane area renderer (single visible group, externally controlled) |
| `studio/src/components/panes/PaneAreaRight.tsx` | Right pane area renderer (multi-group with icon tab bar) |
| `studio/src/components/panes/PaneAreaBottom.tsx` | Bottom pane area renderer (multi-group with text tab bar) |
| `studio/src/components/panes/PaneGroupTabBar.tsx` | Group-level tab bar component (icon and text variants) |
| `studio/src/components/panes/PaneWrapper.tsx` | Per-pane mount gate: evaluates `shouldBeDisplayed`, then renders `Pane` |
| `studio/src/components/panes/PanesList.tsx` | Renders a group's panes as stacked PaneWrappers |
| `studio/src/components/panes/component.pane-group-tab-bar.scss` | Styles for group tab bar, context menu, severity utility classes |
| `studio/src/components/menu_bar/MenuBarSection.tsx` | Per-column menu bar component, dispatches to type-specific renderers |
| `studio/src/components/menu_bar/MenuBarButton.tsx` | Generic button with command execution and `active` CSS class |
| `studio/src/components/menu_bar/MenuBarPaneContentToggle.tsx` | PaneContentToggle button: self-determines active state from `bifrost.panes` |
| `studio/src/components/menu_bar/workbench.menu-bar.scss` | Menu bar section styles (`.menu-bar-section`, `.menu-bar__button--active`) |
| `studio/src/bifrost/styles/workbench.app-layout.scss` | Column layout (`.app-layout__column`) |
| `studio/src/bifrost/contracts/MenuBarTypes.ts` | All `MenuBarItem` type definitions including `MenuBarItem_PaneContentToggle` |
| `studio/src/bifrost/common/PaneManager.ts` | Pane area state, visibility, `lastActivePaneIdPerArea`, `setActiveGroupInArea()`, `requestPaneLayoutUpdate()` |
| `studio/src/bifrost/common/PaneMediator.ts` | Public API for PaneManager, persistence, pane provider registration |
| `studio-sdk/src/contracts/PaneTypes.ts` | `PaneGroupObject` type with `label`, `icon` fields |
| `studio/src/modules/std/initializers/initializeMenuBarItems.ts` | Left/center/right menu bar item registration |
| `studio/src/modules/engine-workspace/initializers/initializeRunMenu.ts` | Engine menubar items (registered on 'center') |
