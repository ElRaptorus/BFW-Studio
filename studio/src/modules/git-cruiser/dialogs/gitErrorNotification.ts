import type { Bifrost } from '#bifrost/Bifrost';

function stripIpcWrapper(raw: string): string {
  return raw.replace(/^Error invoking remote method '[^']+': /, '').replace(/^Error: /, '');
}

function notify(bifrost: Bifrost, summary: string, raw: string): void {
  console.error('[git-cruiser]', raw);
  bifrost.commands.executeCommand('std.notifications.showError', [summary, 'Git Cruiser']);
}

function msg(error: any): string {
  return stripIpcWrapper(error?.message ?? String(error));
}

// ── Per-command processors ──────────────────────────────────────────

export function showCommitError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('nothing to commit')) {
    summary = 'No changes staged for commit.';
  } else if (raw.includes('empty commit message') || raw.includes('Aborting commit due to empty')) {
    summary = 'Commit message must not be empty.';
  } else if ((raw.includes('hook') && raw.includes('reject')) || raw.includes('pre-commit hook')) {
    summary = 'Commit was rejected by a Git hook. Check the hook output for details.';
  } else {
    summary = 'Commit failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

export function showPushError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('[remote rejected]')) {
    const isRuleViolation = raw.includes('rule violations');
    const remoteLineFlter = isRuleViolation ? 'remote: -' : 'remote:';

    const reasons = raw
      .split('\n')
      .filter((line) => line.startsWith(remoteLineFlter))
      .map((line) => line.replace(/^remote: /, ''))
      .join('\n');

    summary = isRuleViolation
      ? `Push was rejected by the remote, because of rule violations:\n${reasons}`
      : `Push was rejected by the remote with the following error: ${reasons}`;
  } else if (raw.includes('[rejected]') || raw.includes('non-fast-forward')) {
    summary = 'Push was rejected because the remote contains newer changes. Pull first, then try again.';
  } else if (raw.includes('no upstream') || raw.includes('has no upstream branch') || raw.includes('--set-upstream')) {
    summary = 'This branch has no remote tracking branch. Set an upstream first.';
  } else if (raw.includes('Authentication failed') || raw.includes('could not read Username')) {
    summary = 'Authentication with the remote failed. Check your credentials.';
  } else if (raw.includes('Repository not found')) {
    summary = 'Failed to access remote repository. Check the remote exists and ensure you have sufficent permissions.';
  } else {
    const remoteLine = raw.split('\n').find((line) => line.trim().startsWith('remote:'));
    if (remoteLine) {
      summary = `The remote server responded: ${remoteLine.replace(/^remote:\s*/, '').trim()}`;
    } else {
      summary = 'Push failed. Check the developer console for details.';
    }
  }

  notify(bifrost, summary, raw);
}

export function showPullError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('uncommitted changes') || raw.includes('unmerged files')) {
    summary = 'Pull aborted because you have local uncommitted changes. Commit or stash them first.';
  } else if (raw.includes('CONFLICT') || raw.includes('Automatic merge failed')) {
    summary = 'Pull resulted in merge conflicts. Resolve the conflicts and commit the result.';
  } else if (raw.includes('diverged') || raw.includes('overwritten by merge')) {
    summary = 'Your local branch and the remote have diverged. Consider rebasing or merging manually.';
  } else if (raw.includes('Authentication failed') || raw.includes('could not read Username')) {
    summary = 'Authentication with the remote failed. Check your credentials.';
  } else if (raw.includes('Repository not found')) {
    summary = 'Failed to access remote repository. Check the remote exists and ensure you have sufficent permissions.';
  } else {
    summary = 'Pull failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

export function showRevertError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('did not match any file') || raw.includes('pathspec')) {
    summary = 'The file could not be found by Git. It may have been renamed or deleted.';
  } else {
    summary = 'Revert failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

export function showStashError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('No local changes to save')) {
    summary = 'There are no changes to stash.';
  } else {
    summary = 'Stash failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

export function showStashPopError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('CONFLICT') || raw.includes('could not restore')) {
    summary = 'Stash could not be applied because it conflicts with your current changes.';
  } else if (raw.includes('No stash entries found')) {
    summary = 'No stash entries found.';
  } else {
    summary = 'Apply stash failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

export function showBranchCreateError(bifrost: Bifrost, error: any): void {
  const raw = msg(error);

  let summary: string;
  if (raw.includes('already exists')) {
    summary = 'A branch with this name already exists.';
  } else if (raw.includes('not a valid branch name') || raw.includes('invalid')) {
    summary = 'The branch name is invalid. Avoid special characters and spaces.';
  } else {
    summary = 'Create branch failed. Check the developer console for details.';
  }

  notify(bifrost, summary, raw);
}

// ── Generic fallback for compound operations ────────────────────────

export function showGitError(bifrost: Bifrost, title: string, error: any): void {
  const raw = msg(error);
  notify(bifrost, `${title}. Check the developer console for details.`, raw);
}
