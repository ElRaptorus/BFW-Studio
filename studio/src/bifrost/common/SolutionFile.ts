import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import * as jsonComment from 'comment-json';

export type SolutionFileContent = {
  folders: SolutionFileFolder[];
  /** Folder URI per view id, resolved against the folder of the solution file. */
  views: Record<string, string>;
  settings: Record<string, any>;
};

export type SolutionFileFolder = {
  path: string;
  name?: string;
};

export class SolutionFileUnreadableError extends Error {
  readonly solutionFileUri: string;
  readonly reason: string;

  constructor(solutionFileUri: string, reason: string, fileName: string) {
    super(`The solution file "${fileName}" could not be read: ${reason}`);
    this.name = 'SolutionFileUnreadableError';
    this.solutionFileUri = solutionFileUri;
    this.reason = reason;
  }
}

type SolutionDocument = Record<string, any>;

/**
 * ponytail: the queue is in-process. Two windows with the same solution open can still
 * interleave writes. Upgrade path: a file lock around the read-modify-write.
 */
const writeQueues = new Map<string, Promise<void>>();

function enqueueWrite<T>(solutionFileUri: string, work: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(solutionFileUri) ?? Promise.resolve();
  const current = previous.then(work, work);
  const settled = current.then(
    () => undefined,
    () => undefined,
  );
  writeQueues.set(solutionFileUri, settled);
  void settled.then(() => {
    if (writeQueues.get(solutionFileUri) === settled) {
      writeQueues.delete(solutionFileUri);
    }
  });
  return current;
}

async function saveOrThrow(
  uri: string,
  content: string,
  fileHandling: FileHandlingService,
  description: string,
): Promise<void> {
  if ((await fileHandling.save(uri, content)) === false) {
    throw new Error(`Could not save ${description}`);
  }
}

function fileNameOf(solutionFileUri: string, fileHandling: FileHandlingService): string {
  try {
    return fileHandling.getFilename(solutionFileUri);
  } catch {
    return solutionFileUri;
  }
}

function unreadable(
  solutionFileUri: string,
  reason: string,
  fileHandling: FileHandlingService,
): SolutionFileUnreadableError {
  return new SolutionFileUnreadableError(solutionFileUri, reason, fileNameOf(solutionFileUri, fileHandling));
}

function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fileIsMissing(solutionFileUri: string, fileHandling: FileHandlingService): Promise<boolean> {
  try {
    const exists = await fileHandling.doesFileOrDirectoryExist(fileHandling.getLocalFilenameForUri(solutionFileUri));
    return !exists;
  } catch {
    try {
      await fileHandling.load(solutionFileUri);
      return false;
    } catch {
      return true;
    }
  }
}

function emptyDocument(): SolutionDocument {
  return { folders: [], settings: {} };
}

