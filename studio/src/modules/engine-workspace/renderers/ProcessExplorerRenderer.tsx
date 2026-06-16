import type { AutoRefreshInterval, EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';
import type { ProcessModel, ProcessModelField, SortClause } from '@elraptorus/daemonengine_sdk';

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
import type { ProcessExplorerDocumentModel } from '../models/ProcessExplorerDocumentModel';
import type { ProcessExplorerContextMetadata } from '../types/ProcessExplorerContext';
import './ProcessExplorerRenderer.scss';

function parseEngineIdFromUri(uri: string): string {
  const match = uri.match(/engine:\/\/processes\/([^/?]+)/);
  return match?.[1] ?? '';
}

export default function ProcessExplorerRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Studio = studio;
  const model = useEditorModel<ProcessExplorerDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  const uriEngineId = parseEngineIdFromUri(editorDocument.uri);
  const engineId = model?.getEngineId() || uriEngineId;
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = {
    models: model?.getModels() ?? [],
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

  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.processExplorerAutoRefresh) ?? '30s';
  const selectedModelId = model?.getSelectedModelId() ?? null;

  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
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

  const [columnFilters, setColumnFilters] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    const nameFilter = model?.getNameFilter();
    if (nameFilter) {
      initial.name = nameFilter;
    }
    const processModelIdFilter = model?.getProcessModelIdFilter();
    if (processModelIdFilter) {
      initial.processModelId = processModelIdFilter;
    }
    const versionFilter = model?.getVersionFilter();
    if (versionFilter) {
      initial.version = versionFilter;
    }
    const deployedAtFilter = model?.getDeployedAtFilter();
    if (deployedAtFilter?.after || deployedAtFilter?.before) {
      initial.deployedAt = deployedAtFilter;
    }
    return initial;
  });

  const handleRowSelectionChange = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(nextSelection);
    const selectedIds = Object.keys(nextSelection).filter((key) => nextSelection[key]);
    model?.setSelectedModelIds(selectedIds);
  };

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(nextSorting);
      const clauses: SortClause<ProcessModelField>[] = nextSorting.map((sort) => ({
        field: (sort.id === 'status' ? 'enabled' : sort.id) as ProcessModelField,
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

      if (columnId === 'name') {
        model?.setNameFilter((value as string) || null);
      } else if (columnId === 'processModelId') {
        model?.setProcessModelIdFilter((value as string) || null);
      } else if (columnId === 'version') {
        model?.setVersionFilter((value as string) || null);
      } else if (columnId === 'status') {
        if (value === true) {
          model?.setEnabledFilter(true);
        } else if (value === false) {
          model?.setEnabledFilter(false);
        } else {
          model?.setEnabledFilter(null);
        }
      } else if (columnId === 'deployedAt') {
        const dateRange = value as { after?: string; before?: string } | undefined;
        model?.setDeployedAtFilter(dateRange?.after ?? null, dateRange?.before ?? null);
      }
    },
    [model],
  );

  const handleRowClick = (processModel: ProcessModel) => {
    model?.selectModel(processModel);
  };

  const [lastSyncedRevision, setLastSyncedRevision] = useState(0);
  const filterRevision: number = (editorDocument.metadata as any)?.filterRevision ?? 0;

  if (filterRevision !== lastSyncedRevision && model) {
    setLastSyncedRevision(filterRevision);
    const synced: Record<string, unknown> = {};
    const nameFilter = model.getNameFilter();
    if (nameFilter) {
      synced.name = nameFilter;
    }
    const processModelIdFilter = model.getProcessModelIdFilter();
    if (processModelIdFilter) {
      synced.processModelId = processModelIdFilter;
    }
    const versionFilter = model.getVersionFilter();
    if (versionFilter) {
      synced.version = versionFilter;
    }
    const deployedAtFilter = model.getDeployedAtFilter();
    if (deployedAtFilter?.after || deployedAtFilter?.before) {
      synced.deployedAt = deployedAtFilter;
    }
    setColumnFilters(synced);
  }

  const openContextMenuForModel = (event: React.MouseEvent, processModel: ProcessModel) => {
    event.preventDefault();
    event.stopPropagation();
    const cellElement = (event.target as HTMLElement).closest<HTMLElement>('[data-test--table-cell]');
    const columnId = cellElement?.getAttribute('data-test--table-cell') ?? undefined;
    let cellValue: string | undefined;
    if (columnId && columnId !== 'select' && columnId !== 'actions') {
      if (columnId === 'processModelId') {
        cellValue = processModel.processModelId ?? processModel.id;
      } else if (columnId === 'name') {
        cellValue = processModel.name ?? undefined;
      } else {
        const raw = (processModel as unknown as Record<string, unknown>)[columnId];
        cellValue = raw != null ? String(raw) : undefined;
      }
    }
    const metadata: ProcessExplorerContextMetadata = { engineId, processModel, columnId, cellValue };
    showContextMenu(event, 'engine-workspace/process-explorer/contextmenu', [metadata, bifrost]);
  };

  const columns: ColumnDef<ProcessModel, any>[] = [
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
          aria-label={`Select ${row.original.name ?? row.original.processModelId ?? row.original.id}`}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      size: 40,
    },
    {
      accessorFn: (row) => row.name ?? '(unnamed)',
      id: 'name',
      header: 'Name',
      enableSorting: true,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorFn: (row) => row.processModelId ?? row.id,
      id: 'processModelId',
      header: 'Process ID',
      cell: (info) => <span className="engine-process-explorer__monospace">{info.getValue<string>()}</span>,
      enableSorting: true,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorFn: (row) => row.version ?? '',
      id: 'version',
      header: 'Version',
      cell: (info) => info.getValue<string>() || '—',
      enableSorting: false,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorFn: (row) => (row.enabled ? 'Enabled' : 'Disabled'),
      id: 'status',
      header: 'Status',
      cell: (info) => {
        const enabled = info.getValue<string>() === 'Enabled';
        return (
          <span
            className={`engine-process-explorer__status ${enabled ? 'engine-process-explorer__status--enabled' : 'engine-process-explorer__status--disabled'}`}
          >
            {info.getValue<string>()}
          </span>
        );
      },
      enableSorting: true,
      meta: { filterVariant: 'boolean' as const },
    },
    {
      accessorKey: 'deployedAt',
      header: 'Deployed',
      cell: (info) => {
        const value = info.getValue<string | undefined>();
        return value ? getHumanizedDateTime(value) : '—';
      },
      enableSorting: false,
      meta: {
        filterVariant: 'date-range' as const,
        filterRangeLabels: { from: 'After', to: 'Before' },
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="engine-process-explorer__actions">
          <button
            type="button"
            className="engine-process-explorer__action-button"
            title={'Start in Debugger\n[Shift+Click] Configured Start'}
            onClick={(event) => {
              event.stopPropagation();
              const processId = row.original.processModelId ?? row.original.id;
              if (event.shiftKey) {
                bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger, [
                  engineId,
                  processId,
                ]);
              } else {
                bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcessAndOpenDebugger, [engineId, processId]);
              }
            }}
          >
            <Icon id="ph ph-play" />
          </button>
          <button
            type="button"
            className="engine-process-explorer__action-button"
            title="Open in Model Viewer"
            onClick={(event) => {
              event.stopPropagation();
              bifrost.commands.executeCommand('engine.workspace.openModelViewer', [
                engineId,
                row.original.processModelId ?? row.original.id,
              ]);
            }}
          >
            <Icon id="ph ph-folder-open" />
          </button>
          <button
            type="button"
            className="engine-process-explorer__action-button"
            title="More actions"
            onClick={(event) => openContextMenuForModel(event, row.original)}
          >
            <Icon id="ph ph-dots-three-vertical" />
          </button>
        </div>
      ),
      size: 104,
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
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-tree-structure" />
          <EditorTitleText
            studio={bifrost}
            label="Processes"
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
            icon="ph ph-toggle-right"
            tooltip="Enable selected processes"
            command="engine.workspace.processExplorer.enableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-prohibit"
            tooltip="Disable selected processes"
            command="engine.workspace.processExplorer.disableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-trash"
            tooltip="Remove selected processes"
            command="engine.workspace.processExplorer.removeSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.workspace.processExplorer.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh Cooldown"
            menuId="engine-workspace/process-explorer/refresh-interval"
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
        <div className="engine-process-explorer" style={{ display: 'flex', flexDirection: 'column' }}>
          {data.error && <div className="engine-process-explorer__error">{data.error}</div>}

          {data.loading && data.models.length === 0 && (
            <div className="engine-process-explorer__loading">Loading processes...</div>
          )}

          {!data.loading && data.models.length === 0 && !data.error && Object.keys(columnFilters).length === 0 && (
            <div className="engine-process-explorer__empty">
              No processes deployed. Right-click a BPMN or DMN file in the File Explorer to deploy it.
            </div>
          )}

          {(data.models.length > 0 || Object.keys(columnFilters).length > 0) && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table<ProcessModel>
                data={data.models}
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
                activeRowId={selectedModelId ?? undefined}
                onRowClick={(row) => handleRowClick(row)}
                onRowContextMenu={(row, event) => openContextMenuForModel(event, row)}
              />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
