import type { Bifrost } from '#bifrost/Bifrost';
import type { SourceControlMergeStateKind } from '#bifrost/contracts/SourceControlTypes';
import * as path from 'path';

import type { RepositoryStore } from '../RepositoryStore';

function getMergeKindLabel(kind: SourceControlMergeStateKind): string {
  switch (kind) {
    case 'merge':
      return 'MERGING';
    case 'rebase':
      return 'REBASING';
    case 'cherry-pick':
      return 'CHERRY-PICKING';
    default:
      return '';
  }
}

export function initializeStatusBar(bifrost: Bifrost, repositoryStore: RepositoryStore): void {
  bifrost.statusBar.registerStatusBarItem(
    'left',
    'git-cruiser/not-found',
    () => {
      if (!repositoryStore.isEnabled || repositoryStore.isGitAvailable) {
        return [];
      }

      return [
        {
          type: 'button',
          id: 'git-cruiser/not-found',
          tooltip: 'Git is not installed or not in PATH',
          content: [
            { type: 'icon', icon: 'git-cruiser/git-not-found' },
            { type: 'text', label: 'Git not found' },
          ],
          command: 'git.showGitNotFoundInfo',
        },
      ];
    },
    100,
  );

  bifrost.statusBar.registerStatusBarItem(
    'left',
    'git-cruiser/branch',
    () => {
      if (!repositoryStore.isEnabled) {
        return [];
      }

      if (!repositoryStore.isGitAvailable) {
        return [];
      }

      const states = repositoryStore.getAllRepoStates();

      if (states.length === 0) {
        return [
          {
            type: 'button',
            id: 'git-cruiser/branch',
            tooltip: 'No Git repository detected in the current solution',
            content: [
              { type: 'icon', icon: 'git-cruiser/branch' },
              { type: 'text', label: 'Git Cruiser ready' },
            ],
            command: 'git.refreshStatus',
          },
        ];
      }

      const focusedUri = bifrost.editors.getFocusedEditorDocument()?.uri;
      const editorRepoRoot = focusedUri ? repositoryStore.getRepoRootForUri(focusedUri) : null;
      const editorState = editorRepoRoot ? repositoryStore.getRepoState(editorRepoRoot) : null;
      const paneState = repositoryStore.hasSelectedRepo()
        ? repositoryStore.getRepoState(repositoryStore.getSelectedRepo() as string)
        : null;
      const state = editorState ?? paneState ?? states[0];

      const branchLabel = state.branch.detached ? `(${state.branch.current})` : state.branch.current;
      const repoName = path.basename(state.repositoryRoot);
      const hasDirtyFiles = state.files.some(
        (gitFile) => gitFile.indexStatus != null || gitFile.workingTreeStatus != null,
      );
      const dirtyMarker = hasDirtyFiles ? '*' : '';

      let mergeStateSuffix = '';
      const mergeKind = state.mergeState.kind;
      if (mergeKind != null) {
        const conflictCount = state.mergeState.conflictedFiles.length;
        const kindLabel = getMergeKindLabel(mergeKind);
        mergeStateSuffix =
          conflictCount > 0
            ? ` | ${kindLabel} (${conflictCount} conflict${conflictCount !== 1 ? 's' : ''})`
            : ` | ${kindLabel}`;
      }

      const displayLabel = `${repoName}: ${branchLabel}${dirtyMarker}${mergeStateSuffix}`;

      const tooltipLines: string[] = [];
      for (const repoState of states) {
        const name = path.basename(repoState.repositoryRoot);
        const branch = repoState.branch.detached ? `(${repoState.branch.current})` : repoState.branch.current;
        const dirty = repoState.files.some((file) => file.indexStatus != null || file.workingTreeStatus != null)
          ? '*'
          : '';
        let line = `${name}: ${branch}${dirty}`;
        if (repoState.branch.tracking) {
          line += ` (↑${repoState.branch.ahead} ↓${repoState.branch.behind})`;
        }
        if (repoState.mergeState.kind != null) {
          line += ` [${repoState.mergeState.kind.toUpperCase()}]`;
        }
        tooltipLines.push(line);
      }

      const branchCommand = mergeKind != null ? 'git.merge.openResolver' : 'git.switchBranch';
      const branchCommandArgs = mergeKind != null ? [] : [state.repositoryRoot];

      return [
        {
          type: 'button',
          id: 'git-cruiser/branch',
          tooltip: tooltipLines.join('\n'),
          content: [
            { type: 'icon', icon: mergeKind != null ? 'ph ph-git-merge' : 'git-cruiser/branch' },
            { type: 'text', label: displayLabel },
          ],
          command: branchCommand,
          commandArgs: branchCommandArgs,
        },
      ];
    },
    100,
  );

  bifrost.statusBar.registerStatusBarItem(
    'left',
    'git-cruiser/sync',
    () => {
      if (!repositoryStore.isActive) {
        return [];
      }

      const states = repositoryStore.getAllRepoStates();
      if (states.length === 0) {
        return [];
      }

      const trackingStates = states.filter((repoState) => repoState.branch.tracking != null);
      if (trackingStates.length === 0) {
        return [];
      }

      const focusedUri = bifrost.editors.getFocusedEditorDocument()?.uri;
      const editorRepoRoot = focusedUri ? repositoryStore.getRepoRootForUri(focusedUri) : null;
      const editorTracking = editorRepoRoot
        ? trackingStates.find((repoState) => repoState.repositoryRoot === editorRepoRoot)
        : null;

      const paneTracking = repositoryStore.hasSelectedRepo()
        ? trackingStates.find((repoState) => repoState.repositoryRoot === repositoryStore.getSelectedRepo())
        : null;

      const primary = editorTracking ?? paneTracking ?? trackingStates[0];

      const ahead = primary.branch.ahead;
      const behind = primary.branch.behind;

      let label: string;
      if (ahead === 0 && behind === 0) {
        label = '✓';
      } else {
        const parts: string[] = [];
        if (ahead > 0) {
          parts.push(`↑${ahead}`);
        }
        if (behind > 0) {
          parts.push(`↓${behind}`);
        }
        label = parts.join(' ');
      }

      const syncTooltipLines = trackingStates.map((repoState) => {
        const name = path.basename(repoState.repositoryRoot);
        return `${name}: ↑${repoState.branch.ahead} ↓${repoState.branch.behind}`;
      });

      return [
        {
          type: 'button',
          id: 'git-cruiser/sync',
          tooltip: syncTooltipLines.join('\n'),
          content: [
            { type: 'icon', icon: repositoryStore.isSyncing ? 'git-cruiser/sync-spinning' : 'git-cruiser/sync' },
            { type: 'text', label },
          ],
          command: 'git.sync',
          commandArgs: [primary.repositoryRoot],
        },
      ];
    },
    80,
  );

  bifrost.events.on('sourceControlStatusChanged', () => {
    bifrost.statusBar.updateStatusBarItems();
  });
}
