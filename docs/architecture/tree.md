# Tree Component System

---

## Overview

The Studio's tree view is a reusable, accessible component backed by the `@headless-tree/core` and `@headless-tree/react` libraries. It provides multi-select, keyboard navigation, expand/collapse, drag-and-drop, and context menus. The component lives in the SDK and is consumed by several Studio panes (File Explorer, Open Editors, Engine Browser, Search Results, etc.).

```
┌────────────────────────────────────────────────────────────────┐
│  Consumer Pane (e.g. SolutionPane)                             │
│    provides: entries (TreeItem[]), callbacks, viewMediatorId    │
├────────────────────────────────────────────────────────────────┤
│  Tree (React component)                                        │
│    ├─ TreeDataAdapter  (nested TreeItem[] → flat data model)   │
│    ├─ useTree()        (@headless-tree/react hook)             │
│    ├─ studioTreePlugin (click/double-click behavior)           │
│    └─ HeadlessTreeItem (per-row rendering, DnD)                │
├────────────────────────────────────────────────────────────────┤
│  TreeViewMediator (imperative bridge for commands)             │
│    registered with ViewMediatorManager                         │
├────────────────────────────────────────────────────────────────┤
│  @headless-tree/core  (state machine, features, reconciler)    │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### TreeItem (SDK contract)

**Path:** `studio-sdk/src/contracts/TreeTypes.ts`

`TreeItem` is the Studio's tree node type. Consumers build a nested `TreeItem[]` hierarchy and pass it to the `Tree` component as the `entries` prop.

```typescript
type TreeItem =
  | TreeItem_Directory
  | TreeItem_Section
  | TreeItem_File
  | TreeItem_SearchResult
  | TreeItem_PropertyString;
