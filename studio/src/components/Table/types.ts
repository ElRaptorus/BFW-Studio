import type {
  ColumnDef,
  ColumnPinningState,
  ColumnVisibilityState,
  PaginationState,
  RowData,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';

import type { StudioTableFeatures } from './tableFeatures';

export type { SortingState, PaginationState, RowSelectionState, ColumnPinningState };
export type { ColumnVisibilityState as VisibilityState };
export type { StudioTableFeatures };

/**
 * Column definition type for the shared `Table` component, pre-bound to the
 * fixed feature set it registers (see `./tableFeatures`).
 */
export type TableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<StudioTableFeatures, TData, TValue>;

export type TableColumnSizing = Record<string, number>;

export type TableFilterVariant = 'text' | 'multi-select' | 'boolean' | 'date-range' | 'duration-range';

export type DateRangeFilterValue = {
  after?: string;
  before?: string;
};

export type DurationRangeFilterValue = {
  greaterThanOrEqual?: number;
  lessThan?: number;
};

export type TableColumnMeta = {
  filterVariant?: TableFilterVariant;
  filterOptions?: { value: string; label: string }[];
  filterRangeLabels?: { from: string; to: string };
  filterPlaceholder?: string;
  disableResizing?: boolean;
  disableSorting?: boolean;
};

export type TableRowInteractionHandlers<TData> = {
  onRowClick?: (row: TData, event: React.MouseEvent) => void;
  onRowDoubleClick?: (row: TData, event: React.MouseEvent) => void;
  onRowContextMenu?: (row: TData, event: React.MouseEvent) => void;
};
