import type { AutoRefreshInterval, EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  ProcessInstanceStateBadge,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';
import { ProcessInstanceState } from '@elraptorus/daemonengine_sdk';
import type { ProcessInstance } from '@elraptorus/daemonengine_sdk';
import type { ProcessInstanceField, SortClause } from '@elraptorus/daemonengine_sdk';

import React, { useCallback, useMemo, useState } from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  type ColumnDef,
  Editor,
  EditorContent,
  EditorLoadingErrorHint,
  EditorTitle,
  EditorTitleHeroIcon,
  EditorTitleLeft,
  EditorTitleText,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarCenter,
  EditorToolbarLeft,
  EditorToolbarMenu,
  EditorToolbarRight,
  EditorToolbarText,
  Icon,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  Table,
  showContextMenu,
} from '@evil/bifrost_fw_sdk';

import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';
import type { InstanceSearchContextMetadata } from '../types/InstanceSearchContext';
import './EngineListView.scss';

interface TreeRow extends ProcessInstance {
  depth: number;
}

function buildInstanceTree(instances: ProcessInstance[]): TreeRow[] {
  const byId = new Map(instances.map((instance) => [instance.id, instance]));
  const childrenByParent = new Map<string | null, ProcessInstance[]>();

  for (const instance of instances) {
    const parentId = instance.parentProcessInstanceId;
    const parentExists = parentId != null && byId.has(parentId);
    const bucketKey = parentExists ? parentId : null;
    const bucket = childrenByParent.get(bucketKey) ?? [];
    bucket.push(instance);
    childrenByParent.set(bucketKey, bucket);
  }

  const rows: TreeRow[] = [];

  const walk = (parentId: string | null, depth: number): void => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      rows.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  };

  walk(null, 0);
  return rows;
}