```

Every variant extends `TreeItemBase`:

| Field | Type | Purpose |
|-------|------|---------|
| `type` | `string` | Discriminator (`'directory'`, `'section'`, `'file'`, `'search_result'`, `'property'`) |
| `label` | `string` | Display text |
| `labelIcon` | `string?` | Icon ID; `{closed:open}` placeholder is resolved at render time |
| `pathId` | `string?` | Stable identity hint for the tree reconciler |
| `entries` | `TreeItem[]?` | Child items (presence makes the item a folder) |
| `metadata` | `any?` | Opaque payload passed to click/context-menu callbacks |
| `menuId` | `string?` | Context menu ID |
| `expanded` | `boolean?` | Initial expanded state |
| `selected` | `boolean?` | Initial selected state |
| `badges` | `TreeBadge[]?` | Badge indicators (character, number, or icon) |
| `styles` | `TreeItemStyles?` | Label/sublabel/badge color overrides |

### TreeItemData (internal)

**Path:** `studio-sdk/src/components/Tree/TreeDataAdapter.ts`

`TreeItemData` extends `TreeItem` with a single field:

```typescript
type TreeItemData = TreeItem & {
  readonly htId: string; // Stable ID used by Headless Tree
};
```

`htId` is derived from `pathId` when available, otherwise from a positional path (e.g. `root/0/2/1`).

---

## TreeDataAdapter

**Path:** `studio-sdk/src/components/Tree/TreeDataAdapter.ts`

Converts the nested `TreeItem[]` hierarchy into the flat, id-based data model that Headless Tree's `syncDataLoaderFeature` expects. A new `TreeDataAdapter` is created (via `useMemo`) whenever the `entries` prop changes.

### Internal Maps

| Map | Key → Value | Purpose |
|-----|-------------|---------|
| `itemMap` | `htId → TreeItemData` | Lookup any item by ID |
| `childrenMap` | `parentHtId → childHtId[]` | Children of a folder |
| `parentMap` | `childHtId → parentHtId` | Navigate upward |

A virtual root item (`__ht_root__`) is created automatically and serves as the root for Headless Tree.

### Key Methods

| Method | Purpose |
|--------|---------|
| `getDataLoader()` | Returns `{ getItem, getChildren }` for `useTree()` |
| `getInitialExpandedIds()` | Items with `expanded: true` |
| `getInitialSelectedIds()` | Items with `selected: true` |
| `findIdsByMetadataFilter(fn)` | Search items by metadata predicate |
| `getParentChain(id)` | Ancestor IDs from root to parent (exclusive) |
| `getAllIds()` | All non-root item IDs |

---

## Tree Component

**Path:** `studio-sdk/src/components/Tree/Tree.tsx`

The main React component. Accepts `TreeProps` and renders the complete tree.

### Props

| Prop | Type | Purpose |
|------|------|---------|
| `studio` | `Studio` | Studio instance |
| `entries` | `TreeItem[]` | Nested tree data |
| `iconComponent` | `IconComponent` | Icon renderer |
| `onClick` | `TreeItemClickCallbackFn` | Single-click handler (receives item metadata) |
| `onDoubleClick` | `TreeItemClickCallbackFn?` | Double-click handler |
| `onDragAndDropItem` | `TreeItemDropCallbackFn?` | Internal drag-and-drop handler |
| `onExternalFileDrop` | `ExternalFileDropCallbackFn?` | OS file drop handler |
| `viewMediatorId` | `string` | Registration key for `ViewMediatorManager` |
| `multiSelectionMenuId` | `string?` | Context menu ID when multiple items are selected |

### Headless Tree Features

The `useTree()` hook is configured with these features:

| Feature | Purpose |
|---------|---------|
| `syncDataLoaderFeature` | Synchronous data loading from `TreeDataAdapter` |
| `selectionFeature` | Single and multi-select (Ctrl+click, Shift+click) |
| `hotkeysCoreFeature` | Keyboard navigation (Arrow keys, Home, End) |
| `expandAllFeature` | `expandAll()` / `collapseAll()` API |
| `propMemoizationFeature` | Memoizes per-item props to avoid unnecessary rerenders |
| `studioTreePlugin` | Custom click behavior (see below) |

### State Management

`expandedItems` and `selectedItems` are managed as controlled React state (`useState`). When a new `TreeDataAdapter` is created (data changed):

1. Previously expanded items that still exist are preserved
2. Newly expanded items (from `expanded: true` in data) are merged in
3. Selected items that no longer exist are pruned
4. `tree.rebuildTree()` is called to force Headless Tree to re-read data

### Mediator Registration

On first render, the `Tree` component creates or retrieves a `TreeViewMediator` for the given `viewMediatorId` and registers it with `studio.views`. On every render, it updates the mediator's `treeRef` and `dataAdapterRef` so imperative callers always reach the current state.

**Race condition with deferred rendering:** Because the Workbench renders pane areas through `useDeferredValue`, making a pane visible (`setVisibilityOfPaneAreaByPaneId`) does not guarantee that the `Tree` (and its mediator) has mounted by the time the next line of imperative code runs. Use `studio.views.waitForAndGetById(viewMediatorId)` to safely wait for the mediator to become available before interacting with it. `ViewMediatorManager` emits an internal event on every `registerViewMediator` call, which `waitForAndGetById` listens to.

---

## studioTreePlugin

**Path:** `studio-sdk/src/components/Tree/studioTreePlugin.ts`

A custom `FeatureImplementation<TreeItemData>` that overwrites the default `selection` click behavior to match the Studio's expected UX:

| Interaction | Behavior |
|-------------|----------|
| Click (plain) on folder | Select + toggle expand/collapse |
| Click (plain) on leaf | Select + fire `onClickItem` |
| Ctrl/Meta+click | Toggle selection (no expand toggle) |
| Shift+click | Range select (`selectUpTo`) |
| Double-click | Fire `onDoubleClickItem` |

Callbacks are read from `tree.getConfig().studioCallbacks`, so each tree instance carries its own callbacks without shared mutable state.

---

## HeadlessTreeItem

**Path:** `studio-sdk/src/components/Tree/HeadlessTreeItem.tsx`

A `React.memo` component that renders a single tree row. Responsibilities:

- Indentation based on depth (`paddingLeft: depth * 16px`)
- Twistie icon (expand/collapse indicator) for folders
- Label icon with `{closed:open}` placeholder resolution
- Label text with optional search-term highlighting (`labelHighlight`)
- Sublabel with optional highlighting
- Badges (character, number, or icon variants)
- Action icons (permanent and hover-only)
- Context menu via right-click
- Internal drag-and-drop via `react-dnd` (`tree_item` type)
- External file drop via `react-dnd` (`__NATIVE_FILE__` type)
- Test attributes: `data-test--tree-entry-type`, `data-test--tree-entry-uri`

---

## TreeViewMediator

**Path:** `studio-sdk/src/browser/internal/TreeViewMediator.ts`

Imperative bridge between the `Tree` React component and command/keybinding code that runs outside the React render cycle. Registered with `ViewMediatorManager` under a consumer-specified ID (e.g. `std/file-explorer/open-solution`).

### API

| Method | Purpose |
|--------|---------|
| `collapseAll()` | Delegates to Headless Tree instance |
| `expandAll()` | Delegates to Headless Tree instance |
| `getSelectedMetadata()` | Returns metadata of currently selected items |
| `waitForAndSelectEntriesByMetadataFilter(fn, expand?)` | Waits for matching entries to appear, expands parents, selects them |
| `getViewData()` | Returns a snapshot of the visible tree (for testing/debugging) |
| `notifyEntriesChanged()` | Emits `EVENT_TREEVIEW_ENTRIES_CHANGED` |

The `Tree` component updates `treeRef` and `dataAdapterRef` on every render so imperative callers always reach the current Headless Tree state.

---

## pathId and Identity

The `pathId` field on `TreeItem` is the primary mechanism for stable item identity across data updates. When `pathId` is provided, Headless Tree uses it to track items through data changes (preserving expand/select state). When absent, a positional index path is used as a fallback (`root/0/2/1`).

Guidelines for consumers:

- **Static sections** should use a fixed string (e.g. `'section:connected'`)
- **Data-driven items** should encode enough information for a unique, stable identity (e.g. a URI or a URI combined with a state discriminator like `engine.url + '#connected'`)
- Avoid unstable or non-unique `pathId`s — they break state preservation and cause visual glitches

---

## Consumer Integration

Typical integration pattern for a pane:

```typescript
<Tree
  studio={studio}
  entries={treeItems}
  iconComponent={StudioIcon}
  onClick={handleClick}
  onDoubleClick={handleDoubleClick}
  onDragAndDropItem={handleDrop}
  viewMediatorId="my-extension/my-tree"
  multiSelectionMenuId="my-extension/multi-select-menu"
