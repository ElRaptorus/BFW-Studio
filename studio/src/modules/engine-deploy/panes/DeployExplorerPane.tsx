import { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { DeployExplorerMode } from '../analysis/buildDeployExplorerTree';
import { buildDeployExplorerTree } from '../analysis/buildDeployExplorerTree';
import type { SolutionModelEntry } from '../analysis/scanSolutionModels';
import { scanSolutionModels } from '../analysis/scanSolutionModels';
import { DEPLOY_EXPLORER_VIEW_ID, getPlanModelIfPresent, onExplorerRescanRequested } from '../commands';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

/** Like the File Explorer, the pane is titled with the name of the opened folder or solution. */
function getPaneTitle(
  _editorDocument: EditorDocument,
  _editorDocumentModel: EditorDocumentModel,
  studio: Bifrost,
): string {
  return Bifrost.cast(studio).fileExplorerView.getViewData().solution?.label ?? 'Deploy Explorer';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel, props.studio)}
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        {props.collapsed !== true && (
          <>
            <PaneHeaderIcon
              studio={props.studio}
              icon="ph ph-arrows-clockwise"
              tooltip="Rescan the solution"
              command="engine.deploy.rescanExplorer"
              dataTestId="deploy-explorer-rescan"
            />
          </>
        )}
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const planModel = getPlanModelIfPresent(bifrost);
  const mode: DeployExplorerMode = planModel?.getExplorerMode() ?? 'file';
  const [entries, setEntries] = useState<SolutionModelEntry[]>([]);
  const [scanRevision, setScanRevision] = useState(0);
  useEffect(() => {
    const subscription = onExplorerRescanRequested(() => setScanRevision((revision) => revision + 1));
    return () => subscription.dispose();
  }, []);
  const solution = bifrost.solution.getSolution();

  useEffect(() => {
    let cancelled = false;
    void scanSolutionModels(bifrost).then((scanned) => {
      if (!cancelled) {
        setEntries(scanned);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bifrost, solution, scanRevision]);

  const treeEntries = useMemo(
    () =>
      buildDeployExplorerTree(
        entries,
        (solution?.projects ?? []).map((project) => ({ name: project.name, uri: project.baseUri })),
        mode,
      ),
    [entries, solution, mode],
  );

  const onClick = useCallback((): void => undefined, []);
  const onDoubleClick = useCallback(
    (metadata: { modelUris?: string[] }): void => {
      if (metadata?.modelUris != null && metadata.modelUris.length > 0) {
        void bifrost.commands.executeCommand('engine.deploy.addToPlan', [metadata.modelUris]);
      }
    },
    [bifrost],
  );

  return (
    <div className="deploy-explorer">
      {solution == null ? (
        <p className="deploy-explorer__empty">Open a solution to choose files to deploy.</p>
      ) : (
        <div className="pane__content pane__content--treeview pane__content--scroll-vertically">
          <Tree
            studio={bifrost}
            viewMediatorId={DEPLOY_EXPLORER_VIEW_ID}
            className="kbm-deploy-explorer"
            entries={treeEntries}
            iconComponent={Icon}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            multiSelectionMenuId="engine/deploy-explorer/multi-selection"
          />
        </div>
      )}
    </div>
  );
}
