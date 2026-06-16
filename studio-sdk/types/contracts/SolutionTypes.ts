export declare type Solution = {
  type: 'solution';
  /**
   * GUID - set automatically
   */
  id: string;
  /**
   * Human readable name for the solution
   */
  name: string;
  /**
   * URI of the solution root directory (single-folder mode) or a synthetic identifier (multi-folder mode).
   */
  baseUri: string;
  showHiddenFiles: boolean;
  projects: Project[];
  /**
   * URI of the `.essln` file that defines this solution.
   * `undefined` for single-folder solutions that have not been saved to a file.
   */
  solutionFileUri?: string;
  /**
   * `true` when this solution was opened from an `.essln` file or promoted
   * to multi-root via "Add Folder". Explicit solutions always show project
   * root entries in the tree, even when only one project remains.
   */
  isExplicitSolution?: boolean;
};
export declare type Project = {
  type: 'project';
  /**
   * GUID - set automatically
   */
  id: string;
  /**
   * Human readable name for the solution
   */
  name: string;
  /**
   * URI - most likely a directory for now
   */
  baseUri: string;
  files: {
    /**
     * Files that are specifically included, takes a glob pattern
     */
    included: string[];
    /**
     * Files that are specifically excluded, takes a glob pattern
     */
    excluded: string[];
  };
};
