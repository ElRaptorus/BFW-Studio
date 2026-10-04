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
import { EditorToolbarMenu } from '#components/editor/EditorToolbarMenu';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import { EditorToolbarTextInput } from '#components/editor/EditorToolbarTextInput';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, EngineContextBreadcrumb, resolveHealthState } from '#modules/engine-core';
import { useEditorModel } from '#modules/engine-workspace/hooks/useEditorModel';

import React, { useMemo, useState } from 'react';

import { DEPLOY_PACKAGES_MENU_ID } from '../commands';
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
          <div className="form-check form-switch deploy-plan__group-switch">
            <input
              id="deploy-group-by-folders"
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={folderMode}
              data-test--deploy-group-by-folders
              onChange={(event) =>
                void studio.commands.executeCommand('engine.deploy.setExplorerMode', [
                  event.target.checked ? 'project' : 'file',
                ])
              }
            />
            <label htmlFor="deploy-group-by-folders">Project View</label>
          </div>
          <EditorToolbarText
            studio={studio}
            tooltip="Checked entries are sent to the Engine by Deploy. Unchecked entries stay in the plan but are skipped."
            label={`${items.length} files · ${includedCount} selected for deployment${filtered ? ` · ${shownCount} shown by filter` : ''}`}
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
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-minus-square"
            tooltip="Remove the selected files from the plan (files and Engine stay untouched)"
            command="engine.deploy.removeSelectedFromPlan"
            dataTestId="deploy-remove-selected"
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
            icon="ph ph-broom"
            tooltip="Reset the plan (remove all files)"
            command="engine.deploy.resetPlan"
            dataTestId="deploy-reset-plan"
          />
          <EditorToolbarMenu
            studio={studio}
            icon="ph ph-package"
            tooltip="Deploy packages"
            menuId={DEPLOY_PACKAGES_MENU_ID}
          />
          <EditorToolbarButton
            studio={studio}
            tooltip="Settings"
            icon="ph ph-gear"
            command="std.settings.openUserSettingsAtCategory"
            commandArgs={['Deploy']}
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
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-question"
            tooltip="What is Deploy?"
            command="std.help.openToTheSide"
            commandArgs={['deploy/plan']}
            dataTestId="deploy-help"
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
