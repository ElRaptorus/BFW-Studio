import { Icon } from '#components/Icon';
import {
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  Table,
  type TableColumnDef,
} from '#components/Table';
import { formatRulesetFailure } from '#modules/engine-core';

import React, { useMemo, useState } from 'react';

import { describeDeployItemLocation } from '../analysis/describeDeployItemLocation';
import type { DeployItemAnalysis, DeployItemResult } from '../analysis/types';
import type DeployPlanDocumentModel from '../models/DeployPlanDocumentModel';
import { DeployStatusBadge, LinterScoreBadges } from './DeployBadges';
import { DEPLOY_PAGE_SIZE_OPTIONS, matchesDeployTextFilter, resolveUpdater } from './deployTableSupport';
import { describeDeployStatus } from './formatDeployBadges';

export type DeployFileRow = {
  item: DeployItemAnalysis;
  fileName: string;
  folder: string;
  dependencyCount: number;
  unresolvedCount: number;
  result: DeployItemResult | null;
};

const KIND_LABELS: Record<DeployItemAnalysis['kind'], string> = { bpmn: 'BPMN', dmn: 'DMN', invalid: 'Invalid' };
const KIND_ICONS: Record<DeployItemAnalysis['kind'], string> = {
  bpmn: 'bpmn/editor-tab/bpmn',
  dmn: 'dmn/editor-tab/dmn',
  invalid: 'ph ph-warning',
};
const STATUS_OPTIONS = (
  [
    'new',
    'newVersion',
    'unchanged',
    'changedWithoutVersionBump',
    'versionMissing',
    'skipped',
    'unknown',
    'invalid',
  ] as const
).map((status) => ({ value: status, label: describeDeployStatus(status).label }));

export function buildDeployFileRows(model: DeployPlanDocumentModel): DeployFileRow[] {
  const projectRoots = model.getProjectRoots();
  return model.getAnalysis().items.map((item) => {
    const location = describeDeployItemLocation(item.uri, projectRoots);
    const dependencies = model.getDependenciesOf(item.uri);
    return {
      item,
      fileName: location.fileName,
      folder: location.folder,
      dependencyCount: dependencies.length,
      unresolvedCount: dependencies.filter((dependency) => ['localNotInPlan', 'missing'].includes(dependency.state))
        .length,
      result: model.getResult(item.uri),
    };
  });
}

function matchesColumnFilters(row: DeployFileRow, columnFilters: Record<string, unknown>): boolean {
  const fileFilter = columnFilters.file;
  const kindFilter = columnFilters.kind as string[] | undefined;
  const statusFilter = columnFilters.status as string[] | undefined;
  return (
    (typeof fileFilter !== 'string' || matchesDeployTextFilter(`${row.fileName} ${row.folder}`, fileFilter)) &&
    (kindFilter == null || kindFilter.length === 0 || kindFilter.includes(row.item.kind)) &&
    (statusFilter == null || statusFilter.length === 0 || statusFilter.includes(row.item.status))
  );
}

/** The rows that remain after the column filters and the toolbar text filter. */
export function filterDeployFileRows(
  rows: readonly DeployFileRow[],
  columnFilters: Record<string, unknown>,
  textFilter: string,
): DeployFileRow[] {
  return rows.filter(
    (row) =>
      matchesColumnFilters(row, columnFilters) && matchesDeployTextFilter(`${row.fileName} ${row.folder}`, textFilter),
  );
}

function versionsText(row: DeployFileRow): string {
  return row.item.processes.map((process) => process.version ?? '–').join(', ');
}

function lowestScorePercent(row: DeployFileRow): number {
  const percents = row.item.storedLinterScores.map((score) => Number(score.scorePercent)).filter(Number.isFinite);
  return percents.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...percents);
}

