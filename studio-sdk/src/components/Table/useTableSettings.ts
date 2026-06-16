import type { ColumnSizingState, OnChangeFn, PaginationState, VisibilityState } from '@tanstack/react-table';

import { useCallback, useMemo } from 'react';

import type { SettingsMediator } from '../../../types/common/SettingsMediator';

type TableSettingsConfig = {
  settings: SettingsMediator;
  columnVisibilityKey?: string;
  columnWidthsKey?: string;
  pageSizeKey?: string;
  scopeKey?: string;
};

type TableSettingsResult = {
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
};

function readMergedSetting(settings: SettingsMediator, key: string, scopeKey: string): Record<string, unknown> {
  const defaultValues = settings.getDefault(key);
  const currentValues = settings.get(key);
  return {
    ...(defaultValues?.['*'] ?? {}),
    ...(currentValues?.['*'] ?? {}),
    ...(scopeKey !== '*' ? (currentValues?.[scopeKey] ?? {}) : {}),
  };
}

function writeScopedSetting(settings: SettingsMediator, key: string, scopeKey: string, value: unknown): void {
  const currentValues = settings.get(key) ?? {};
  settings.set(key, {
    ...currentValues,
    [scopeKey]: value,
  });
}

export function useTableSettings(config: TableSettingsConfig): TableSettingsResult {
  const { settings, columnVisibilityKey, columnWidthsKey, pageSizeKey, scopeKey = '*' } = config;

  const columnVisibility = useMemo<VisibilityState>(() => {
    if (columnVisibilityKey == null) {
      return {};
    }
    return readMergedSetting(settings, columnVisibilityKey, scopeKey) as VisibilityState;
  }, [settings, columnVisibilityKey, scopeKey]);

  const onColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
    (updater) => {
      if (columnVisibilityKey == null) {
        return;
      }
      const nextVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
      writeScopedSetting(settings, columnVisibilityKey, scopeKey, nextVisibility);
    },
    [settings, columnVisibilityKey, scopeKey, columnVisibility],
  );

  const columnSizing = useMemo<ColumnSizingState>(() => {
    if (columnWidthsKey == null) {
      return {};
    }
    return readMergedSetting(settings, columnWidthsKey, scopeKey) as ColumnSizingState;
  }, [settings, columnWidthsKey, scopeKey]);

  const onColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    (updater) => {
      if (columnWidthsKey == null) {
        return;
      }
      const nextSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
      writeScopedSetting(settings, columnWidthsKey, scopeKey, nextSizing);
    },
    [settings, columnWidthsKey, scopeKey, columnSizing],
  );

  const pageSize = useMemo<number>(() => {
    if (pageSizeKey == null) {
      return 10;
    }
    const value = settings.get(pageSizeKey);
    return typeof value === 'number' ? value : (settings.getDefault(pageSizeKey) ?? 10);
  }, [settings, pageSizeKey]);

  const onPageSizeChange = useCallback(
    (newPageSize: number) => {
      if (pageSizeKey == null) {
        return;
      }
      settings.set(pageSizeKey, newPageSize);
    },
    [settings, pageSizeKey],
  );

  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: 0,
      pageSize,
    }),
    [pageSize],
  );

  const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const currentPagination = { pageIndex: 0, pageSize };
      const nextPagination = typeof updater === 'function' ? updater(currentPagination) : updater;
      if (nextPagination.pageSize !== pageSize) {
        onPageSizeChange(nextPagination.pageSize);
      }
    },
    [pageSize, onPageSizeChange],
  );

  return {
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    pageSize,
    onPageSizeChange,
    pagination,
    onPaginationChange,
  };
}
