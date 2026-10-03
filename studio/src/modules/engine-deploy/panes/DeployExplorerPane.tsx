import type { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { SolutionModelEntry } from '#modules/solution-models/types';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { DeployExplorerMode } from '../analysis/buildDeployExplorerTree';
import { buildDeployExplorerTree } from '../analysis/buildDeployExplorerTree';
import { DEPLOY_EXPLORER_VIEW_ID } from '../commands';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Deploy Explorer',
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader studio={props.studio} title="Deploy Explorer" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const [mode, setMode] = useState<DeployExplorerMode>('file');
  const [entries, setEntries] = useState<SolutionModelEntry[]>([]);
  const [scanRevision, setScanRevision] = useState(0);
  const solution = bifrost.solution.getSolution();

  useEffect(() => {
    let cancelled = false;
    void bifrost.commands
      .executeCommand('solution.models.scan', [])
      .then((scanned: SolutionModelEntry[] | undefined) => {
        if (!cancelled) {
          setEntries(scanned ?? []);
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
      <div className="deploy-explorer__toolbar" role="group" aria-label="Explorer mode">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
          data-test--deploy-explorer-mode="file"
          onClick={() => setMode('file')}
        >
          Files
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'project' ? 'btn-primary' : 'btn-secondary'}`}
          data-test--deploy-explorer-mode="project"
          onClick={() => setMode('project')}
        >
          Folders
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          title="Rescan the solution"
          onClick={() => setScanRevision((revision) => revision + 1)}
        >
          <Icon id="ph ph-arrows-clockwise" />
        </button>
      </div>
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
