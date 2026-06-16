import type {
  ColumnDef,
  ColumnPinningState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

export type { ColumnDef, SortingState, PaginationState, RowSelectionState, VisibilityState, ColumnPinningState };

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
