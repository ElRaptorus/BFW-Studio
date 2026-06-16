import type { Bifrost } from '#bifrost/Bifrost';

import type { TreeBadge, TreeDecorationProvider, TreeItemDecoration, TreeItemStyles } from '@evil/bifrost_fw_sdk';

import type { GitFileStatus, GitFileStatusCode, GitRepoState } from '../GitTypes';
import { STATUS_BADGE_MAP, STATUS_COLOR_TOKEN_MAP, STATUS_SEVERITY } from '../GitTypes';

function getEffectiveStatus(fileStatus: GitFileStatus): GitFileStatusCode | null {
  return fileStatus.workingTreeStatus ?? fileStatus.indexStatus;
}

function buildDecoration(status: GitFileStatusCode): TreeItemDecoration {
  const color: string = STATUS_COLOR_TOKEN_MAP[status];
  const badgeChar = STATUS_BADGE_MAP[status];

  const styles: Partial<TreeItemStyles> = { labelColor: color, badgeColor: color };
  const badges: TreeBadge[] = [];

  if (badgeChar) {
    badges.push({ type: 'character', character: badgeChar });
  }

  return { styles, badges };
}

function getWorstStatus(statuses: GitFileStatusCode[]): GitFileStatusCode | null {
  let worst: GitFileStatusCode | null = null;
  for (const status of statuses) {
    if (!worst || STATUS_SEVERITY[status] > STATUS_SEVERITY[worst]) {
      worst = status;
    }
  }
  return worst;
}

export class GitDecorationProvider implements TreeDecorationProvider {
  private cache = new Map<string, TreeItemDecoration>();
  private listeners: ((uris: string[]) => void)[] = [];

  provideDecoration(uri: string): TreeItemDecoration | null {
    return this.cache.get(uri) ?? null;
  }

  onDidChange(listener: (uris: string[]) => void): { dispose(): void } {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  refresh(repoStates: GitRepoState[]): void {
    const newCache = new Map<string, TreeItemDecoration>();

    const directoryStatuses = new Map<string, GitFileStatusCode[]>();

    for (const state of repoStates) {
      const repoUri = `file://${state.repoRoot}`;

      for (const file of state.files) {
        const effectiveStatus = getEffectiveStatus(file);
        if (!effectiveStatus) {
          continue;
        }

        newCache.set(file.uri, buildDecoration(effectiveStatus));

        const parts = file.path.split('/');
        for (let i = 1; i < parts.length; i++) {
          const dirRelative = parts.slice(0, i).join('/');
          const dirUri = `${repoUri}/${dirRelative}`;
          let statuses = directoryStatuses.get(dirUri);
          if (!statuses) {
            statuses = [];
            directoryStatuses.set(dirUri, statuses);
          }
          statuses.push(effectiveStatus);
        }
      }
    }

    for (const [dirUri, statuses] of directoryStatuses) {
      const worst = getWorstStatus(statuses);
      if (worst) {
        newCache.set(dirUri, buildDecoration(worst));
      }
    }

    const changedUris: string[] = [];

    for (const [uri, decoration] of newCache) {
      const old = this.cache.get(uri);
      if (!old || !decorationsEqual(old, decoration)) {
        changedUris.push(uri);
      }
    }
    for (const uri of this.cache.keys()) {
      if (!newCache.has(uri)) {
        changedUris.push(uri);
      }
    }

    this.cache = newCache;

    if (changedUris.length > 0) {
      for (const listener of this.listeners) {
        listener(changedUris);
      }
    }
  }
}

function decorationsEqual(left: TreeItemDecoration, right: TreeItemDecoration): boolean {
  const leftColor = left.styles?.labelColor;
  const rightColor = right.styles?.labelColor;
  if (leftColor !== rightColor) {
    return false;
  }

  const leftBadge = left.badges?.[0];
  const rightBadge = right.badges?.[0];
  if (leftBadge == null && rightBadge == null) {
    return true;
  }
  if (leftBadge == null || rightBadge == null) {
    return false;
  }
  if (leftBadge.type !== rightBadge.type) {
    return false;
  }
  if (leftBadge.type === 'character' && rightBadge.type === 'character') {
    return leftBadge.character === rightBadge.character;
  }
  return false;
}

export function initializeDecorations(bifrost: Bifrost): GitDecorationProvider {
  const provider = new GitDecorationProvider();
  bifrost.fileExplorerView.registerDecorationProvider(provider);
  return provider;
}
