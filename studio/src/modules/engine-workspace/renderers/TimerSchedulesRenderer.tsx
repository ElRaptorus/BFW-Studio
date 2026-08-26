import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { Icon } from '#components/Icon';
import { type RowSelectionState, type SortingState, Table, type TableColumnDef } from '#components/Table';
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
import { EditorToolbarTextInput } from '#components/editor/EditorToolbarTextInput';
import type { AutoRefreshInterval, EngineConnectionManager } from '#modules/engine-core';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';

import React, { useState } from 'react';

import type { TimerSchedule } from '../helpers/engineApi';
import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { TimerSchedulesDocumentModel } from '../models/TimerSchedulesDocumentModel';
import type { TimerSchedulesContextMetadata } from '../types/TimerSchedulesContext';
import './EngineListView.scss';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TimerSchedulesRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Bifrost = studio;
  const model = useEditorModel<TimerSchedulesDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = model?.getEngineId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = {
    schedules: model?.getSchedules() ?? [],
    loading: model?.isLoading() ?? true,
    error: model?.getError() ?? null,
    lastUpdated: model?.getLastUpdated() ?? null,
    engineIsOnline: model?.isEngineOnline() ?? true,
    connectionGracePeriodExpired: model?.isConnectionGracePeriodExpired() ?? false,
  };

  const selectedScheduleId = model?.getSelectedScheduleId() ?? null;
  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.timerSchedulesAutoRefresh) ?? '30s';
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, unknown>>({});

  const handleRowSelectionChange = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(nextSelection);
    const selectedIds = Object.keys(nextSelection).filter((key) => nextSelection[key]);
    model?.setSelectedScheduleIds(selectedIds);
  };

  const handleColumnFilterChange = (columnId: string, value: unknown) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value == null || value === '') {
        delete next[columnId];
      } else {
        next[columnId] = value;
      }
      return next;
    });
  };

  const [lastSyncedRevision, setLastSyncedRevision] = useState(0);
  const filterRevision: number = (editorDocument.metadata as any)?.filterRevision ?? 0;

  if (filterRevision !== lastSyncedRevision) {
    setLastSyncedRevision(filterRevision);
    const appliedFilter = model?.getAppliedFilter();
    if (appliedFilter?.columnId && appliedFilter?.value) {
      setColumnFilters((prev) => ({
        ...prev,
        [appliedFilter.columnId]: appliedFilter.value,
      }));
    }
  }

  const openContextMenuForSchedule = (event: React.MouseEvent, schedule: TimerSchedule) => {
    event.preventDefault();
    event.stopPropagation();
    const cellElement = (event.target as HTMLElement).closest<HTMLElement>('[data-test--table-cell]');
    const columnId = cellElement?.getAttribute('data-test--table-cell') ?? undefined;
    let cellValue: string | undefined;
    if (columnId && columnId !== 'select' && columnId !== 'actions') {
      const raw = (schedule as unknown as Record<string, unknown>)[columnId];
      cellValue = raw != null ? String(raw) : undefined;
    }
    const metadata: TimerSchedulesContextMetadata = { engineId, schedule, columnId, cellValue };
    showContextMenu(event, 'engine-workspace/timer-schedules/contextmenu', [metadata, bifrost]);
  };

  const columns: TableColumnDef<TimerSchedule, any>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected()}
          ref={(input) => {
            if (input) {
              input.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
            }
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
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
      accessorKey: 'processModelId',
      header: 'Process',
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'flowNodeId',
      header: 'Start Event',
      cell: (info) => <span className="engine-list-view__monospace">{info.getValue<string>()}</span>,
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'kind',
      header: 'Kind',
      meta: { filterVariant: 'text' as const },
    },
    {
      accessorKey: 'isoSpec',
      header: 'Expression',
      cell: (info) => <span className="engine-list-view__monospace">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'nextFireAt',
      header: 'Next fire',
      cell: (info) => {
        const value = info.getValue<string | null>();
        return value ? getHumanizedDateTime(value) : '—';
      },
    },
    {
      accessorFn: (row) => (row.enabled ? 'Enabled' : 'Disabled'),
      id: 'status',
      header: 'Status',
      meta: {
        filterVariant: 'multi-select' as const,
        filterOptions: [
          { value: 'Enabled', label: 'Enabled' },
          { value: 'Disabled', label: 'Disabled' },
        ],
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
            title="Open process in Model Viewer"
            onClick={(event) => {
              event.stopPropagation();
              bifrost.commands.executeCommand('engine.workspace.openModelViewer', [
                engineId,
                row.original.processModelId,
              ]);
            }}
          >
            <Icon id="ph ph-flow-arrow" />
          </button>
          <button
            type="button"
            className="engine-list-view__action-button"
            title="More actions"
            onClick={(event) => openContextMenuForSchedule(event, row.original)}
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
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-timer" />
          <EditorTitleText
            studio={bifrost}
            label="Timers"
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
            icon="ph ph-check-circle"
            tooltip="Enable selected schedules"
            command="engine.workspace.timerSchedules.enableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-prohibit"
            tooltip="Disable selected schedules"
            command="engine.workspace.timerSchedules.disableSelected"
            commandArgs={[model]}
          />
          <EditorToolbarTextInput
            studio={bifrost}
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder="Filter schedules..."
            icon="ph ph-magnifying-glass"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.workspace.timerSchedules.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh interval"
            menuId="engine-workspace/timer-schedules/refresh-interval"
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
          {data.loading && data.schedules.length === 0 && (
            <div className="engine-list-view__loading">Loading timer schedules...</div>
          )}
          {!data.loading && data.schedules.length === 0 && !data.error && (
            <div className="engine-list-view__empty">No timer schedules found.</div>
          )}

          {data.schedules.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Table<TimerSchedule>
                data={data.schedules}
                columns={columns}
                getRowId={(row) => row.id}
                sorting={sorting}
                onSortingChange={setSorting}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                initialPageSize={50}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                rowSelection={rowSelection}
                onRowSelectionChange={handleRowSelectionChange}
                enableRowSelection
                columnPinning={{ start: ['select'], end: ['actions'] }}
                enableFilters
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                activeRowId={selectedScheduleId ?? undefined}
                onRowClick={(row) => model?.selectSchedule(row)}
                onRowContextMenu={(row, event) => openContextMenuForSchedule(event, row)}
              />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