export function DeployPlanFilesTable(props: {
  model: DeployPlanDocumentModel;
  textFilter: string;
  columnFilters: Record<string, unknown>;
  onColumnFilterChange: (columnId: string, value: unknown) => void;
}): React.JSX.Element {
  const { model, textFilter, columnFilters, onColumnFilterChange } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });

  const revision = model.getRevision();
  // The model mutates in place and publishes a revision on every change, so the revision is the memo key.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision stands for the model's content
  const allRows = useMemo(() => buildDeployFileRows(model), [model, revision]);
  const rows = useMemo(
    () => filterDeployFileRows(allRows, columnFilters, textFilter),
    [allRows, columnFilters, textFilter],
  );

  const rowSelection: RowSelectionState = Object.fromEntries(
    [...model.getIncludedUris()].map((uri) => [uri, true] as const),
  );

  const columns: TableColumnDef<DeployFileRow, any>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Include all shown files"
          title="Include or exclude all shown files from the deployment"
          checked={table.getIsAllRowsSelected()}
          ref={(input) => {
            if (input) {
              input.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
            }
          }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Include ${row.original.fileName}`}
          title="Include in the deployment"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      size: 40,
    },
    {
      id: 'file',
      accessorFn: (row) => row.fileName,
      header: 'File',
      size: 280,
      cell: ({ row }) => (
        <div className="deploy-plan__file">
          <Icon id={KIND_ICONS[row.original.item.kind]} />
          <div>
            <div>{row.original.fileName}</div>
            {row.original.folder !== '' && <div className="deploy-plan__folder">{row.original.folder}</div>}
          </div>
        </div>
      ),
      meta: { filterVariant: 'text' as const },
    },
    {
      id: 'kind',
      accessorFn: (row) => row.item.kind,
      header: 'Kind',
      size: 90,
      cell: ({ row }) => KIND_LABELS[row.original.item.kind],
      meta: {
        filterVariant: 'multi-select' as const,
        filterOptions: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
      },
    },
    {
      id: 'status',
      accessorFn: (row) => row.item.status,
      header: 'Status',
      size: 150,
      cell: ({ row }) => <DeployStatusBadge status={row.original.item.status} />,
      meta: { filterVariant: 'multi-select' as const, filterOptions: STATUS_OPTIONS },
    },
    {
      id: 'versions',
      accessorFn: versionsText,
      header: 'Versions',
      size: 110,
      cell: (info) => info.getValue<string>() || '–',
      sortFn: (left, right) =>
        versionsText(left.original).localeCompare(versionsText(right.original), undefined, { numeric: true }),
    },
    {
      id: 'dependencies',
      accessorFn: (row) => row.unresolvedCount,
      header: 'Dependencies',
      size: 130,
      cell: ({ row }) =>
        row.original.unresolvedCount > 0 ? `${row.original.unresolvedCount} unresolved` : row.original.dependencyCount,
    },
    {
      id: 'linter',
      accessorFn: (row) => lowestScorePercent(row),
      header: 'Linter',
      size: 190,
      cell: ({ row }) => <LinterScoreBadges scores={row.original.item.storedLinterScores} />,
    },
    {
      id: 'result',
      accessorFn: (row) => row.result?.status ?? '',
      header: 'Result',
      size: 200,
      cell: ({ row }) => {
        const result = row.original.result;
        return result == null ? null : (
          <div className={`deploy-plan__result--${result.status}`}>
            {result.message ?? result.status}
            {result.rulesetFailures.map((failure) => (
              <div key={formatRulesetFailure(failure)}>{formatRulesetFailure(failure)}</div>
            ))}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <button
          type="button"
          className="btn btn-sm btn-secondary deploy-plan__icon-button"
          title="Remove from plan"
          onClick={(event) => {
            event.stopPropagation();
            void model.removeItem(row.original.item.uri);
          }}
        >
          <Icon id="ph ph-minus-circle" />
        </button>
      ),
      meta: { disableSorting: true },
    },
  ];

  return (
    <Table<DeployFileRow>
      data={rows}
      columns={columns}
      getRowId={(row) => row.item.uri}
      sorting={sorting}
      onSortingChange={setSorting}
      pagination={pagination}
      onPaginationChange={setPagination}
      pageSizeOptions={DEPLOY_PAGE_SIZE_OPTIONS}
      manualFiltering
      enableRowSelection={(row) => row.original.item.kind !== 'invalid' || model.isIncluded(row.original.item.uri)}
      rowSelection={rowSelection}
      onRowSelectionChange={(updater) => {
        const next = resolveUpdater(updater, rowSelection);
        const nextUris = new Set(Object.keys(next).filter((uri) => next[uri]));
        const shownUris = rows.map((row) => row.item.uri);
        model.setManyIncluded(
          shownUris.filter((uri) => nextUris.has(uri) && !model.isIncluded(uri)),
          true,
        );
        model.setManyIncluded(
          shownUris.filter((uri) => !nextUris.has(uri) && model.isIncluded(uri)),
          false,
        );
      }}
      columnPinning={{ start: ['select'], end: ['actions'] }}
      enableFilters
      columnFilters={columnFilters}
      onColumnFilterChange={onColumnFilterChange}
      activeRowId={model.getSelectedUri() ?? undefined}
      onRowClick={(row) => model.selectItem(row.item.uri)}
      className="deploy-plan__data-table"
    />
  );
}
