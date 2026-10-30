import type { Bifrost } from '#bifrost/Bifrost';
import * as path from 'path';

import type { RepositoryStore } from './RepositoryStore';
import { getModelCommand } from './modelFileTypes';

export async function showFileHistory(bifrost: Bifrost, repositoryStore: RepositoryStore, uri: string): Promise<void> {
  const repoRoot = repositoryStore.getRepoRootForUri(uri);
  if (!repoRoot) {
    bifrost.notifications.open('File is not in a Git repository.');
    return;
  }

  const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
  const relativePath = filePath.substring(repoRoot.length + 1);

  const previewCommand = getModelCommand(uri, 'openHistoryPreview');
  if (previewCommand == null || !bifrost.commands.isRegistered(previewCommand)) {
    bifrost.notifications.open(`${path.basename(relativePath)} cannot be previewed.`);
    return;
  }

  const log = await bifrost.sourceControl.getLog(repoRoot, { file: relativePath });
  if (log.length <= 1) {
    bifrost.notifications.open('This file has no prior versions to browse.');
    return;
  }

  const entries = log.map((entry, index) => {
    const shortHash = entry.hash.substring(0, 7);
    const formattedDate = formatDate(entry.date);

    return {
      type: 'command' as const,
      icon: 'git-cruiser/commit',
      label: entry.message.split('\n')[0],
      sublabel: `${entry.author} · ${shortHash} · ${formattedDate}`,
      badges: index === 0 ? [{ type: 'text' as const, text: 'current' }] : undefined,
      command: previewCommand,
      commandArgs: [uri, entry.hash, entry.message, entry.author, entry.date],
    };
  });

  bifrost.quickJump.show({
    prompt: 'Select a version...',
    entries,
  });
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}
