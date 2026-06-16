# Table Component

---

## Overview

The Studio's Table component is a shared, headless-UI wrapper around [TanStack Table v8](https://tanstack.com/table/v8) that lives in the SDK (`studio-sdk/src/components/Table/`). It provides sorting, pagination, column resizing, column pinning, row selection, sub-row expansion, column-header filters, and row interaction handlers — all driven by `--theme-table-*` CSS custom properties for theming.

The component is used in the engine-browser module for the three main data lists (Process Models, Cyclic Timers, Process Instances), in the landing page short lists, and in the inspector panes (Performance, Notifications).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  SDK  (studio-sdk/src/components/Table/)             │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │  Table.tsx  │  │ TablePagination  │  │ Column   │ │
│  │  (wrapper)  │──│                  │  │ Filter   │ │
│  └─────┬──────┘  └──────────────────┘  └──────────┘ │
│        │   useTableSettings.ts  types.ts  Table.scss │
├────────┼────────────────────────────────────────────┤
│  TanStack Table v8  (useReactTable, flexRender)      │
└─────────────────────────────────────────────────────┘
         │
┌────────┼────────────────────────────────────────────┐
│  Consumers (studio/)                                 │
│  ┌───────────────────┐  ┌───────────────────┐       │
│  │ Full Lists         │  │ Short Lists       │       │
│  │ (server-side pag.) │  │ (no pagination)   │       │
│  ├───────────────────┤  ├───────────────────┤       │
│  │ Inspector Tables   │  │ (no pagination)   │       │
│  └───────────────────┘  └───────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### Table.tsx

**Path:** `studio-sdk/src/components/Table/Table.tsx`

The main component. Accepts `TableProps<TData>` and renders a `<div>`-based table with ARIA roles. Key responsibilities:

- **Column pinning** — Applies `position: sticky` with `left`/`right` offsets for pinned columns.
- **Sorting** — Clicking a sortable header toggles sort direction. Visual indicator via Phosphor caret icons.
- **Column filters** — When `enableFilters` is true, renders `<TableColumnFilter>` under each header that has a `meta.filterVariant`.
- **Column resizing** — Drag handle on header edges. Uses TanStack's `columnResizeMode: 'onChange'`.
- **Row interactions** — Delegates `onClick`, `onDoubleClick`, `onContextMenu` on each row.
- **Active/highlighted rows** — Conditional class names `--active`, `--highlighted`, `--child` for styling.

### TablePagination.tsx

**Path:** `studio-sdk/src/components/Table/TablePagination.tsx`

Rendered below the table when `pagination` and `onPaginationChange` are provided. Shows page size selector, page info, and navigation buttons (first/prev/next/last).

### TableColumnFilter.tsx

**Path:** `studio-sdk/src/components/Table/TableColumnFilter.tsx`

Renders one of three filter variants based on `ColumnDef.meta.filterVariant`:

| Variant | Rendered As | Value Type |
|---------|-------------|------------|
| `text` | `<input type="text">` | `string \| undefined` |
| `boolean` | `<select>` with All/Yes/No | `boolean \| undefined` |
| `multi-select` | Checkbox list | `string[] \| undefined` |

### useTableSettings.ts

**Path:** `studio-sdk/src/components/Table/useTableSettings.ts`

A hook for persisting table state (column visibility, column widths, page size) to the Studio's `SettingsMediator`. Designed for simpler table instances that don't have a dedicated EditorDocumentModel. The model-backed engine-browser lists manage their own state through the model layer and commands.

### types.ts

**Path:** `studio-sdk/src/components/Table/types.ts`

Re-exports key TanStack Table types (`ColumnDef`, `SortingState`, `PaginationState`, `VisibilityState`, `ColumnPinningState`) and defines custom types:

| Type | Purpose |
|------|---------|
| `TableColumnSizing` | `Record<string, number>` for column width state |
| `TableColumnMeta` | Extends `ColumnDef.meta` with `filterVariant`, `filterOptions`, `disableResizing`, `disableSorting` |
| `TableFilterVariant` | `'text' \| 'multi-select' \| 'boolean'` |
| `TableRowInteractionHandlers<TData>` | Row click/double-click/context menu handler types |

---

## Usage Patterns

### Column Definition

