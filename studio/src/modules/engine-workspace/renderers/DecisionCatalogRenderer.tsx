import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { Icon } from '#components/Icon';
import {
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  Table,
  type TableColumnDef,
} from '#components/Table';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingErrorHint } from '#components/editor/EditorLoadingErrorHint';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarMenu } from '#components/editor/EditorToolbarMenu';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import type { AutoRefreshInterval, EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';
import type { DecisionDefinition, DecisionDefinitionField, SortClause } from '@elraptorus/daemonengine_sdk';

import React, { useCallback, useMemo, useState } from 'react';

import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { DecisionCatalogDocumentModel } from '../models/DecisionCatalogDocumentModel';
import type { DecisionCatalogContextMetadata } from '../types/DecisionCatalogContext';
import './DecisionCatalogRenderer.scss';

function parseEngineIdFromDecisionUri(uri: string): string {
  const match = uri.match(/engine:\/\/decisions\/([^/?]+)/);
  return match?.[1] ?? '';
}

export default function DecisionCatalogRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Bifrost = studio;
  const model = useEditorModel<DecisionCatalogDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const uriEngineId = parseEngineIdFromDecisionUri(editorDocument.uri);
  const engineId = model?.getEngineId() || uriEngineId;
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = {
    decisions: model?.getDecisions() ?? [],
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

  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.decisionCatalogAutoRefresh) ?? '30s';

  const selectedDecisionId = model?.getSelectedDecisionId() ?? null;

  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
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
    model?.setSelectedDecisionIds(selectedIds);
  };

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(nextSorting);
      const clauses: SortClause<DecisionDefinitionField>[] = nextSorting.map((sort) => ({
        field: (sort.id === 'status' ? 'enabled' : sort.id) as DecisionDefinitionField,
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
      } else if (columnId === 'decisionDefinitionId') {
        model?.setDecisionDefinitionIdFilter((value as string) || null);
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
      }
    },
    [model],
  );

  const handleRowClick = (decision: DecisionDefinition) => {
    model?.selectDecision(decision);
  };

  const handleRowDoubleClick = (decision: DecisionDefinition) => {
    bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [
      engineId,
      decision.decisionDefinitionId ?? decision.id,
    ]);
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
    const dmnIdFilter = model.getDecisionDefinitionIdFilter();
    if (dmnIdFilter) {
      synced.decisionDefinitionId = dmnIdFilter;
    }
    const versionFilter = model.getVersionFilter();
    if (versionFilter) {
      synced.version = versionFilter;
    }
    setColumnFilters(synced);
  }

  const openContextMenuForDecision = (event: React.MouseEvent, decision: DecisionDefinition) => {
    event.preventDefault();
    event.stopPropagation();
    const cellElement = (event.target as HTMLElement).closest<HTMLElement>('[data-test--table-cell]');
    const columnId = cellElement?.getAttribute('data-test--table-cell') ?? undefined;
    let cellValue: string | undefined;
    if (columnId && columnId !== 'select' && columnId !== 'actions') {
      if (columnId === 'decisionDefinitionId') {
        cellValue = decision.decisionDefinitionId ?? decision.id;
      } else if (columnId === 'name') {
        cellValue = decision.name ?? decision.decisionDefinitionId ?? decision.id;
      } else {
        const raw = (decision as unknown as Record<string, unknown>)[columnId];
        cellValue = raw != null ? String(raw) : undefined;
      }
    }
    const metadata: DecisionCatalogContextMetadata = { engineId, decision, columnId, cellValue };
    showContextMenu(event, 'engine-workspace/decision-catalog/contextmenu', [metadata, bifrost]);
  };

  const columns: TableColumnDef<DecisionDefinition, any>[] = [
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
          aria-label={`Select ${row.original.name ?? row.original.decisionDefinitionId ?? row.original.id}`}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      size: 40,
    },
    {
      accessorFn: (row) => row.name ?? row.decisionDefinitionId ?? row.id,
      id: 'name',
      header: 'Name',
      enableSorting: true,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorFn: (row) => row.decisionDefinitionId ?? row.id,
      id: 'decisionDefinitionId',
      header: 'Model ID',
      cell: (info) => <span className="engine-decision-catalog__monospace">{info.getValue<string>()}</span>,
      enableSorting: true,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: (info) => info.getValue<string>() ?? '—',
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
            className={`engine-decision-catalog__status ${enabled ? 'engine-decision-catalog__status--enabled' : 'engine-decision-catalog__status--disabled'}`}
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
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="engine-decision-catalog__actions">
          <button
            type="button"
            className="engine-decision-catalog__action-button"
            title="Open in Decision Viewer"
            onClick={(event) => {
              event.stopPropagation();
              bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [
                engineId,
                row.original.decisionDefinitionId ?? row.original.id,
              ]);
            }}
          >
            <Icon id="ph ph-folder-open" />
          </button>
          <button
            type="button"
            className="engine-decision-catalog__action-button"
            title="More actions"
            onClick={(event) => openContextMenuForDecision(event, row.original)}
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
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-scales" />
          <EditorTitleText
            studio={bifrost}
            label="Decisions"
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
            tooltip="Enable selected decisions"
            command="engine.workspace.decisionCatalog.enableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-prohibit"
            tooltip="Disable selected decisions"
            command="engine.workspace.decisionCatalog.disableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-trash"
            tooltip="Remove selected decisions"
            command="engine.workspace.decisionCatalog.removeSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.workspace.decisionCatalog.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh Cooldown"
            menuId="engine-workspace/decision-catalog/refresh-interval"
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
        <div className="engine-decision-catalog" style={{ display: 'flex', flexDirection: 'column' }}>
          {data.error && <div className="engine-decision-catalog__error">{data.error}</div>}

          {data.loading && data.decisions.length === 0 && (
            <div className="engine-decision-catalog__loading">Loading decisions...</div>
          )}

          {!data.loading && data.decisions.length === 0 && !data.error && Object.keys(columnFilters).length === 0 && (
            <div className="engine-decision-catalog__empty">
              No decision definitions deployed. Right-click a DMN file in the File Explorer to deploy it.
            </div>
          )}

          {(data.decisions.length > 0 || Object.keys(columnFilters).length > 0) && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table<DecisionDefinition>
                data={data.decisions}
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
                activeRowId={selectedDecisionId ?? undefined}
                onRowClick={(row) => handleRowClick(row)}
                onRowDoubleClick={(row) => handleRowDoubleClick(row)}
                onRowContextMenu={(row, event) => openContextMenuForDecision(event, row)}
              />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
