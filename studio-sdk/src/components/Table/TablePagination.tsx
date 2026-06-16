import type { Table } from '@tanstack/react-table';

import React from 'react';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type TablePaginationProps<TData> = {
  table: Table<TData>;
  pageSizeOptions?: number[];
};

export function TablePagination<TData>(props: TablePaginationProps<TData>): React.JSX.Element {
  const { table, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS } = props;

  const currentPage = table.getState().pagination.pageIndex;
  const totalPages = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;

  return (
    <div className="studio-table-pagination" data-test--table-pagination="">
      <div className="studio-table-pagination__page-size">
        <label htmlFor="studio-table-page-size">Rows:</label>
        <select
          id="studio-table-page-size"
          className="form-select form-select-sm"
          value={pageSize}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          data-test--page-size-select=""
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="studio-table-pagination__info">
        Page {currentPage + 1} of {Math.max(1, totalPages)}
      </div>

      <div className="studio-table-pagination__controls">
        <button
          className="btn btn-sm studio-table-pagination__btn"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          title="First page"
          data-test--first-page=""
        >
          <i className="ph ph-caret-double-left" />
        </button>
        <button
          className="btn btn-sm studio-table-pagination__btn"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Previous page"
          data-test--previous-page=""
        >
          <i className="ph ph-caret-left" />
        </button>
        <button
          className="btn btn-sm studio-table-pagination__btn"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Next page"
          data-test--next-page=""
        >
          <i className="ph ph-caret-right" />
        </button>
        <button
          className="btn btn-sm studio-table-pagination__btn"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          title="Last page"
          data-test--last-page=""
        >
          <i className="ph ph-caret-double-right" />
        </button>
      </div>
    </div>
  );
}
