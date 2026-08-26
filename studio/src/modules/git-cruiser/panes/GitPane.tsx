import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeBadge, TreeItem } from '#bifrost/contracts/TreeTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneActionBar, PaneActionButton } from '#components/panes/PaneActionBar';
import { PaneActionSplitButton } from '#components/panes/PaneActionSplitButton';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';
import { PaneInfoBar, PaneInfoBarAction, PaneInfoBarItem } from '#components/panes/PaneInfoBar';
import * as path from 'path';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PaneProperty, type SelectOption } from '@evil/bifrost_fw_sdk';

import type { GitService } from '../GitService';
import type { GitFileStatus, GitRepoState } from '../GitTypes';
import { STATUS_BADGE_MAP, STATUS_COLOR_TOKEN_MAP } from '../GitTypes';
import '../styles/git-cruiser.scss';

const GIT_PANE_VIEW_MEDIATOR_ID = 'git-cruiser/pane-tree';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(
  _editorDocument: EditorDocument,
  _editorDocumentModel: EditorDocumentModel,
  _studio: Bifrost,
): string {
  return 'Source Control';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel, props.studio)}
        className="pane-header--hero"
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        <PaneHeaderIcon
          studio={props.studio}
          icon="ph ph-arrow-clockwise"
          tooltip="Refresh"
          command="git.refreshStatus"
        />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio as Bifrost;
  const gitService = bifrost.commands.executeCommand<GitService>('git.getGitServiceRef');
  const [allStates, setAllStates] = useState<GitRepoState[]>([]);
  const [repoState, setRepoState] = useState<GitRepoState | null>(null);
  const [commitTitle, setCommitTitle] = useState('');
  const [commitBody, setCommitBody] = useState('');
  const [showBody, setShowBody] = useState(false);
  const commitTitleRef = useRef('');
  const commitBodyRef = useRef('');

  useEffect(() => {
    const updateState = () => {
      const states = gitService.getAllRepoStates();
      setAllStates(states);

      const selected = gitService.getSelectedRepo();
      const match = selected ? states.find((state) => state.repoRoot === selected) : null;
      const effective = match ?? states[0] ?? null;
      gitService.setSelectedRepo(effective?.repoRoot ?? null);
      setRepoState(effective);

      setCommitTitle(commitTitleRef.current);
      setCommitBody(commitBodyRef.current);
      if (!commitTitleRef.current && !commitBodyRef.current) {
        setShowBody(false);
      }
    };

    updateState();
    const sub = bifrost.events.on('gitStatusChanged', updateState);
    return () => sub.dispose();
  }, [bifrost, gitService]);

  const repoOptions: SelectOption[] = useMemo(
    () => allStates.map((state) => ({ label: path.basename(state.repoRoot), value: state.repoRoot })),
    [allStates],
  );

  const selectedRepoOption = useMemo(
    () => repoOptions.find((opt) => opt.value === repoState?.repoRoot) ?? undefined,
    [repoOptions, repoState],
  );

  const handleRepoChange = useCallback(
    (option: SelectOption | null) => {
      if (!option || !gitService) {
        return;
      }
      gitService.setSelectedRepo(option.value);
      const match = gitService.getRepoState(option.value);
      setRepoState(match ?? null);
      bifrost.statusBar.updateStatusBarItems();
    },
    [gitService, bifrost],
  );

  const stagedFiles = useMemo(() => {
    if (!repoState) {
      return [];
    }
    return repoState.files.filter((gitFile) => gitFile.indexStatus != null && gitFile.indexStatus !== 'untracked');
  }, [repoState]);

  const unstagedFiles = useMemo(() => {
    if (!repoState) {
      return [];
    }
    return repoState.files.filter(
      (gitFile) =>
        gitFile.workingTreeStatus != null &&
        gitFile.workingTreeStatus !== 'untracked' &&
        gitFile.workingTreeStatus !== 'ignored',
    );
  }, [repoState]);

  const untrackedFiles = useMemo(() => {
    if (!repoState) {
      return [];
    }
    return repoState.files.filter((gitFile) => gitFile.workingTreeStatus === 'untracked');
  }, [repoState]);

  const conflictedFiles = useMemo(() => {
    return repoState?.mergeState.conflictedFiles ?? [];
  }, [repoState]);

  const mergeStateKind = repoState?.mergeState.kind ?? null;

  const handleTreeItemClick = useCallback(
    (metadata: any) => {
      if (!metadata?.uri) {
        return;
      }
      if (metadata.statusCode === 'deleted') {
        bifrost.notifications.open({
          type: 'info',
          content: `This file has been deleted. Use "Revert Changes" to restore it.`,
          source: 'Git Cruiser',
        });
        return;
      }
      bifrost.editors.focusOrOpenEditorDocument(metadata.uri);
    },
    [bifrost],
  );

  const handleActionIconClick = useCallback(
    (data: any) => {
      const meta = data.metadata;
      if (!meta || !gitService) {
        return;
      }

      if (data.actionId === 'open-resolver') {
        bifrost.commands.executeCommand('git.merge.openResolver');
      } else if (data.actionId === 'accept-ours') {
        bifrost.commands.executeCommand('git.merge.paneAcceptOurs', [meta.path, meta.repoRoot]);
      } else if (data.actionId === 'accept-theirs') {
        bifrost.commands.executeCommand('git.merge.paneAcceptTheirs', [meta.path, meta.repoRoot]);
      } else if (data.actionId === 'revert') {
        bifrost.commands.executeCommand('git.revert', [meta.path, meta.repoRoot]);
      } else if (meta.statusKey === 'indexStatus') {
        gitService.unstage(meta.repoRoot, [meta.path]);
      } else {
        gitService.stage(meta.repoRoot, [meta.path]);
      }
    },
    [bifrost, gitService],
  );

  if (!gitService || !gitService.isEnabled) {
    return (
      <div className="git-pane__empty" data-test--git-pane-disabled>
        <p>Git integration is disabled.</p>
        <p className="git-pane__empty-hint">Enable it in Settings → Git Cruiser → Enabled.</p>
      </div>
    );
  }

  if (!gitService.isGitAvailable) {
    return (
      <div className="git-pane__empty" data-test--git-pane-no-git>
        <p>Git was not found on this system.</p>
        <p className="git-pane__empty-hint">
          Install Git and restart, or run &quot;Git: Refresh Status&quot; from the command search.
        </p>
      </div>
    );
  }

  if (!repoState) {
    return (
      <div className="git-pane__empty" data-test--git-pane-no-repo>
        <p>No Git repository detected in the current solution.</p>
        <div className="git-pane__empty-actions">
          <a
            className="git-pane__empty-action"
            data-test--git-pane-clone-repository
            onClick={() => bifrost.commands.executeCommand('git.cloneRepository')}
          >
            Clone Repository
          </a>
          <a
            className="git-pane__empty-action"
            data-test--git-pane-connect-to-remote
            onClick={() => bifrost.commands.executeCommand('git.connectFolderToRemote')}
          >
            Connect Folder to Remote
          </a>
        </div>
      </div>
    );
  }

  function buildFileItem(file: GitFileStatus, statusKey: 'indexStatus' | 'workingTreeStatus'): TreeItem {
    const status = file[statusKey];
    const effectiveStatus = status ?? file.workingTreeStatus ?? file.indexStatus;
    const color = effectiveStatus ? STATUS_COLOR_TOKEN_MAP[effectiveStatus] : 'var(--theme-git-ignored)';
    const badgeChar = effectiveStatus ? STATUS_BADGE_MAP[effectiveStatus] : null;

    const badges: TreeBadge[] = [];
    if (badgeChar) {
      badges.push({ type: 'character', character: badgeChar });
    }

    const isStaged = statusKey === 'indexStatus';
    const isUntracked = effectiveStatus === 'untracked';

    const actionIcons: { icon: string; tooltip: string; id: string }[] = [];
    if (!isUntracked && !isStaged) {
      actionIcons.push({ icon: 'ph ph-arrow-counter-clockwise', tooltip: 'Revert Changes', id: 'revert' });
    }
    actionIcons.push({
      icon: isStaged ? 'ph ph-minus-circle' : 'ph ph-plus-circle',
      tooltip: isStaged ? 'Unstage' : 'Stage',
      id: 'stage',
    });

    return {
      type: 'file',
      label: file.path.split('/').pop() ?? file.path,
      sublabel: file.path,
      labelTooltip: file.path,
      pathId: `${statusKey}:${file.path}`,
      metadata: {
        uri: file.uri,
        path: file.path,
        repoRoot: repoState!.repoRoot,
        statusKey,
        statusCode: file[statusKey],
      },
      menuId: 'git-cruiser/pane-file',
      styles: { labelColor: color, badgeColor: color },
      badges,
      actionIconsOnHover: actionIcons,
    };
  }

  const branchLabel = repoState.branch.detached ? `(${repoState.branch.current})` : repoState.branch.current;
  const hasTracking = repoState.branch.tracking != null;
  const syncLabel = hasTracking ? `↑${repoState.branch.ahead} ↓${repoState.branch.behind}` : '';
  const syncTooltip = hasTracking
    ? `Sync: ${repoState.branch.ahead} ahead, ${repoState.branch.behind} behind\nTracking: ${repoState.branch.tracking}`
    : '';
  const hasAnyChanges = repoState.files.length > 0;

  const treeData: TreeItem[] = [];

  if (conflictedFiles.length > 0) {
    treeData.push({
      type: 'section',
      label: 'Merge Conflicts',
      pathId: 'section/conflicts',
      expanded: true,
      badges: [{ type: 'number', number: conflictedFiles.length }],
      entries: conflictedFiles.map((gitFile) => {
        const isBpmn = gitFile.path.endsWith('.bpmn');
        const isDmn = gitFile.path.endsWith('.dmn');
        const isDiagram = isBpmn || isDmn;
        const color = STATUS_COLOR_TOKEN_MAP['conflicted'];

        const actionIcons: { icon: string; tooltip: string; id: string }[] = [];
        if (isDiagram) {
          actionIcons.push({ icon: 'ph ph-git-merge', tooltip: 'Open Merge Resolver', id: 'open-resolver' });
        }
        actionIcons.push({ icon: 'ph ph-check', tooltip: 'Accept Ours', id: 'accept-ours' });
        actionIcons.push({ icon: 'ph ph-check-fat', tooltip: 'Accept Theirs', id: 'accept-theirs' });

        return {
          type: 'file' as const,
          label: gitFile.path.split('/').pop() ?? gitFile.path,
          sublabel: gitFile.path,
          labelTooltip: gitFile.path,
          pathId: `conflict:${gitFile.path}`,
          metadata: {
            uri: gitFile.uri,
            path: gitFile.path,
            repoRoot: repoState!.repoRoot,
            statusKey: 'conflicted',
            statusCode: 'conflicted',
            isBpmn,
            isDmn,
          },
          menuId: 'git-cruiser/pane-file',
          styles: { labelColor: color, badgeColor: color },
          badges: [{ type: 'character' as const, character: 'C' }],
          actionIconsOnHover: actionIcons,
        };
      }),
    });
  }

  if (stagedFiles.length > 0) {
    treeData.push({
      type: 'section',
      label: `Staged Changes`,
      pathId: 'section/staged',
      expanded: true,
      badges: [{ type: 'number', number: stagedFiles.length }],
      entries: stagedFiles.map((gitFile) => buildFileItem(gitFile, 'indexStatus')),
    });
  }

  if (unstagedFiles.length > 0) {
    treeData.push({
      type: 'section',
      label: `Changes`,
      pathId: 'section/unstaged',
      expanded: true,
      badges: [{ type: 'number', number: unstagedFiles.length }],
      entries: unstagedFiles.map((gitFile) => buildFileItem(gitFile, 'workingTreeStatus')),
    });
  }

  if (untrackedFiles.length > 0) {
    treeData.push({
      type: 'section',
      label: `Untracked`,
      pathId: 'section/untracked',
      expanded: true,
      badges: [{ type: 'number', number: untrackedFiles.length }],
      entries: untrackedFiles.map((gitFile) => buildFileItem(gitFile, 'workingTreeStatus')),
    });
  }

  const canCommit = commitTitle.trim().length > 0 && stagedFiles.length > 0;

  return (
    <div className="git-pane" data-test--git-pane>
      {allStates.length > 1 && (
        <PaneProperty
          type="select"
          options={repoOptions}
          value={selectedRepoOption}
          onChange={handleRepoChange}
          className="git-pane__repo-selector"
        />
      )}
      {allStates.length === 1 && <div className="git-pane__repo-label">{path.basename(allStates[0].repoRoot)}</div>}

      <PaneInfoBar data-test--git-pane-header>
        <PaneInfoBarItem icon="ph ph-git-branch" label={branchLabel} />
        {syncLabel && <PaneInfoBarItem label={syncLabel} tooltip={syncTooltip} />}
        <PaneInfoBarAction
          studio={bifrost}
          icon="ph ph-tray-arrow-down"
          tooltip="Stash All Changes"
          command="git.stash"
          commandArgs={[repoState.repoRoot]}
          visible={hasAnyChanges}
        />
        <PaneInfoBarAction
          studio={bifrost}
          icon="ph ph-tray-arrow-up"
          tooltip="Apply Stash"
          command="git.stashApply"
          commandArgs={[repoState.repoRoot]}
          visible={repoState.hasStash}
        />
        {mergeStateKind != null && (
          <>
            <PaneInfoBarAction
              studio={bifrost}
              icon="ph ph-x-circle"
              tooltip={`Abort ${mergeStateKind}`}
              command="git.merge.abort"
            />
            {conflictedFiles.length === 0 && (
              <PaneInfoBarAction
                studio={bifrost}
                icon="ph ph-check-circle"
                tooltip={`Continue ${mergeStateKind}`}
                command="git.merge.continue"
              />
            )}
          </>
        )}
      </PaneInfoBar>

      <div className="git-pane__commit-area" data-test--git-pane-commit>
        <PaneProperty
          type="text"
          placeholder="Commit title..."
          value={commitTitle}
          onChange={setCommitTitle}
          valueRef={commitTitleRef}
          className="git-pane__commit-title-wrapper"
        />
        {showBody && (
          <PaneProperty
            type="textarea"
            placeholder="Commit body (optional)..."
            value={commitBody}
            onChange={setCommitBody}
            valueRef={commitBodyRef}
            rows={3}
            className="git-pane__commit-body-wrapper"
          />
        )}
        <PaneActionBar>
          <PaneActionButton
            variant="ghost"
            icon="ph ph-text-aa"
            tooltip="Add commit body"
            onClick={() => setShowBody(!showBody)}
          />
          <PaneActionSplitButton
            studio={bifrost}
            variant="primary"
            icon="ph ph-check"
            label="Commit"
            onClick={() => bifrost.commands.executeCommand('git.pane.commit', [commitTitleRef, commitBodyRef])}
            disabled={!canCommit}
            menuId="git-cruiser/pane-commit-actions"
            menuArgs={[commitTitleRef, commitBodyRef]}
          />
        </PaneActionBar>
      </div>

      <PaneBody>
        {treeData.length === 0 ? (
          <div className="git-pane__empty">
            <p>No changes detected.</p>
          </div>
        ) : (
          <Tree
            studio={bifrost}
            viewMediatorId={GIT_PANE_VIEW_MEDIATOR_ID}
            entries={treeData}
            onClick={handleTreeItemClick}
            onActionIconClick={handleActionIconClick}
            iconComponent={Icon}
          />
        )}
      </PaneBody>
    </div>
  );
}
