import type { Bifrost } from '#bifrost/Bifrost';
import * as fs from 'fs';
import * as path from 'path';

import type { GitService } from '../GitService';

export async function writeResolvedFile(
  bifrost: Bifrost,
  gitService: GitService,
  repoRoot: string,
  relativePath: string,
  content: string,
  options?: { stage?: boolean },
): Promise<void> {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.writeFileSync(absolutePath, content, 'utf-8');

  if (options?.stage) {
    await gitService.stage(repoRoot, [relativePath]);
  }
}

export async function removeResolvedFile(
  gitService: GitService,
  repoRoot: string,
  relativePath: string,
): Promise<void> {
  await gitService.remove(repoRoot, [relativePath]);
}