Columns are defined using TanStack's `ColumnDef<TData, TValue>` type, typically inside a `useMemo`:

```typescript
const columns = useMemo<ColumnDef<MyRow, unknown>[]>(() => [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    meta: { filterVariant: 'text' as const },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    meta: {
      filterVariant: 'multi-select' as const,
      filterOptions: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
], []);
```

### Server-Side Pagination

The three full lists use `manualPagination` with `pageCount` from the model:

```typescript
<Table
  data={items}
  columns={columns}
  pagination={{ pageIndex: model.pageIndex, pageSize: model.pageSize }}
  onPaginationChange={handlePaginationChange}
  manualPagination
  pageCount={model.totalPageCount}
  pageSizeOptions={[10, 25, 50, 100]}
/>
```

### Column-Header Filters

Filters are externally controlled via `columnFilters` (a `Record<string, unknown>`) and `onColumnFilterChange`:

```typescript
const columnFilters = useMemo(() => {
  const filters = model.filters;
  const result: Record<string, unknown> = {};
  if (filters.name) { result.name = filters.name; }
  return result;
}, [model.filters]);

const handleColumnFilterChange = useCallback(
  (columnId: string, value: unknown) => {
    model.applyFilter(columnId, value);
  },
  [model],
);
```

---

## Settings Integration

Page size for each list is persisted as an integer setting with enum values:

| Setting Key | Default |
|-------------|---------|
| `engineBrowser.processInstanceList.pageSize` | `10` |
| `engineBrowser.processModelList.pageSize` | `10` |
| `engineBrowser.cyclicTimersList.pageSize` | `10` |

Each setting uses `type: 'integer'` with `enum: [10, 25, 50, 100]`, rendered as a dropdown in the Settings GUI.

---

## Theming

All colors use `--theme-table-*` CSS custom properties defined in the core theme files. The SDK Table SCSS must **not** reference `--color-*` aliases (those are Bifrost-internal).

| Token | Purpose |
|-------|---------|
| `--theme-table-bg` | Table background |
| `--theme-table-fg` | Table text color |
| `--theme-table-border` | Row/cell borders |
| `--theme-table-header-bg` | Header row background |
| `--theme-table-hover-bg` | Row hover background |
| `--theme-table-active-bg` | Active/selected row background |
| `--theme-table-child-bg` | Sub-row background |
| `--theme-table-options-fg` | Pagination button color |
| `--theme-table-options-hover-fg` | Pagination button hover color |
| `--theme-splitter-hover` | Resize handle hover indicator |
| `--theme-splitter-active` | Resize handle active indicator |

---

## File Path Reference

| Component | Path |
|-----------|------|
| Table | `studio-sdk/src/components/Table/Table.tsx` |
| TablePagination | `studio-sdk/src/components/Table/TablePagination.tsx` |
| TableColumnFilter | `studio-sdk/src/components/Table/TableColumnFilter.tsx` |
| useTableSettings | `studio-sdk/src/components/Table/useTableSettings.ts` |
| types | `studio-sdk/src/components/Table/types.ts` |
| Table.scss | `studio-sdk/src/components/Table/Table.scss` |
| barrel export | `studio-sdk/src/components/Table/index.ts` |
| TableSortDirection | `studio/src/modules/engine-browser/components/TableSortDirection.ts` |
| RemoteProcessModelsList | `studio/src/modules/engine-browser/editor/ProcessModelList/components/RemoteProcessModelsList.tsx` |
| RemoteCyclicTimersList | `studio/src/modules/engine-browser/editor/CyclicTimersList/components/RemoteCyclicTimersList.tsx` |
| RemoteProcessInstanceList | `studio/src/modules/engine-browser/editor/ProcessInstanceList/components/RemoteProcessInstanceList.tsx` |
| EngineProcessModelShortList | `studio/src/modules/engine-browser/editor/LandingPage/components/EngineProcessModelShortList.tsx` |
| EngineProcessInstanceShortList | `studio/src/modules/engine-browser/editor/LandingPage/components/EngineProcessInstanceShortList.tsx` |
| PerformanceInspector | `studio/src/components/panes/inspectors/PerformanceInspector.tsx` |
| NotificationInspector | `studio/src/components/panes/inspectors/NotificationInspector.tsx` |