export default function InstanceSearchRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Studio = studio;
  const model = useEditorModel<InstanceSearchDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = model?.getEngineId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = {
    instances: model?.getInstances() ?? [],
    loading: model?.isLoading() ?? true,
    error: model?.getError() ?? null,
    lastUpdated: model?.getLastUpdated() ?? null,
    hasNextPage: model?.getHasNextPage() ?? false,
    hasPreviousPage: model?.getHasPreviousPage() ?? false,
    totalCount: model?.getTotalCount() ?? 0,
    pageIndex: model?.getPageIndex() ?? 0,
    pageCount: model?.getPageCount() ?? 1,
    engineIsOnline: model?.isEngineOnline() ?? true,
    connectionGracePeriodExpired: model?.isConnectionGracePeriodExpired() ?? false,
  };

  const treeRows = useMemo(() => buildInstanceTree(data.instances), [data.instances]);
  const selectedInstanceId = model?.getSelectedInstanceId() ?? null;
  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.instanceSearchAutoRefresh) ?? '30s';

  const [sorting, setSorting] = useState<SortingState>([{ id: 'startedAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: data.pageIndex ?? 0, pageSize: model?.getPageSize() ?? 50 }),
    [data.pageIndex, model],
  );
  const pageCount = data.pageCount;

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageIndex !== pagination.pageIndex) {
        model?.goToPage(next.pageIndex);
      }
    },
    [model, pagination],
  );

  const [columnFilters, setColumnFilters] = useState<Record<string, unknown>>({});
  const [lastSyncedRevision, setLastSyncedRevision] = useState(0);
  const filterRevision: number = (editorDocument.metadata as any)?.filterRevision ?? 0;

  if (filterRevision !== lastSyncedRevision && model) {
    setLastSyncedRevision(filterRevision);
    const synced: Record<string, unknown> = {};
    const idFilter = model.getIdFilter();
    if (idFilter) {
      synced.id = idFilter;
    }
    const processModelIdFilter = model.getProcessModelIdFilter();
    if (processModelIdFilter) {
      synced.processModelId = processModelIdFilter;
    }
    const versionFilter = model.getVersionFilter();
    if (versionFilter) {
      synced.version = versionFilter;
    }
    const stateFilter = model.getStateFilter();
    if (stateFilter.length > 0) {
      synced.state = stateFilter;
    }
    const businessKeyFilter = model.getBusinessKeyFilter();
    if (businessKeyFilter) {
      synced.businessKey = businessKeyFilter;
    }
    const startedAtFilter = model.getStartedAtFilter();
    if (startedAtFilter.after || startedAtFilter.before) {
      synced.startedAt = startedAtFilter;
    }
    setColumnFilters(synced);
  }

  const handleRowSelectionChange = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(nextSelection);
    const selectedIds = Object.keys(nextSelection).filter((key) => nextSelection[key]);
    model?.setSelectedInstanceIds(selectedIds);
  };

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(nextSorting);
      const clauses: SortClause<ProcessInstanceField>[] = nextSorting.map((sort) => ({
        field: sort.id as ProcessInstanceField,
        direction: sort.desc ? 'desc' : 'asc',
      }));
      model?.setSortClauses(clauses);
    },
    [model, sorting],
  );

  const handleColumnFilterChange = useCallback(
    (columnId: string, value: unknown) => {
      setColumnFilters((prev) => {
        const next = { ...prev };
        if (value == null || value === '') {
          delete next[columnId];
        } else {
          next[columnId] = value;
        }
        return next;
      });

      if (columnId === 'id') {
        model?.setIdFilter((value as string) || null);
      } else if (columnId === 'processModelId') {
        model?.setProcessModelIdFilter((value as string) || null);
      } else if (columnId === 'version') {
        model?.setVersionFilter((value as string) || null);
      } else if (columnId === 'state') {
        const states = (value as string[] | undefined) ?? [];
        model?.setStateFilter(states as ProcessInstance['state'][]);
      } else if (columnId === 'startedAt') {
        const dateRange = value as { after?: string; before?: string } | undefined;
        model?.setStartedAtFilter(dateRange?.after ?? null, dateRange?.before ?? null);
      } else if (columnId === 'businessKey') {
        model?.setBusinessKeyFilter((value as string) || null);
      }
    },
    [model],
  );

  const openContextMenuForInstance = (event: React.MouseEvent, instance: TreeRow) => {
    event.preventDefault();
    event.stopPropagation();
    const cellElement = (event.target as HTMLElement).closest<HTMLElement>('[data-test--table-cell]');
    const columnId = cellElement?.getAttribute('data-test--table-cell') ?? undefined;
    let cellValue: string | undefined;
    if (columnId && columnId !== 'select' && columnId !== 'actions') {
      const raw = (instance as unknown as Record<string, unknown>)[columnId];
      cellValue = raw != null ? String(raw) : undefined;
    }
    const metadata: InstanceSearchContextMetadata = { engineId, instance, columnId, cellValue };
    showContextMenu(event, 'engine-workspace/instance-search/contextmenu', [metadata, bifrost]);
  };

  const columns: ColumnDef<TreeRow, any>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all rows"
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
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      size: 36,
    },
    {
      accessorKey: 'id',
      header: 'Instance ID',
      enableSorting: true,
      cell: (info) => (
        <span className="engine-list-view__tree-indent engine-list-view__monospace">
          {info.row.original.depth > 0 ? '↳ ' : ''}
          {info.getValue<string>().slice(0, 8)}…
        </span>
      ),
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'processModelId',
      header: 'Process',
      enableSorting: false,
      cell: (info) => info.getValue<string>() ?? '—',
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'version',
      header: 'Version',
      enableSorting: false,
      cell: (info) => info.getValue<string>() ?? '—',
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'state',
      header: 'State',
      enableSorting: true,
      cell: (info) => <ProcessInstanceStateBadge state={info.getValue()} />,
      meta: {
        filterVariant: 'multi-select' as const,
        filterOptions: [
          { value: ProcessInstanceState.Running, label: 'Running' },
          { value: ProcessInstanceState.Finished, label: 'Finished' },
          { value: ProcessInstanceState.Fatal, label: 'Fatal' },
          { value: ProcessInstanceState.Aborted, label: 'Aborted' },
          { value: ProcessInstanceState.Error, label: 'Error' },
        ],
      },
    },
    {
      accessorKey: 'errorInfo',
      header: 'Error',
      enableSorting: false,
      cell: (info) => {
        const errorInfo = info.getValue<Record<string, unknown> | null | undefined>();
        if (!errorInfo) {
          return <span className="engine-list-view__muted">—</span>;
        }
        const message = typeof errorInfo.message === 'string' ? errorInfo.message : JSON.stringify(errorInfo);
        return (
          <span className="engine-list-view__error-cell" title={message}>
            {message}
          </span>
        );
      },
    },
    {
      accessorKey: 'startedAt',
      header: 'Started',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue<string>();
        return value ? getHumanizedDateTime(value) : '—';
      },
      meta: {
        filterVariant: 'date-range' as const,
        filterRangeLabels: { from: 'After', to: 'Before' },
      },
    },
    {
      accessorKey: 'businessKey',
      header: 'Business Key',
      enableSorting: true,
      cell: (info) => info.getValue<string>() ?? '—',
      meta: { filterVariant: 'text' as const },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="engine-list-view__actions">
          <button
            type="button"
            className="engine-list-view__action-button"
            title="Open in Debugger"
            onClick={(event) => {
              event.stopPropagation();
              bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, row.original.id]);
            }}
          >
            <Icon id="ph ph-bug" />
          </button>
          <button
            type="button"
            className="engine-list-view__action-button"
            title="More actions"
            onClick={(event) => openContextMenuForInstance(event, row.original)}
          >
            <Icon id="ph ph-dots-three-vertical" />
          </button>
        </div>
      ),
      size: 72,
    },
  ];

  const healthState = resolveHealthState(
    connection?.state === 'connected' ? true : null,
    connectionManager.getHealthOverride(engineId),
  );

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-magnifying-glass" />
          <EditorTitleText
            studio={bifrost}
            label="Instances"
            sublabel={
              <EngineContextBreadcrumb
                studio={bifrost}
                engineId={engineId}
                engineDisplayName={engineDisplayName}
                healthState={healthState}
              />
            }
          />
        </EditorTitleLeft>
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText
            studio={bifrost}
            label={data.lastUpdated ? `Updated ${getHumanizedDateTime(data.lastUpdated)}` : ''}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-stop"
            tooltip="Abort selected instances"
            command="engine.workspace.instanceSearch.abortSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-counter-clockwise"
            tooltip="Retry selected instances"
            command="engine.workspace.instanceSearch.retrySelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-trash"
            tooltip="Delete selected instances"
            command="engine.workspace.instanceSearch.deleteSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.workspace.instanceSearch.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh Cooldown"
            menuId="engine-workspace/instance-search/refresh-interval"
          />
          <EditorToolbarButton
            studio={bifrost}
            tooltip="Settings"
            icon="ph ph-gear"
            command="std.settings.openUserSettings"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-key"
            label={resolveAuthLabel(connectionManager, engineUrl)}
            command={ENGINE_COMMANDS.setAuthToken}
            commandArgs={[engineUrl]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        {!data.engineIsOnline && !data.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Connection to engine lost. Attempting to reconnect..." />
        )}
        {!data.engineIsOnline && data.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Engine is not reachable." />
        )}
        <div className="engine-list-view" style={{ display: 'flex', flexDirection: 'column' }}>
          {data.error && <div className="engine-list-view__error">{data.error}</div>}
          {data.loading && data.instances.length === 0 && (
            <div className="engine-list-view__loading">Loading process instances...</div>
          )}
          {!data.loading && data.instances.length === 0 && !data.error && Object.keys(columnFilters).length === 0 && (
            <div className="engine-list-view__empty">No process instances found.</div>
          )}

          {(data.instances.length > 0 || Object.keys(columnFilters).length > 0) && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table<TreeRow>
                data={treeRows}
                columns={columns}
                getRowId={(row) => row.id}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                manualSorting
                manualFiltering
                manualPagination
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                pageCount={pageCount}
                rowSelection={rowSelection}
                onRowSelectionChange={handleRowSelectionChange}
                enableRowSelection
                columnPinning={{ left: ['select'], right: ['actions'] }}
                enableFilters
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                activeRowId={selectedInstanceId ?? undefined}
                onRowClick={(row) => model?.selectInstance(row)}
                onRowContextMenu={(row, event) => openContextMenuForInstance(event, row)}
              />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
