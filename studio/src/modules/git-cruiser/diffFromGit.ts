import type { Bifrost } from '#bifrost/Bifrost';
import { getUrlForOpenInNewTab } from '#bifrost/common/OpenInNewTabUrl';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';

import type { RepositoryStore } from './RepositoryStore';

const TEMP_DIR_NAME = 'bifrost-forge-world/git-diff';
const tempFilePaths: string[] = [];

/**
 * A version of a file: a commit hash, `HEAD`, `WORKING` (the file on disk) or `NONE` (the file does not exist there).
 */
type DiffRef = string;

type ChangeDiffRequest = {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  /** Path before a rename; the before side is read from here. */
  readonly previousRelativePath: string | null;
  readonly beforeRef: DiffRef;
  readonly afterRef: DiffRef;
};

const MODEL_DIFF_COMMANDS: Record<string, string> = {
  '.bpmn': 'bpmn.diff.openDiffTwoFiles',
  '.dmn': 'dmn.diff.openDiffTwoFiles',
};

function getTempDir(): string {
  return path.join(os.tmpdir(), TEMP_DIR_NAME);
}

function describeDiffRef(ref: DiffRef): string {
  switch (ref) {
    case 'HEAD':
      return 'Last commit';
    case 'WORKING':
      return 'Your changes';
    case 'NONE':
      return 'No file';
    default:
      return ref.substring(0, 7);
  }
}

/**
 * Writes one version of a model file to `<tempDir>/<hash of the content>/<path>`. The folder keeps the real file
 * name, so the diff title shows `order.bpmn`. The content hash makes the path unique per content: a moved `HEAD`
 * opens a new diff tab instead of focusing one that still shows the old version, and two repositories can never
 * overwrite each other's copy.
 */
async function writeTempVersion(bifrost: Bifrost, relativePath: string, content: string): Promise<string> {
  const contentHash = createHash('sha1').update(content).digest('hex').substring(0, 12);
  const tempFilePath = path.join(getTempDir(), contentHash, relativePath);

  await bifrost.files.createDirectory(`file://${path.dirname(tempFilePath)}`);
  await bifrost.files.save(`file://${tempFilePath}`, content);
  tempFilePaths.push(tempFilePath);

  return `file://${tempFilePath}`;
}

async function getVersionUri(
  bifrost: Bifrost,
  request: ChangeDiffRequest,
  ref: DiffRef,
  relativePathInThatVersion: string,
): Promise<string> {
  if (ref === 'WORKING') {
    return `file://${request.repositoryRoot}/${request.relativePath}`;
  }

  const content = await bifrost.sourceControl.getFileContentAtRevision(
    request.repositoryRoot,
    ref,
    relativePathInThatVersion,
  );
  return writeTempVersion(bifrost, request.relativePath, content);
}

/**
 * Opens the comparison of one file between two versions on the Source page.
 *
 * A BPMN or DMN file with both sides present opens the visual diff; everything else, and a model with one side
 * missing, opens the text diff.
 */
export async function openChangeDiff(bifrost: Bifrost, request: ChangeDiffRequest): Promise<void> {
  const { repositoryRoot, relativePath, previousRelativePath, beforeRef, afterRef } = request;

  const fileUri = `file://${repositoryRoot}/${relativePath}`;
  const beforeLabel = describeDiffRef(beforeRef);
  const afterLabel = describeDiffRef(afterRef);
  const fileName = path.basename(relativePath);
  const tabTitle = `Diff: ${fileName} (${beforeLabel} ↔ ${afterLabel})`;

  const modelDiffCommand = MODEL_DIFF_COMMANDS[path.extname(relativePath).toLowerCase()];
  const bothSidesPresent = beforeRef !== 'NONE' && afterRef !== 'NONE';

  if (modelDiffCommand != null && bothSidesPresent && bifrost.commands.isRegistered(modelDiffCommand)) {
    const beforeUri = await getVersionUri(bifrost, request, beforeRef, previousRelativePath ?? relativePath);
    const afterUri = await getVersionUri(bifrost, request, afterRef, relativePath);

    bifrost.commands.executeCommand(modelDiffCommand, [
      beforeUri,
      afterUri,
      { label: tabTitle, sourceFileUri: fileUri, beforeLabel, afterLabel },
    ]);
    return;
  }

  const textDiffUri = getUrlForOpenInNewTab('git.text-diff', fileUri, 'text-diff', {
    repositoryRoot,
    path: relativePath,
    ...(previousRelativePath != null ? { previousPath: previousRelativePath } : {}),
    beforeRef,
    afterRef,
    beforeLabel,
    afterLabel,
  });
  bifrost.editors.focusOrOpenEditorDocument(textDiffUri, tabTitle);
}

/**
 * `git.showGitDiff`: the last commit against the file on disk, for a file that is changed, new, renamed or deleted.
 */
export async function showGitDiffForFile(
  bifrost: Bifrost,
  repositoryStore: RepositoryStore,
  uri: string,
): Promise<void> {
  const repositoryRoot = repositoryStore.getRepoRootForUri(uri);
  if (!repositoryRoot) {
    bifrost.notifications.open('File is not in a Git repository.');
    return;
  }

  const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
  const relativePath = filePath.substring(repositoryRoot.length + 1);

  const status = repositoryStore.getFileStatus(uri);
  const isNewFile = status?.workingTreeStatus === 'untracked' || status?.indexStatus === 'added';
  const existsOnDisk = await bifrost.files.doesFileOrDirectoryExist(filePath);

  await openChangeDiff(bifrost, {
    repositoryRoot,
    relativePath,
    previousRelativePath: status?.previousPath ?? null,
    beforeRef: isNewFile ? 'NONE' : 'HEAD',
    afterRef: existsOnDisk ? 'WORKING' : 'NONE',
  });
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
