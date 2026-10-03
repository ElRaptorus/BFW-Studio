import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import { EditorToolbarTextInput } from '#components/editor/EditorToolbarTextInput';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, EngineContextBreadcrumb, resolveHealthState } from '#modules/engine-core';
import { useEditorModel } from '#modules/engine-workspace/hooks/useEditorModel';

import React, { useMemo, useState } from 'react';

import { DeployPlanFilesTable, buildDeployFileRows, filterDeployFileRows } from '../components/DeployPlanFilesTable';
import { DeployPlanFoldersTable } from '../components/DeployPlanFoldersTable';
import '../engine-deploy.scss';
import type DeployPlanDocumentModel from '../models/DeployPlanDocumentModel';

export default function DeployPlanRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const model = useEditorModel<DeployPlanDocumentModel>(studio, editorDocument);
  const [textFilter, setTextFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, unknown>>({});

  const connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = connectionManager.getActiveEngineId() ?? '';
  const connection = engineId === '' ? undefined : connectionManager.getConnection(engineId);
  const engineUrl = connection?.url ?? '';
  const healthState = resolveHealthState(
    connection?.state === 'connected' ? true : null,
    connectionManager.getHealthOverride(engineId),
  );

  const items = model?.getAnalysis().items ?? [];
  const blockedReason = model?.getDeployBlockedReason() ?? null;
  const folderMode = model?.getExplorerMode() === 'project';
  const includedCount = items.filter((item) => model?.isIncluded(item.uri)).length;
  const revision = model?.getRevision() ?? 0;
  const shownCount = useMemo(
    () => (model == null ? 0 : filterDeployFileRows(buildDeployFileRows(model), columnFilters, textFilter).length),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision stands for the model's content
    [model, revision, columnFilters, textFilter],
  );
  const filtered = !folderMode && shownCount < items.length;
  const missingDependencyCount = model?.getMissingLocalDependencyUris().length ?? 0;
  const handleColumnFilterChange = (columnId: string, value: unknown) =>
    setColumnFilters((current) => {
      const { [columnId]: _previous, ...rest } = current;
      return value == null || value === '' ? rest : { ...rest, [columnId]: value };
    });

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={studio} icon="ph-duotone ph-rocket-launch" />
          <EditorTitleText
            studio={studio}
            label="Deploy Plan"
            sublabel={
              engineId === '' ? (
                'No Engine selected'
              ) : (
                <EngineContextBreadcrumb
                  studio={studio}
                  engineId={engineId}
                  engineDisplayName={connection?.displayName ?? engineId}
                  healthState={healthState}
                />
              )
            }
          />
        </EditorTitleLeft>
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText
            studio={studio}
            label={`${items.length} files · ${includedCount} selected${filtered ? ` · ${shownCount} shown by filter` : ''}`}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-tree-structure"
            tooltip={
              missingDependencyCount > 0
                ? `Add ${missingDependencyCount} missing ${missingDependencyCount === 1 ? 'dependency' : 'dependencies'}`
                : 'Add all missing dependencies'
            }
            command="engine.deploy.addMissingDependencies"
            dataTestId="deploy-add-missing-dependencies"
          />
          <EditorToolbarTextInput
            studio={studio}
            value={textFilter}
            onChange={setTextFilter}
            placeholder={folderMode ? 'Filter folders…' : 'Filter files…'}
            icon="ph ph-magnifying-glass"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-clockwise"
            tooltip="Ask the Engine again"
            command="engine.deploy.refreshPlan"
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={studio}
            tooltip="Settings"
            icon="ph ph-gear"
            command="std.settings.openUserSettings"
          />
          {engineUrl !== '' && (
            <EditorToolbarButton
              studio={studio}
              icon="ph ph-key"
              label={studio.commands.executeCommand(ENGINE_COMMANDS.resolveAuthLabel, [engineUrl])}
              command={ENGINE_COMMANDS.setAuthToken}
              commandArgs={[engineUrl]}
            />
          )}
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-paper-plane-tilt"
            label="Deploy"
            tooltip={blockedReason ?? 'Deploy the selected files'}
            command="engine.deploy.deployPlan"
            dataTestId="deploy-button"
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <div className="deploy-plan__content" data-test--deploy-plan>
          {model == null || items.length === 0 ? (
            <p className="deploy-plan__empty">
              The plan is empty. Choose BPMN and DMN files in the Deploy Explorer and add them with Enter or a double
              click.
            </p>
          ) : (
            <>
              {blockedReason != null && (
                <div className="deploy-plan__notice deploy-plan__notice--blocked" data-test--deploy-blocked-reason>
                  {blockedReason}
                </div>
              )}
              {folderMode ? (
                <DeployPlanFoldersTable model={model} textFilter={textFilter} />
              ) : (
                <DeployPlanFilesTable
                  model={model}
                  textFilter={textFilter}
                  columnFilters={columnFilters}
                  onColumnFilterChange={handleColumnFilterChange}
                />
              )}
            </>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
