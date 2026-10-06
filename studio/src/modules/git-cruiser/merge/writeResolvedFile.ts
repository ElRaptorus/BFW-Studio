import type { Bifrost } from '#bifrost/Bifrost';
import * as path from 'path';

import type { RepositoryStore } from '../RepositoryStore';

export async function writeResolvedFile(
  bifrost: Bifrost,
  repositoryStore: RepositoryStore,
  repoRoot: string,
  relativePath: string,
  content: string,
  options?: { stage?: boolean },
): Promise<void> {
  // save() decodes the URI, so the path is encoded to survive characters like `%`
  await bifrost.files.save(`file://${encodeURI(path.join(repoRoot, relativePath))}`, content);

  if (options?.stage) {
    await repositoryStore.stage(repoRoot, [relativePath]);
  }
}

export async function removeResolvedFile(
  repositoryStore: RepositoryStore,
  repoRoot: string,
  relativePath: string,
): Promise<void> {
  await repositoryStore.remove(repoRoot, [relativePath]);
}
