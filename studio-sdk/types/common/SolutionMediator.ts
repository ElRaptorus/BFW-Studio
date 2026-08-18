import type { Solution } from '../contracts/SolutionTypes';

export declare class SolutionMediator {
  /**
   * Returns `true` if the open solution contains a document with the given `uri`.
   */
  containsEditorDocumentWithUri(uri: string): boolean;

  /**
   * Returns the currently opened solution (or `null`).
   */
  getSolution(): Solution | null;

  /**
   * Returns `true` if there is an open solution.
   */
  hasOpenSolution(): boolean;

  /**
   * Opens a directory in the local file system as solution using the given `directoryUri`.
   */
  openDirectoryAsSolution(directoryUri: string): void;

  /**
   * Opens a `.essln` solution file, creating a multi-root solution from its contents.
   */
  openSolutionFile(solutionFileUri: string): Promise<void>;

  /**
   * Saves the current solution to a `.essln` file.
   */
  saveSolutionFile(solutionFileUri: string): Promise<void>;

  /**
   * Adds a folder to the current solution.
   */
  addFolderToSolution(directoryUri: string): void;

  /**
   * Renames a project in the current solution.
   */
  renameProjectInSolution(projectId: string, newName: string): void;

  /**
   * Returns `true` if the current solution has unsaved changes.
   */
  isSolutionDirty(): boolean;

  /**
   * Closes the currently open solution, disposing all watchers.
   */
  closeSolution(): void;

  /**
   * Removes a folder (project) from the current solution by its project ID.
   */
  removeFolderFromSolution(projectId: string): void;

  /**
   * Gets all filePatterns which are shown in the File Explorer by default.
   **/
  getDefaultIncludedFiles(): string[];

  /**
   * Adds `filePatterns` which are shown in the File Explorer by default.
   *
   * Examples:
   *
   *    studio.solution.registerDefaultIncludedFiles(['*.txt']);
   */
  registerDefaultIncludedFiles(filePatterns: string[]): void;

  /**
   * Removes `filePatterns` previously added via `registerDefaultIncludedFiles`.
   */
  unregisterDefaultIncludedFiles(filePatterns: string[]): void;

  /**
   * Gets all filePatterns which are excluded from the File Explorer by default.
   */
  getDefaultExcludedFiles(): string[];

  /**
   * Adds `filePatterns` which are excluded from the File Explorer by default.
   *
   * Example: `studio.solution.registerDefaultExcludedFiles(['target'])`
   */
  registerDefaultExcludedFiles(filePatterns: string[]): void;

  /**
   * Toggles display of hidden files in the file explorer.
   */
  toggleHiddenFiles(): void;

  /**
   * Forces a solution reload by re-emitting the solution changed event.
   */
  onRefresh(): void;
}
