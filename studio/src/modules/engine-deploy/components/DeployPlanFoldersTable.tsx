import { Icon } from '#components/Icon';
import { type PaginationState, type SortingState, Table, type TableColumnDef } from '#components/Table';

import React, { useMemo, useState } from 'react';

import type { DeployFolderSummary } from '../analysis/summarizeDeployFolders';
import { summarizeDeployFolders } from '../analysis/summarizeDeployFolders';
import type { DeployItemStatus } from '../analysis/types';
import type DeployPlanDocumentModel from '../models/DeployPlanDocumentModel';
import { DeployStatusBadge, LinterBadge } from './DeployBadges';
import { DEPLOY_PAGE_SIZE_OPTIONS, matchesDeployTextFilter } from './deployTableSupport';
import { formatPercent, longRulesetLabel, shortRulesetLabel } from './formatDeployBadges';

type DeployFolderRow = DeployFolderSummary & { id: string; includableUris: string[] };

export function DeployPlanFoldersTable(props: {
  model: DeployPlanDocumentModel;
  textFilter: string;
}): React.JSX.Element {
  const { model, textFilter } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });

  const revision = model.getRevision();
  // The model mutates in place and publishes a revision on every change, so the revision is the memo key.
  const allRows = useMemo<DeployFolderRow[]>(() => {
    const analysis = model.getAnalysis();
    const invalidUris = new Set(analysis.items.filter((item) => item.kind === 'invalid').map((item) => item.uri));
    return summarizeDeployFolders(
      analysis.items,
      model.getIncludedUris(),
      (uri) => model.getResult(uri),
      model.getProjectRoots(),
    ).map((summary) => ({
      ...summary,
      id: summary.folder === '' ? '.' : summary.folder,
      includableUris: summary.fileUris.filter((uri) => !invalidUris.has(uri)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision stands for the model's content
  }, [model, revision]);
  const rows = useMemo(
    () => allRows.filter((row) => matchesDeployTextFilter(row.folder, textFilter)),
    [allRows, textFilter],
  );
  const includedUris = model.getIncludedUris();

  const columns: TableColumnDef<DeployFolderRow, any>[] = [
    {
      id: 'include',
      header: '',
      size: 40,
      cell: ({ row }) => {
        const { includableUris } = row.original;
        const includedCount = includableUris.filter((uri) => includedUris.has(uri)).length;
        return (
          <input
            type="checkbox"
            aria-label={`Include all files in ${row.original.id}`}
            data-test--deploy-folder-include={row.original.id}
            disabled={includableUris.length === 0}
            checked={includableUris.length > 0 && includedCount === includableUris.length}
            ref={(input) => {
              if (input) {
                input.indeterminate = includedCount > 0 && includedCount < includableUris.length;
              }
            }}
            onChange={(event) => model.setManyIncluded(includableUris, event.target.checked)}
            onClick={(event) => event.stopPropagation()}
          />
        );
      },
    },
    {
      id: 'folder',
      accessorFn: (row) => row.id,
      header: 'Folder',
      size: 320,
      cell: ({ row }) => (
        <div className="deploy-plan__file">
          <Icon id="ph ph-folder" />
          <span>{row.original.id}</span>
        </div>
      ),
    },
    {
      id: 'files',
      accessorFn: (row) => row.fileUris.length,
      header: 'Files',
      size: 130,
      cell: ({ row }) => `${row.original.includedCount} of ${row.original.fileUris.length} included`,
    },
    {
      id: 'status',
      accessorFn: (row) => Object.keys(row.statusCounts).length,
      header: 'Status',
      size: 320,
      cell: ({ row }) => (
        <span className="deploy-badge-group">
          {(Object.entries(row.original.statusCounts) as [DeployItemStatus, number][]).map(([status, count]) => (
            <DeployStatusBadge key={status} status={status} count={count} />
          ))}
        </span>
      ),
      meta: { disableSorting: true },
    },
    {
      id: 'linter',
      accessorFn: (row) => row.linter.length,
      header: 'Linter (average)',
      size: 220,
      cell: ({ row }) =>
        row.original.linter.length === 0 ? (
          <span className="deploy-plan__muted">–</span>
        ) : (
          <span className="deploy-badge-group">
            {row.original.linter.map((summary) => (
              <LinterBadge
                key={summary.rulesetId}
                presentation={{
                  label: `${shortRulesetLabel(summary.rulesetId)}: ${formatPercent(summary.averagePercent)}`,
                  tooltip: `${longRulesetLabel(summary.rulesetId)}: average of ${summary.fileCount} file(s), worst verdict ${summary.verdict}`,
                  verdict: summary.verdict,
                }}
              />
            ))}
          </span>
        ),
      meta: { disableSorting: true },
    },
    {
      id: 'result',
      accessorFn: (row) => row.deployedCount + row.failedCount,
      header: 'Result',
      size: 160,
      cell: ({ row }) =>
        row.original.deployedCount + row.original.failedCount === 0
          ? null
          : `${row.original.deployedCount} deployed, ${row.original.failedCount} failed`,
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <button
          type="button"
          className="btn btn-sm btn-secondary deploy-plan__icon-button"
          title="Remove the folder's files from the plan"
          onClick={() => void model.removeItems(row.original.fileUris)}
        >
          <Icon id="ph ph-minus-circle" />
        </button>
      ),
      meta: { disableSorting: true },
    },
  ];

  return (
    <Table<DeployFolderRow>
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      sorting={sorting}
      onSortingChange={setSorting}
      pagination={pagination}
      onPaginationChange={setPagination}
      pageSizeOptions={DEPLOY_PAGE_SIZE_OPTIONS}
      manualFiltering
      columnPinning={{ start: ['include'], end: ['actions'] }}
      className="deploy-plan__data-table"
    />
  );
}
