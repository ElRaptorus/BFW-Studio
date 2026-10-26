import type { Bifrost } from '#bifrost/Bifrost';

export const LANDSCAPE_DOCUMENT_TYPE = 'bpmn-landscape-map';
export const LANDSCAPES_PAGE_ID = 'discover/landscapes';
export const LANDSCAPES_VIEW_ID = 'landscapes';

/**
 * Whether landscape maps can be used: they need a saved solution that declares a landscape folder,
 * because a map resolves its processes against the whole solution.
 */
export type LandscapeGate =
  | { readonly state: 'no-solution' }
  | { readonly state: 'unsaved'; readonly isFolder: boolean }
  | { readonly state: 'no-folder'; readonly solutionFileUri: string }
  | { readonly state: 'ready'; readonly solutionFileUri: string; readonly folderUri: string };

export function getLandscapeGate(bifrost: Bifrost): LandscapeGate {
  const solution = bifrost.solution.getSolution();
  if (solution == null) {
    return { state: 'no-solution' };
  }
  if (solution.solutionFileUri == null) {
    return { state: 'unsaved', isFolder: solution.isExplicitSolution !== true };
  }
  const folderUri = bifrost.solution.getViewFolderUri(LANDSCAPES_VIEW_ID);
  if (folderUri == null) {
    return { state: 'no-folder', solutionFileUri: solution.solutionFileUri };
  }
  return { state: 'ready', solutionFileUri: solution.solutionFileUri, folderUri };
}

/** The landscape folder as the `.bfwsln` names it: relative to the solution file when below it, else its local path. */
export function describeLandscapeFolder(bifrost: Bifrost, solutionFileUri: string, folderUri: string): string {
  const solutionDirectoryUri = solutionFileUri.slice(0, solutionFileUri.lastIndexOf('/'));
  return folderUri.startsWith(`${solutionDirectoryUri}/`)
    ? folderUri.slice(solutionDirectoryUri.length + 1)
    : bifrost.files.getLocalFilenameForUri(folderUri);
}

export function isInLandscapeFolder(uri: string, folderUri: string): boolean {
  return uri === folderUri || uri.startsWith(`${folderUri}/`);
}

/** The diagnostic for a map that cannot be opened, or `null` when it lies in the landscape folder. */
export function getMapOpenRefusal(bifrost: Bifrost, uri: string): string | null {
  const gate = getLandscapeGate(bifrost);
  switch (gate.state) {
    case 'no-solution':
    case 'unsaved':
      return 'Landscape maps open only from the landscape folder of a saved solution. Open the solution this map belongs to.';
    case 'no-folder':
      return 'Landscape maps open only from the landscape folder of the open solution, and this solution has none yet. Set it up on the Landscapes page and move this map there.';
    case 'ready':
      return isInLandscapeFolder(uri, gate.folderUri)
        ? null
        : `Landscape maps open only from the landscape folder of the open solution (${describeLandscapeFolder(bifrost, gate.solutionFileUri, gate.folderUri)}). Move this map there or open its solution.`;
  }
}
