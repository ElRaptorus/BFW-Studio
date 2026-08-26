import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Icon } from '#components/Icon';
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
  EngineHealthBadge,
  SETTINGS_KEYS,
  getHumanizedDateTime,
  resolveHealthState,
} from '#modules/engine-core';
import type { EngineHealthState } from '#modules/engine-core';

import React from 'react';

import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { DashboardDocumentModel } from '../models/DashboardDocumentModel';
import './DashboardRenderer.scss';

export default function DashboardRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Bifrost = studio;
  const model = useEditorModel<DashboardDocumentModel>(bifrost, editorDocument);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const refreshCooldown: AutoRefreshInterval = bifrost.settings.get(SETTINGS_KEYS.dashboardAutoRefresh) ?? '30s';

  const engineId = model?.getEngineId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const dashboard = {
    info: model?.getInfo() ?? null,
    stats: model?.getStats() ?? null,
    healthy: model?.isHealthy() ?? null,
    loading: model?.isLoading() ?? true,
    error: model?.getError() ?? null,
    lastUpdated: model?.getLastUpdated() ?? null,
    engineIsOnline: model?.isEngineOnline() ?? true,
    connectionGracePeriodExpired: model?.isConnectionGracePeriodExpired() ?? false,
  };

  const healthOverride = connectionManager.getHealthOverride(engineId);
  const healthState = resolveHealthState(dashboard.healthy, healthOverride);

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-gauge" />
          <EditorTitleText
            studio={bifrost}
            label="Dashboard"
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
            label={dashboard.lastUpdated ? `Updated ${getHumanizedDateTime(dashboard.lastUpdated)}` : ''}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-clockwise"
            tooltip="Refresh dashboard data"
            command="engine.workspace.dashboard.refresh"
            commandArgs={[model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarMenu
            studio={bifrost}
            icon="ph ph-timer"
            label={`Auto Refresh (${refreshCooldown})`}
            tooltip="Auto-refresh Cooldown"
            menuId="engine-workspace/refresh-interval"
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
        {!dashboard.engineIsOnline && !dashboard.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Connection to engine lost. Attempting to reconnect..." />
        )}
        {!dashboard.engineIsOnline && dashboard.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Engine is not reachable." />
        )}
        <div className="engine-dashboard">
          {dashboard.error && (
            <div className="engine-dashboard__error">
              <Icon id="ph ph-warning-circle" />
              <span>{dashboard.error}</span>
            </div>
          )}

          {dashboard.loading && !dashboard.stats && (
            <div className="engine-dashboard__loading">Loading dashboard data...</div>
          )}

          {dashboard.info && (
            <div className="engine-dashboard__cards">
              <EngineStatusHeroCard healthState={healthState} />

              <DashboardCard title="Engine" icon="ph-duotone ph-cpu">
                <InfoRow label="Name" value={dashboard.info.engineName} />
                <InfoRow label="Version" value={dashboard.info.version} />
              </DashboardCard>

              {dashboard.stats && (
                <>
                  <DashboardCard title="Process Instances" icon="ph-duotone ph-flow-arrow">
                    <InfoRow label="Running" value={String(dashboard.stats.processInstances?.running ?? 0)} />
                    <InfoRow label="Finished" value={String(dashboard.stats.processInstances?.finished ?? 0)} />
                    <InfoRow label="Fatal" value={String(dashboard.stats.processInstances?.fatal ?? 0)} />
                    <InfoRow label="Aborted" value={String(dashboard.stats.processInstances?.aborted ?? 0)} />
                  </DashboardCard>

                  <DashboardCard title="Flow Node Instances" icon="ph-duotone ph-activity">
                    <InfoRow label="Active" value={String(dashboard.stats.flowNodeInstances?.active ?? 0)} />
                    <InfoRow label="Finished" value={String(dashboard.stats.flowNodeInstances?.finished ?? 0)} />
                  </DashboardCard>

                  <DashboardCard title="User Tasks" icon="ph-duotone ph-user-check">
                    <InfoRow label="Pending" value={String(dashboard.stats.userTasksPending?.count ?? 0)} />
                  </DashboardCard>

                  <DashboardCard title="Async Flow Nodes" icon="ph-duotone ph-hourglass-medium">
                    <InfoRow label="Waiting" value={String(dashboard.stats.asyncFlowNodes?.waiting ?? 0)} />
                  </DashboardCard>

                  <DashboardCard title="Timers" icon="ph-duotone ph-timer">
                    <InfoRow label="Armed" value={String(dashboard.stats.timers?.armed ?? 0)} />
                    <InfoRow
                      label="Fire in next minute"
                      value={String(dashboard.stats.timers?.fireInNextMinute ?? 0)}
                    />
                  </DashboardCard>

                  <DashboardCard title="Plugins" icon="ph-duotone ph-puzzle-piece">
                    {(dashboard.stats.plugins ?? []).map((plugin) => (
                      <InfoRow key={plugin.name} label={plugin.name} value={plugin.version} />
                    ))}
                    {(dashboard.stats.plugins ?? []).length === 0 && (
                      <span className="engine-dashboard__muted">No plugins loaded</span>
                    )}
                  </DashboardCard>
                </>
              )}
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}

function DashboardCard(props: { title: string; icon: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="engine-dashboard-card">
      <div className="engine-dashboard-card__header">
        <Icon id={props.icon} />
        <span>{props.title}</span>
      </div>
      <div className="engine-dashboard-card__body">{props.children}</div>
    </div>
  );
}

function InfoRow(props: { label: string; value: string | undefined | null }): React.JSX.Element {
  return (
    <div className="engine-dashboard-card__row">
      <span className="engine-dashboard-card__row-label">{props.label}</span>
      <span className="engine-dashboard-card__row-value">{props.value ?? '—'}</span>
    </div>
  );
}

const HERO_DESCRIPTIONS: Record<EngineHealthState, string> = {
  healthy: 'All systems operational.',
  degraded: 'Engine is experiencing elevated load.',
  critical: 'Engine is critically overloaded.',
  unknown: 'Engine health status is unknown.',
};

function EngineStatusHeroCard({ healthState }: { healthState: EngineHealthState }): React.JSX.Element {
  const description = HERO_DESCRIPTIONS[healthState];
  return (
    <div className={`engine-dashboard-hero engine-dashboard-hero--${healthState}`}>
      <EngineHealthBadge healthState={healthState} />
      <span className="engine-dashboard-hero__description">{description}</span>
    </div>
  );
}