function isDocument(value: unknown): value is SolutionDocument {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function loadDocument(solutionFileUri: string, fileHandling: FileHandlingService): Promise<SolutionDocument> {
  let raw: string;
  try {
    raw = await fileHandling.load(solutionFileUri);
  } catch (error) {
    throw unreadable(solutionFileUri, failureReason(error), fileHandling);
  }
  let parsed: unknown;
  try {
    parsed = jsonComment.parse(raw);
  } catch (error) {
    throw unreadable(solutionFileUri, failureReason(error), fileHandling);
  }
  if (!isDocument(parsed)) {
    throw unreadable(solutionFileUri, 'the file is not a JSON object', fileHandling);
  }
  return parsed;
}

async function mutateSolutionDocument(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
  createIfMissing: boolean,
  mutate: (document: SolutionDocument) => void,
): Promise<void> {
  return enqueueWrite(solutionFileUri, async () => {
    const missing = await fileIsMissing(solutionFileUri, fileHandling);
    if (missing && !createIfMissing) {
      throw unreadable(solutionFileUri, 'the file does not exist', fileHandling);
    }
    const document = missing ? emptyDocument() : await loadDocument(solutionFileUri, fileHandling);
    mutate(document);
    await saveOrThrow(
      solutionFileUri,
      `${jsonComment.stringify(document, null, 2)}\n`,
      fileHandling,
      fileNameOf(solutionFileUri, fileHandling),
    );
  });
}

function foldersForSolution(solution: Solution, fileHandling: FileHandlingService): SolutionFileFolder[] {
  return solution.projects.map((project) => {
    const localPath = fileHandling.getLocalFilenameForUri(project.baseUri);
    const entry: SolutionFileFolder = { path: localPath };
    const defaultName = localPath.split('/').filter(Boolean).pop() || localPath;
    if (project.name !== defaultName) {
      entry.name = project.name;
    }
    return entry;
  });
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

/** Resolves a view path (relative to the folder of the solution file, or absolute) to a folder URI. */
function resolveViewUri(solutionFileUri: string, path: string, fileHandling: FileHandlingService): string {
  if (isAbsolutePath(path)) {
    return fileHandling.getUriForFilename(path.replace(/\\/g, '/').replace(/\/+$/, ''));
  }
  const segments = solutionFileUri.split('/').slice(0, -1);
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '..') {
      segments.pop();
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

/**
 * The path of `folderUri` relative to the folder of the solution file, with `/` separators.
 * A folder on another Windows drive has no relative path and is written absolute.
 */
function relativeViewPath(solutionFileUri: string, folderUri: string, fileHandling: FileHandlingService): string {
  const solutionFolderSegments = solutionFileUri.split('/').slice(0, -1);
  const folderSegments = folderUri.replace(/\/+$/, '').split('/');
  const driveIndex = 3;
  if (
    /^[A-Za-z]:$/.test(folderSegments[driveIndex] ?? '') &&
    folderSegments[driveIndex]?.toLowerCase() !== solutionFolderSegments[driveIndex]?.toLowerCase()
  ) {
    return fileHandling.getLocalFilenameForUri(folderUri).replace(/\\/g, '/');
  }
  let sharedCount = 0;
  while (
    sharedCount < solutionFolderSegments.length &&
    sharedCount < folderSegments.length &&
    solutionFolderSegments[sharedCount] === folderSegments[sharedCount]
  ) {
    sharedCount++;
  }
  const upwards = solutionFolderSegments.slice(sharedCount).map(() => '..');
  return [...upwards, ...folderSegments.slice(sharedCount)].join('/') || '.';
}

function viewsOfDocument(
  solutionFileUri: string,
  document: SolutionDocument,
  fileHandling: FileHandlingService,
): Record<string, string> {
  const views: Record<string, string> = {};
  if (!isDocument(document.views)) {
    return views;
  }
  for (const [viewId, view] of Object.entries(document.views)) {
    if (isDocument(view) && typeof view.path === 'string' && view.path.trim() !== '') {
      views[viewId] = resolveViewUri(solutionFileUri, view.path.trim(), fileHandling);
    }
  }
  return views;
}

function setViewPath(
  document: SolutionDocument,
  solutionFileUri: string,
  viewId: string,
  folderUri: string,
  fileHandling: FileHandlingService,
): void {
  if (!isDocument(document.views)) {
    document.views = {};
  }
  const existing = isDocument(document.views[viewId]) ? document.views[viewId] : {};
  document.views[viewId] = { ...existing, path: relativeViewPath(solutionFileUri, folderUri, fileHandling) };
}

function writeViewsOfSolution(
  solutionFileUri: string,
  solution: Solution,
  document: SolutionDocument,
  fileHandling: FileHandlingService,
): void {
  for (const [viewId, view] of Object.entries(solution.views ?? {})) {
    setViewPath(document, solutionFileUri, viewId, view.uri, fileHandling);
  }
}

export async function readSolutionFile(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
): Promise<SolutionFileContent> {
  const document = await loadDocument(solutionFileUri, fileHandling);
  if (!Array.isArray(document.folders)) {
    throw unreadable(solutionFileUri, '"folders" array is missing', fileHandling);
  }
  return {
    folders: [...document.folders].map((folder: any) => ({
      path: folder.path,
      name: folder.name || undefined,
    })),
    views: viewsOfDocument(solutionFileUri, document, fileHandling),
    settings: isDocument(document.settings) ? document.settings : {},
  };
}

/** Writes the folders, and the views of `solution` relative to `solutionFileUri` (so Save As keeps them). */
export async function writeSolutionFolders(
  solutionFileUri: string,
  solution: Solution,
  fileHandling: FileHandlingService,
): Promise<void> {
  await mutateSolutionDocument(solutionFileUri, fileHandling, true, (document) => {
    document.folders = foldersForSolution(solution, fileHandling);
    writeViewsOfSolution(solutionFileUri, solution, document, fileHandling);
    if (!isDocument(document.settings)) {
      document.settings = {};
    }
  });
}

/** Sets the folder of one view, as a path relative to the solution file, or removes it when `folderUri` is `null`. */
export async function writeSolutionView(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
  viewId: string,
  folderUri: string | null,
): Promise<void> {
  await mutateSolutionDocument(solutionFileUri, fileHandling, false, (document) => {
    if (folderUri == null) {
      if (isDocument(document.views)) {
        delete document.views[viewId];
        if (Object.keys(document.views).length === 0) {
          delete document.views;
        }
      }
      return;
    }
    setViewPath(document, solutionFileUri, viewId, folderUri, fileHandling);
  });
}

export async function updateSolutionSettings(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
  update: (settings: Record<string, unknown>) => Record<string, unknown> | void,
): Promise<void> {
  await mutateSolutionDocument(solutionFileUri, fileHandling, false, (document) => {
    if (!isDocument(document.settings)) {
      document.settings = {};
    }
    const replacement = update(document.settings);
    if (isDocument(replacement)) {
      document.settings = replacement;
    }
  });
}

/** The `settings` block only. Unlike `readSolutionFile`, a missing `folders` array is not an error. */
export async function readSolutionSettings(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
): Promise<Record<string, unknown>> {
  const document = await loadDocument(solutionFileUri, fileHandling);
  return isDocument(document.settings) ? document.settings : {};
}

export async function readSolutionSettingsText(
  solutionFileUri: string,
  fileHandling: FileHandlingService,
): Promise<string> {
  const document = await loadDocument(solutionFileUri, fileHandling);
  const settings = isDocument(document.settings) ? document.settings : {};
  return `${jsonComment.stringify(settings, null, 2)}\n`;
}

const MAXIMUM_BACKUP_NUMBER = 99;

async function firstFreeBackupUri(solutionFileUri: string, fileHandling: FileHandlingService): Promise<string> {
  for (let index = 0; index <= MAXIMUM_BACKUP_NUMBER; index++) {
    const candidate = index === 0 ? `${solutionFileUri}.broken` : `${solutionFileUri}.broken.${index}`;
    if (await fileIsMissing(candidate, fileHandling)) {
      return candidate;
    }
  }
  throw new Error(
    `No free backup name next to ${fileNameOf(solutionFileUri, fileHandling)}: .broken to .broken.${MAXIMUM_BACKUP_NUMBER} all exist`,
  );
}

export async function repairSolutionFile(
  solutionFileUri: string,
  solution: Solution,
  fileHandling: FileHandlingService,
): Promise<string | null> {
  return enqueueWrite(solutionFileUri, async () => {
    let backupUri: string | null = null;
    if (!(await fileIsMissing(solutionFileUri, fileHandling))) {
      let raw: string;
      try {
        raw = await fileHandling.load(solutionFileUri);
      } catch (error) {
        throw new Error(
          `Could not back up ${fileNameOf(solutionFileUri, fileHandling)}, so it was not repaired: ${failureReason(error)}`,
          { cause: error },
        );
      }
      backupUri = await firstFreeBackupUri(solutionFileUri, fileHandling);
      await saveOrThrow(backupUri, raw, fileHandling, `the backup of ${fileNameOf(solutionFileUri, fileHandling)}`);
    }

    const repaired = emptyDocument();
    repaired.folders = foldersForSolution(solution, fileHandling);
    writeViewsOfSolution(solutionFileUri, solution, repaired, fileHandling);
    await saveOrThrow(
      solutionFileUri,
      `${jsonComment.stringify(repaired, null, 2)}\n`,
      fileHandling,
      fileNameOf(solutionFileUri, fileHandling),
    );
    return backupUri;
  });
}
