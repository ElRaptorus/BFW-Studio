import { flexRender, useTable } from '@tanstack/react-table';
import type {
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  ExpandedState,
  OnChangeFn,
  PaginationState,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';

import React, { useCallback, useState } from 'react';

import './Table.scss';
import { TableColumnFilter } from './TableColumnFilter';
import { TablePagination } from './TablePagination';
import { tableFeatureSet } from './tableFeatures';
import type {
  DateRangeFilterValue,
  DurationRangeFilterValue,
  StudioTableFeatures,
  TableColumnDef,
  TableColumnMeta,
} from './types';

export type TableProps<TData extends RowData> = {
  data: TData[];
  columns: TableColumnDef<TData>[];
  getRowId?: (row: TData, index: number) => string;

  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;

  manualFiltering?: boolean;

  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  manualPagination?: boolean;
  pageCount?: number;
  pageSizeOptions?: number[];

  enableRowSelection?: boolean | ((row: Row<StudioTableFeatures, TData>) => boolean);
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  expanded?: ExpandedState;
  onExpandedChange?: OnChangeFn<ExpandedState>;
  getSubRows?: (row: TData) => TData[] | undefined;

  columnPinning?: ColumnPinningState;

  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>;

  columnSizing?: ColumnSizingState;
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>;

  columnFilters?: Record<string, unknown>;
  onColumnFilterChange?: (columnId: string, value: unknown) => void;

  globalFilter?: string;
  onGlobalFilterChange?: OnChangeFn<string>;

  onRowClick?: (row: TData, event: React.MouseEvent) => void;
  onRowDoubleClick?: (row: TData, event: React.MouseEvent) => void;
  onRowContextMenu?: (row: TData, event: React.MouseEvent) => void;

  activeRowId?: string;
  highlightedRowId?: string;

  enableFilters?: boolean;
  initialPageSize?: number;
  className?: string;
};

export function Table<TData extends RowData>(props: TableProps<TData>): React.JSX.Element {
  const {
    data,
    columns,
    getRowId,
    sorting,
    onSortingChange,
    manualSorting,
    manualFiltering,
    pagination,
    onPaginationChange,
    manualPagination,
    pageCount,
    pageSizeOptions,
    enableRowSelection,
    rowSelection,
    onRowSelectionChange,
    expanded,
    onExpandedChange,
    getSubRows,
    columnPinning,
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFilterChange,
    onRowClick,
    onRowDoubleClick,
    onRowContextMenu,
    activeRowId,
    highlightedRowId,
    enableFilters,
    initialPageSize,
    className,
  } = props;

  const resolvedManualSorting = manualSorting ?? false;
  const resolvedManualFiltering = manualFiltering ?? false;
  const resolvedManualPagination = manualPagination ?? false;
  const hasGlobalFilter = globalFilter != null;

  const tanstackColumnFilters: ColumnFiltersState | undefined =
    columnFilters != null
      ? Object.entries(columnFilters)
          .filter(([, value]) => value != null && value !== '')
          .map(([id, value]) => ({ id, value }))
      : undefined;

  // Manage column sizing locally when the consumer does not provide controlled
  // state. Passing `onColumnSizingChange: undefined` to TanStack would override
  // its internal default handler with nothing, silently breaking resize.
  const [internalColumnSizing, setInternalColumnSizing] = useState<ColumnSizingState>({});
  const resolvedColumnSizing = columnSizing ?? internalColumnSizing;
  const resolvedOnColumnSizingChange: OnChangeFn<ColumnSizingState> = onColumnSizingChange ?? setInternalColumnSizing;

  const table = useTable({
    features: tableFeatureSet,
    data,
    columns,
    getRowId,
    manualFiltering: resolvedManualFiltering,
    getSubRows,

    state: {
      ...(sorting != null && { sorting }),
      ...(pagination != null && { pagination }),
      ...(rowSelection != null && { rowSelection }),
      ...(expanded != null && { expanded }),
      ...(columnVisibility != null && { columnVisibility }),
      columnSizing: resolvedColumnSizing,
      ...(hasGlobalFilter && { globalFilter }),
      ...(tanstackColumnFilters != null && { columnFilters: tanstackColumnFilters }),
      columnPinning: columnPinning ?? { start: [], end: [] },
    },

    onSortingChange,
    manualSorting: resolvedManualSorting,
    enableSortingRemoval: false,

    onPaginationChange,
    onGlobalFilterChange,
    manualPagination: resolvedManualPagination,
    pageCount: pageCount ?? -1,

    ...(initialPageSize != null && { initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } } }),

    enableRowSelection: enableRowSelection ?? false,
    onRowSelectionChange,

    onExpandedChange,
    onColumnVisibilityChange,
    onColumnSizingChange: resolvedOnColumnSizingChange,
    columnResizeMode: 'onChange',
  });

  const getColumnPinningStyles = useCallback(
    (columnId: string): React.CSSProperties => {
      const column = table.getColumn(columnId);
      if (column == null) {
        return {};
      }
      const isPinned = column.getIsPinned();
      const size = column.getSize();
      if (!isPinned) {
        return { flex: `${size} 0 ${size}px` };
      }
      return {
        position: 'sticky',
        left: isPinned === 'start' ? `${column.getStart('start')}px` : undefined,
        right: isPinned === 'end' ? `${column.getAfter('end')}px` : undefined,
        width: size,
        zIndex: isPinned === 'start' ? 10 : 20,
      };
    },
    [table],
  );

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  const containerClassName = ['studio-table-container', className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} data-test--table-container="">
      <div className="studio-table-scroll">
        <div className="studio-table" role="table" data-test--table="">
          <div className="studio-table__head" role="rowgroup">
            {headerGroups.map((headerGroup) => (
              <div className="studio-table__row studio-table__header-row" role="row" key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinningStyle = getColumnPinningStyles(header.column.id);
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  const handleHeaderClick = (): void => {
                    if (canSort) {
                      header.column.toggleSorting();
                    }
                  };

                  const headerClassName = [
                    'studio-table__cell',
                    'studio-table__header-cell',
                    canSort ? 'studio-table__header-cell--sortable' : '',
                    header.column.getIsPinned() ? `studio-table__cell--pinned-${header.column.getIsPinned()}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      className={headerClassName}
                      role="columnheader"
                      key={header.id}
                      style={pinningStyle}
                      onClick={handleHeaderClick}
                      data-test--column-header={header.column.id}
                    >
                      <div className="studio-table__header-content">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDirection && (
                          <span className="studio-table__sort-indicator">
                            {sortDirection === 'asc' ? (
                              <i className="ph ph-caret-up" />
                            ) : (
                              <i className="ph ph-caret-down" />
                            )}
                          </span>
                        )}
                        {enableFilters &&
                          onColumnFilterChange &&
                          isRangeFilterVariant(
                            (header.column.columnDef.meta as TableColumnMeta | undefined)?.filterVariant,
                          ) && (
                            <TableColumnFilter
                              columnId={header.column.id}
                              columnMeta={header.column.columnDef.meta as TableColumnMeta | undefined}
                              value={columnFilters?.[header.column.id]}
                              onChange={onColumnFilterChange}
                            />
                          )}
                      </div>
                      {enableFilters && columnFilters != null && (
                        <RangeFilterSublabel
                          filterVariant={(header.column.columnDef.meta as TableColumnMeta | undefined)?.filterVariant}
                          value={columnFilters[header.column.id]}
                          labels={(header.column.columnDef.meta as TableColumnMeta | undefined)?.filterRangeLabels}
                        />
                      )}
                      {enableFilters &&
                        onColumnFilterChange &&
                        !isRangeFilterVariant(
                          (header.column.columnDef.meta as TableColumnMeta | undefined)?.filterVariant,
                        ) && (
                          <TableColumnFilter
                            columnId={header.column.id}
                            columnMeta={header.column.columnDef.meta as TableColumnMeta | undefined}
                            value={columnFilters?.[header.column.id]}
                            onChange={onColumnFilterChange}
                          />
                        )}
                      {header.column.getCanResize() && (
                        <div
                          className={`studio-table__resize-handle ${header.column.getIsResizing() ? 'studio-table__resize-handle--active' : ''}`}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(event) => event.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="studio-table__body" role="rowgroup">
            {rows.map((row) => {
              const isActive = activeRowId != null && row.id === activeRowId;
              const isHighlighted = highlightedRowId != null && row.id === highlightedRowId;
              const isSubRow = row.depth > 0;

              const rowClassName = [
                'studio-table__row',
                isActive ? 'studio-table__row--active' : '',
                isHighlighted ? 'studio-table__row--highlighted' : '',
                isSubRow ? 'studio-table__row--child' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  className={rowClassName}
                  role="row"
                  key={row.id}
                  data-test--table-row={row.id}
                  onClick={(event) => {
                    const selection = window.getSelection()?.toString();
                    if (!selection) {
                      onRowClick?.(row.original, event);
                    }
                  }}
                  onDoubleClick={(event) => onRowDoubleClick?.(row.original, event)}
                  onContextMenu={(event) => onRowContextMenu?.(row.original, event)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinningStyle = getColumnPinningStyles(cell.column.id);
                    const isPinned = cell.column.getIsPinned();

                    const cellClassName = [
                      'studio-table__cell',
                      isPinned ? `studio-table__cell--pinned-${isPinned}` : '',
                      isSubRow && isPinned ? 'studio-table__cell--child-pinned' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div
                        className={cellClassName}
                        role="cell"
                        key={cell.id}
                        style={pinningStyle}
                        data-test--table-cell={cell.column.id}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {pagination != null && onPaginationChange != null && (
        <TablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}

function isRangeFilterVariant(variant?: string): boolean {
  return variant === 'date-range' || variant === 'duration-range';
}

type RangeFilterSublabelProps = {
  filterVariant?: string;
  value: unknown;
  labels?: { from: string; to: string };
};

function RangeFilterSublabel({ filterVariant, value, labels }: RangeFilterSublabelProps): React.JSX.Element | null {
  if (filterVariant === 'date-range') {
    const dateValue = value as DateRangeFilterValue | undefined;
    if (dateValue == null) {
      return null;
    }
    const fromLabel = labels?.from ?? 'After';
    const toLabel = labels?.to ?? 'Before';
    const parts: string[] = [];
    if (dateValue.after) {
      parts.push(`${fromLabel}: ${dateValue.after}`);
    }
    if (dateValue.before) {
      parts.push(`${toLabel}: ${dateValue.before}`);
    }
    if (parts.length === 0) {
      return null;
    }
    return <div className="studio-table__filter-sublabel">{parts.join(' | ')}</div>;
  }

  if (filterVariant === 'duration-range') {
    const durationValue = value as DurationRangeFilterValue | undefined;
    if (durationValue == null) {
      return null;
    }
    const parts: string[] = [];
    if (durationValue.greaterThanOrEqual != null) {
      parts.push(`≥ ${durationValue.greaterThanOrEqual}s`);
    }
    if (durationValue.lessThan != null) {
      parts.push(`< ${durationValue.lessThan}s`);
    }
    if (parts.length === 0) {
      return null;
    }
    return <div className="studio-table__filter-sublabel">{parts.join(' | ')}</div>;
  }

  return null;
}
