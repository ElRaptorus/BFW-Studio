import type { Bifrost } from '#bifrost/Bifrost';

import type { GitService } from '../GitService';
import type { GitPullResult } from '../GitTypes';
import { showGitError, showPullError, showStashPopError } from './gitErrorNotification';

export async function handlePullResult(
  bifrost: Bifrost,
  gitService: GitService,
  repoRoot: string,
  result: GitPullResult,
): Promise<boolean> {
  if (result.success) {
    return true;
  }

  if (!result.recoverable) {
    showPullError(bifrost, result.error);
    return false;
  }

  if (result.recoverable === 'merge-conflicts') {
    const state = gitService.getRepoState(repoRoot);
    const conflictCount = state?.mergeState.conflictedFiles.length ?? 0;
    const bpmnCount = state?.mergeState.conflictedFiles.filter((file) => file.path.endsWith('.bpmn')).length ?? 0;
    const dmnCount = state?.mergeState.conflictedFiles.filter((file) => file.path.endsWith('.dmn')).length ?? 0;
    const diagramCount = bpmnCount + dmnCount;

    const actions: { action: string; label: string; default?: boolean }[] = [];
    if (diagramCount > 0) {
      actions.push({ action: 'open-resolver', label: 'Open Merge Resolver', default: true });
    }
    actions.push({ action: 'show-git-pane', label: 'Show in Git Pane' });
    actions.push({ action: 'abort', label: 'Abort Merge' });

    const notificationId = bifrost.notifications.open(
      {
        type: 'warning',
        content: `Pull resulted in ${conflictCount} merge conflict${conflictCount !== 1 ? 's' : ''}${diagramCount > 0 ? ` (${diagramCount} diagram file${diagramCount !== 1 ? 's' : ''})` : ''}.`,
        source: 'Git Cruiser',
        actions,
      },
      async (response) => {
        bifrost.notifications.close(notificationId);
        if (response.action === 'open-resolver') {
          bifrost.commands.executeCommand('git.merge.openResolver');
        } else if (response.action === 'show-git-pane') {
          bifrost.commands.executeCommand('git.focusGitPane');
        } else if (response.action === 'abort') {
          bifrost.commands.executeCommand('git.merge.abort');
        }
      },
    );
    return false;
  }

  const actions: any[] = [];

  if (result.recoverable === 'rebase') {
    actions.push({
      label: 'Rebase onto Remote',
      response: 'rebase',
      default: true,
    });
  } else if (result.recoverable === 'stash-and-retry') {
    actions.push({
      label: 'Stash Changes & Retry',
      response: 'stash-retry',
      default: true,
    });
  }

  actions.push({ label: 'Close', response: 'close', cancel: true });

  const dialogResult = await bifrost.dialog.open({
    title: 'Git Pull Failed',
    content: result.error ?? 'An unknown error occurred during pull.',
    actions,
  });

  if (dialogResult?.response === 'rebase') {
    try {
      const retryResult = await gitService.pull(repoRoot, { rebase: true });
      if (!retryResult.success) {
        showPullError(bifrost, retryResult.error ?? 'Rebase failed.');
        return false;
      }

      return true;
    } catch (error: any) {
      showPullError(bifrost, error);
      return false;
    }
  }

  if (dialogResult?.response === 'stash-retry') {
    try {
      await gitService.stash(repoRoot, 'Auto-stash before pull');
      const retryResult = await gitService.pull(repoRoot);
      if (retryResult.success) {
        try {
          await gitService.stashApply(repoRoot, 0);
          return true;
        } catch (popError: any) {
          showStashPopError(bifrost, popError);
          return false;
        }
      } else {
        showPullError(bifrost, retryResult.error ?? 'Pull still failed after stashing changes.');
        return false;
      }
    } catch (error: any) {
      showGitError(bifrost, 'Stash & retry failed', error);
      return false;
    }
  }

  return false;
}
