import type { Bifrost } from '#bifrost/Bifrost';
import * as os from 'os';
import * as path from 'path';

import type { GitService } from './GitService';

const TEMP_DIR_NAME = 'bifrost-forge-world/git-diff';
const tempFilePaths: string[] = [];

function getTempDir(): string {
  return path.join(os.tmpdir(), TEMP_DIR_NAME);
}

export async function showGitDiffForFile(bifrost: Bifrost, gitService: GitService, uri: string): Promise<void> {
  const repoRoot = gitService.getRepoRootForUri(uri);
  if (!repoRoot) {
    bifrost.notifications.open('File is not in a Git repository.');
    return;
  }

  const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
  const relativePath = filePath.substring(repoRoot.length + 1);

  let headContent: string;
  try {
    headContent = await gitService.showFileAtRef(repoRoot, `HEAD:${relativePath}`);
  } catch {
    bifrost.notifications.open('This file has no previous commit (untracked).');
    return;
  }

  const tempDir = getTempDir();
  const tempFileName = `HEAD_${relativePath.replace(/\//g, '_')}`;
  const tempFilePath = path.join(tempDir, tempFileName);
  const tempFileUri = `file://${tempFilePath}`;

  try {
    await bifrost.files.createDirectory(`file://${path.dirname(tempDir)}`);
  } catch {
    // parent directory may already exist
  }
  try {
    await bifrost.files.createDirectory(`file://${tempDir}`);
  } catch {
    // directory may already exist
  }

  await bifrost.files.save(tempFileUri, headContent);
  tempFilePaths.push(tempFilePath);

  const diffCommand = uri.endsWith('.dmn') ? 'dmn.diff.openDiffTwoFiles' : 'bpmn.diff.openDiffTwoFiles';
  bifrost.commands.executeCommand(diffCommand, [tempFileUri, uri]);
}

export async function cleanupTempFiles(bifrost: Bifrost): Promise<void> {
  if (tempFilePaths.length === 0) {
    return;
  }

  const uris = tempFilePaths.map((tempPath) => `file://${tempPath}`);
  try {
    await bifrost.files.deleteFilesAndDirectories(uris);
  } catch {
    // ignore cleanup failures
  }
  tempFilePaths.length = 0;
}
