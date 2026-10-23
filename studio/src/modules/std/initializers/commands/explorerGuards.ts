import type { Bifrost } from '#bifrost/Bifrost';
import type { TreeViewMediator } from '#bifrost/browser/TreeViewMediator';
import { type ExplorerDefinition, getExplorerTreeId } from '#bifrost/contracts/ExplorerTypes';

type ViewFolder = { viewId: string; uri: string };

/** The explorer named by `explorerId`, else the active one. */
export function resolveExplorer(bifrost: Bifrost, explorerId?: string): ExplorerDefinition {
  return explorerId != null ? bifrost.explorers.get(explorerId) : bifrost.explorers.getActiveExplorer();
}

export function getExplorerTree(bifrost: Bifrost, explorerId: string): TreeViewMediator | null {
  const treeId = getExplorerTreeId(explorerId);
  return bifrost.views.isRegistered(treeId) ? bifrost.views.getById<TreeViewMediator>(treeId) : null;
}

/** Shows why and returns `true` when `explorer` does not offer structural operations. */
export function refuseOutsideStructuralExplorer(
  bifrost: Bifrost,
  explorer: ExplorerDefinition,
  operation: string,
): boolean {
  if (explorer.structuralOperations === true) {
    return false;
  }
  bifrost.notifications.open({ type: 'info', content: `${operation} only in the Designer explorer.` });
  return true;
}

/**
 * Shows why and returns `true` when one of `uris` lies in a solution view folder and `explorer` shows the
 * whole solution, where view folders are read-only.
 */
export function refuseProtected(bifrost: Bifrost, explorer: ExplorerDefinition, uris: string[]): boolean {
  if (explorer.source.kind !== 'solution') {
    return false;
  }
  for (const uri of uris) {
    const viewFolder = getViewFolders(bifrost).find((folder) => isAtOrBelow(uri, folder.uri));
    if (viewFolder != null) {
      const viewExplorer = bifrost.explorers.getViewExplorer(viewFolder.viewId);
      const where = viewExplorer?.label != null ? `in the ${viewExplorer.label} explorer` : 'on its own page';
      bifrost.notifications.open({
        type: 'info',
        content: `"${bifrost.files.getFilename(uri)}" is in the ${viewFolder.viewId} folder of this solution, which is read-only here. Change it ${where}.`,
      });
      return true;
    }
  }
  return false;
}

/** Shows why and returns `true` when `uris` contain a directory and `explorer` allows only file operations. */
export async function refuseDirectoriesOutsideStructuralExplorer(
  bifrost: Bifrost,
  explorer: ExplorerDefinition,
  uris: string[],
  operation: string,
): Promise<boolean> {
  if (explorer.structuralOperations === true) {
    return false;
  }
  for (const uri of uris) {
    if (await bifrost.files.isDirectory(uri)) {
      bifrost.notifications.open({
        type: 'info',
        content: `Folders can be ${operation} only in the Designer explorer.`,
      });
      return true;
    }
  }
  return false;
}

/**
 * Asks before a folder holding solution view folders is deleted, moved or renamed. Resolves to the affected
 * view folders (empty when none is affected) or `null` when the user cancels.
 */
export async function confirmViewFolderChange(
  bifrost: Bifrost,
  uris: string[],
  action: 'delete' | 'move' | 'rename',
): Promise<ViewFolder[] | null> {
  const affected = getViewFolders(bifrost).filter((folder) => uris.some((uri) => isAtOrBelow(folder.uri, uri)));
  if (affected.length === 0) {
    return [];
  }

  const lines = await Promise.all(
    affected.map(async (folder) => {
      const fileCount = (await bifrost.files.getAllFileUrisInDirectoryTree(folder.uri)).length;
      return `- \`${bifrost.files.getLocalFilenameForUri(folder.uri)}\` (${folder.viewId} folder, ${fileCount} ${fileCount === 1 ? 'file' : 'files'})`;
    }),
  );
  const labels = [
    ...new Set(affected.flatMap((folder) => bifrost.explorers.getViewExplorer(folder.viewId)?.label ?? [])),
  ];
  const contentLabel = labels.length > 0 ? labels.join(' and ') : 'Contents';
  const reporters = labels.length > 0 ? labels.map((label) => `the ${label} explorer`).join(' and ') : 'its page';
  const verb = { delete: 'Delete', move: 'Move', rename: 'Rename' }[action];
  const consequence =
    action === 'delete'
      ? `Everything in ${affected.length === 1 ? 'it' : 'them'} is deleted, and ${reporters} will report the folder as missing.`
      : 'The solution file is updated to the new location.';

  const result = await bifrost.dialog.open({
    title:
      affected.length === 1
        ? `${verb} the ${affected[0].viewId} folder?`
        : `${verb} ${affected.length} solution view folders?`,
    content: `This contains:\n\n${lines.join('\n')}\n\n${consequence}`,
    actions: [
      { label: 'Cancel', response: 'cancel', cancel: true, default: true },
      { label: `${verb} Folder and ${contentLabel}`, response: 'confirm', dangerous: true },
    ],
  });
  return result.wasCancelled || result.response !== 'confirm' ? null : affected;
}

/** Moves open documents at or below `sourceUri` to the same place below `newUri`. */
export async function updateOpenEditorDocuments(bifrost: Bifrost, sourceUri: string, newUri: string): Promise<void> {
  const directMatch = bifrost.editors.getEditorDocumentByUri(sourceUri);
  if (directMatch != null) {
    const model = await bifrost.editors.getEditorDocumentModel(directMatch);
    model.resetUriAndData(newUri, directMatch.data.original, directMatch.data.current);
    return;
  }

  const sourcePrefix = sourceUri.endsWith('/') ? sourceUri : sourceUri + '/';
  const newPrefix = newUri.endsWith('/') ? newUri : newUri + '/';

  const openDocuments = bifrost.editors.getOpenEditorDocuments();
  for (const openDocument of openDocuments) {
    if (openDocument.uri.startsWith(sourcePrefix)) {
      const updatedUri = newPrefix + openDocument.uri.slice(sourcePrefix.length);
      const model = await bifrost.editors.getEditorDocumentModel(openDocument);
      model.resetUriAndData(updatedUri, openDocument.data.original, openDocument.data.current);
    }
  }
}

/** Points the affected view folders at their new place after `oldUri` moved to `newUri`. */
export async function followMovedViewFolders(
  bifrost: Bifrost,
  affected: ViewFolder[],
  oldUri: string,
  newUri: string,
): Promise<void> {
  for (const folder of affected) {
    if (isAtOrBelow(folder.uri, oldUri)) {
      await bifrost.solution.setViewFolder(folder.viewId, newUri + folder.uri.slice(oldUri.length));
    }
  }
}

function getViewFolders(bifrost: Bifrost): ViewFolder[] {
  const solution = bifrost.solution.getSolution();
  if (solution?.solutionFileUri == null) {
    return [];
  }
  return Object.entries(solution.views ?? {}).map(([viewId, view]) => ({ viewId, uri: view.uri }));
}

function isAtOrBelow(uri: string, folderUri: string): boolean {
  return uri === folderUri || uri.startsWith(`${folderUri}/`);
}