/>
```

The consumer is responsible for:

1. Building the `TreeItem[]` hierarchy (including `pathId`, `menuId`, `metadata`)
2. Providing click/drop callbacks
3. Choosing a unique `viewMediatorId`
4. Optionally interacting with the `TreeViewMediator` for imperative operations (e.g. from commands)

---

## Auto-Reveal on Editor Focus

When the user switches editor tabs, the File Explorer (Solution tree and Open Editors pane) automatically selects and scrolls to the corresponding entry. This mirrors the behavior found in editors like VSCode and Cursor.

### Setting

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `std.explorer.cursorFollowsTabs` | `boolean` | `true` | Enable/disable auto-reveal when switching tabs |

The setting is registered in `studio/src/modules/std/index.ts` and can be toggled at runtime — changes take effect immediately without restart.

### Commands

| Command | Purpose |
|---------|---------|
| `std.fileExplorer.revealUri` | Programmatically select and scroll to a file in the Solution tree by URI. Registered in `initializeFileExplorerCommands.ts`. |
| `std.explorer.toggleCursorFollowsTabs` | Toggle the `std.explorer.cursorFollowsTabs` setting. Available in the Command Search (Quick Jump menu) and the Go menu. |

### Event Wiring

**Path:** `studio/src/modules/std/initializers/initializeFileExplorerAutoReveal.ts`

The initializer subscribes to `EVENT_EDITOR_AREA_FOCUS_UPDATED` on `bifrost.editors`. On each focus change:

1. **Setting guard** — bail if `std.explorer.cursorFollowsTabs` is `false`
2. **Open Editors reveal** — select the matching entry in `std/file-explorer/open-editors` using the original URI (includes fragment tabs)
3. **Solution Explorer reveal** — resolve fragment URIs to their parent via `parseOpenInNewTabUrl`, guard with `isLocalFilename` + `containsEditorDocumentWithUri`, then call `std.fileExplorer.revealUri`

A 150 ms debounce prevents rapid-fire tree manipulation when quickly cycling tabs (e.g. Ctrl+Tab).

### Go Menu Integration

The Go menu contains a "Cursor Follows Tabs" toggle item between "Previous Editor" and "Go to File in Workspace …", separated by dividers. The checkmark reflects the current setting value (read on each menu open).

---

## File Path Reference

| Component | Path |
|-----------|------|
| TreeItem types | `studio-sdk/src/contracts/TreeTypes.ts` |
| Tree (React component) | `studio-sdk/src/components/Tree/Tree.tsx` |
| TreeDataAdapter | `studio-sdk/src/components/Tree/TreeDataAdapter.ts` |
| HeadlessTreeItem | `studio-sdk/src/components/Tree/HeadlessTreeItem.tsx` |
| studioTreePlugin | `studio-sdk/src/components/Tree/studioTreePlugin.ts` |
| TreeViewMediator | `studio-sdk/src/browser/internal/TreeViewMediator.ts` |
| TreeViewMediator tests | `studio-sdk/src/browser/internal/TreeViewMediator.test.ts` |
| Barrel export | `studio-sdk/src/components/Tree/index.ts` |
| Auto-reveal initializer | `studio/src/modules/std/initializers/initializeFileExplorerAutoReveal.ts` |
