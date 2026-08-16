import {
  columnFilteringFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * The fixed set of TanStack Table v9 features backing the shared `Table` component.
 *
 * TanStack Table locks a table instance's registered features at construction time
 * (the first render of `useTable`), so this must be a stable, module-level constant
 * rather than something computed from component props.
 *
 * Kept as an explicit list (instead of `stockFeatures`) so unused feature code
 * (grouping, aggregation, cell selection/spanning, row/column ordering, row pinning,
 * faceting) is not bundled.
 */
export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,

  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
});

export type StudioTableFeatures = typeof tableFeatureSet;
