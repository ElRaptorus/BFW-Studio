import type { EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  FlowNodeIcon,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';
import type { AutoRefreshInterval } from '#modules/engine-core';
import type { FlowNodeInstance, FlowNodeInstanceField, SortClause } from '@elraptorus/daemonengine_sdk';

import React, { useCallback, useMemo, useState } from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorLoadingErrorHint,
  EditorTitle,
  EditorTitleCenter,
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
  type TableColumnDef,
  showContextMenu,
} from '@evil/bifrost_fw_sdk';

import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { TaskInboxDocumentModel } from '../models/TaskInboxDocumentModel';
import type { TaskInboxContextMetadata } from '../types/TaskInboxContext';
import './EngineListView.scss';

export default function TaskInboxRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Studio = studio;
  const model = useEditorModel<TaskInboxDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = model?.getEngineId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = {
    tasks: model?.getTasks() ?? [],
    pendingCount: model?.getPendingCount() ?? 0,
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

  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.taskInboxAutoRefresh) ?? '30s';
  const selectedTaskId = model?.getSelectedTaskId() ?? null;

  const [sorting, setSorting] = useState<SortingState>([{ id: 'startedAt', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, unknown>>({});

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

  const handleRowSelectionChange = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(nextSelection);
    const selectedIds = Object.keys(nextSelection).filter((key) => nextSelection[key]);
    model?.setSelectedTaskIds(selectedIds);
  };

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(nextSorting);
      const clauses: SortClause<FlowNodeInstanceField>[] = nextSorting.map((sort) => ({
        field: sort.id as FlowNodeInstanceField,
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

      if (columnId === 'flowNodeId') {
        model?.setFlowNodeIdFilter((value as string) || null);
      } else if (columnId === 'processInstanceId') {
        model?.setProcessInstanceIdFilter((value as string) || null);
      } else if (columnId === 'laneName') {
        model?.setLaneNameFilter((value as string) || null);
      } else if (columnId === 'startedAt') {
        const dateRange = value as { after?: string; before?: string } | undefined;
        model?.setStartedAtFilter(dateRange?.after ?? null, dateRange?.before ?? null);
      }
    },
    [model],
  );

  const [lastSyncedRevision, setLastSyncedRevision] = useState(0);
  const filterRevision: number = (editorDocument.metadata as any)?.filterRevision ?? 0;

  if (filterRevision !== lastSyncedRevision && model) {
    setLastSyncedRevision(filterRevision);
    const synced: Record<string, unknown> = {};
    const flowNodeIdFilter = model.getFlowNodeIdFilter();
    if (flowNodeIdFilter) {
      synced.flowNodeId = flowNodeIdFilter;
    }
    const processInstanceIdFilter = model.getProcessInstanceIdFilter();
    if (processInstanceIdFilter) {
      synced.processInstanceId = processInstanceIdFilter;
    }
    const laneNameFilter = model.getLaneNameFilter();
    if (laneNameFilter) {
      synced.laneName = laneNameFilter;
    }
    const startedAtFilter = model.getStartedAtFilter();
    if (startedAtFilter.after || startedAtFilter.before) {
      synced.startedAt = startedAtFilter;
    }
    setColumnFilters(synced);
  }

  const openContextMenuForTask = (event: React.MouseEvent, task: FlowNodeInstance) => {
    event.preventDefault();
    event.stopPropagation();
    const cellElement = (event.target as HTMLElement).closest<HTMLElement>('[data-test--table-cell]');
    const columnId = cellElement?.getAttribute('data-test--table-cell') ?? undefined;
    let cellValue: string | undefined;
    if (columnId && columnId !== 'select' && columnId !== 'actions') {
      const raw = (task as unknown as Record<string, unknown>)[columnId];
      cellValue = raw != null ? String(raw) : undefined;
    }
    const metadata: TaskInboxContextMetadata = { engineId, task, columnId, cellValue };
    showContextMenu(event, 'engine-workspace/task-inbox/contextmenu', [metadata, bifrost]);
  };

  const columns: TableColumnDef<FlowNodeInstance, any>[] = [
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
      accessorKey: 'flowNodeId',
      header: 'Task',
      enableSorting: true,
      cell: (info) => (
        <span className="engine-list-view__task-cell">
          <FlowNodeIcon flowNodeType={info.row.original.flowNodeType} eventType={info.row.original.eventType} />
          {info.getValue<string>()}
        </span>
      ),
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'processInstanceId',
      header: 'Process Instance',
      enableSorting: true,
      cell: (info) => <span className="engine-list-view__monospace">{info.getValue<string>().slice(0, 8)}...</span>,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'laneName',
      header: 'Lane',
      enableSorting: true,
      cell: (info) => info.getValue<string>() ?? '—',
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'startedAt',
      header: 'Waiting since',
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
              bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [
                engineId,
                row.original.processInstanceId,
              ]);
            }}
          >
            <Icon id="ph ph-bug" />
          </button>
          <button
            type="button"
            className="engine-list-view__action-button"
            title="More actions"
            onClick={(event) => openContextMenuForTask(event, row.original)}
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
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-tray" />
          <EditorTitleText
            studio={bifrost}
            label="Task Inbox"
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
        <EditorTitleCenter>
          {data.pendingCount > 0 && (
            <span className="engine-list-view__pending-badge">{data.pendingCount} waiting</span>
          )}
        </EditorTitleCenter>
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
            icon="ph ph-check-circle"
            tooltip="Complete selected tasks"
            command="engine.workspace.taskInbox.completeSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.workspace.taskInbox.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh Cooldown"
            menuId="engine-workspace/task-inbox/refresh-interval"
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
          {data.loading && data.tasks.length === 0 && <div className="engine-list-view__loading">Loading tasks...</div>}
          {!data.loading && data.tasks.length === 0 && !data.error && Object.keys(columnFilters).length === 0 && (
            <div className="engine-list-view__empty">No pending user tasks.</div>
          )}

          {(data.tasks.length > 0 || Object.keys(columnFilters).length > 0) && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table<FlowNodeInstance>
                data={data.tasks}
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
                columnPinning={{ start: ['select'], end: ['actions'] }}
                enableFilters
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                activeRowId={selectedTaskId ?? undefined}
                onRowClick={(row) => model?.selectTask(row)}
                onRowContextMenu={(row, event) => openContextMenuForTask(event, row)}
              />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
