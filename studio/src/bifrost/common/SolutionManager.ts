import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';

import type { ISerializable, SerializedData } from '../contracts/SerializableTypes';
import type { Project, Solution } from '../contracts/SolutionTypes';

export const EVENT_SOLUTION_CHANGED = 'EVENT_SOLUTION_CHANGED';

export class SolutionManager extends AbstractEmitter implements ISerializable {
  public solution: Solution | null;

  private defaultIncludedFiles: string[];
  private defaultExcludedFiles: string[];
  private dirty: boolean = false;

  constructor() {
    super();
    this.solution = null;

    this.defaultIncludedFiles = [];
    this.defaultExcludedFiles = [];
  }

  openDirectoryAsSolution(baseUri: string, name: string, defaultExcludedFiles: string[]): void {
    this.solution = this.buildSolution(baseUri, name, defaultExcludedFiles);
    this.dirty = false;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  openSolutionFromFile(
    solutionFileUri: string,
    solutionName: string,
    folders: { path: string; name?: string }[],
    defaultExcludedFiles: string[],
  ): void {
    const solution: Solution = {
      type: 'solution',
      id: crypto.randomUUID(),
      name: solutionName,
      baseUri: solutionFileUri,
      projects: [],
      showHiddenFiles: false,
      solutionFileUri,
      isExplicitSolution: true,
    };

    let result = solution;
    for (const folder of folders) {
      const folderName = folder.name || folder.path.split('/').filter(Boolean).pop() || folder.path;
      result = this.addProjectToSolution(result, folder.path, folderName, defaultExcludedFiles);
    }

    this.solution = result;
    this.dirty = false;
    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  hasOpenSolution(): boolean {
    return this.solution != null;
  }

  getUri(): string | null {
    return this.solution?.baseUri || null;
  }

  getSolution(): Solution | null {
    return this.solution;
  }

  addFolder(baseUri: string, excludedFiles?: string[]): void {
    assertNotNull(this.solution, 'this.solution');

    const isDuplicate = this.solution.projects.some((project) => project.baseUri === baseUri);
    if (isDuplicate) {
      throw new Error(`Folder '${baseUri}' is already part of this solution.`);
    }

    const isOverlapping = this.solution.projects.some(
      (project) => baseUri.startsWith(project.baseUri + '/') || project.baseUri.startsWith(baseUri + '/'),
    );
    if (isOverlapping) {
      throw new Error(`Folder '${baseUri}' overlaps with an existing project in this solution.`);
    }

    const name = baseUri.split('/').filter(Boolean).pop() || baseUri;
    const effectiveExcluded = excludedFiles ?? [...this.defaultExcludedFiles];
    this.solution = this.addProjectToSolution(this.solution, baseUri, name, effectiveExcluded);
    this.solution.isExplicitSolution = true;
    this.dirty = true;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  renameProject(projectId: string, newName: string): void {
    assertNotNull(this.solution, 'this.solution');

    const project = this.solution.projects.find((existingProject) => existingProject.id === projectId);
    if (project == null) {
      throw new Error(`Project '${projectId}' not found in solution.`);
    }

    this.solution = {
      ...this.solution,
      projects: this.solution.projects.map((existingProject) =>
        existingProject.id === projectId ? { ...existingProject, name: newName } : existingProject,
      ),
    };
    this.dirty = true;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  removeFolder(projectId: string): void {
    assertNotNull(this.solution, 'this.solution');

    if (this.solution.projects.length <= 1) {
      throw new Error('Cannot remove the last folder from a solution.');
    }

    this.solution = {
      ...this.solution,
      projects: this.solution.projects.filter((project) => project.id !== projectId),
    };
    this.dirty = true;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  reorderFolders(projectIds: string[]): void {
    assertNotNull(this.solution, 'this.solution');

    const projectMap = new Map(this.solution.projects.map((project) => [project.id, project]));
    const reorderedProjects = projectIds
      .map((projectId) => projectMap.get(projectId))
      .filter((project): project is Project => project != null);

    this.solution = { ...this.solution, projects: reorderedProjects };
    this.dirty = true;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  setSolutionFileUri(solutionFileUri: string, solutionName: string): void {
    assertNotNull(this.solution, 'this.solution');

    this.solution = {
      ...this.solution,
      solutionFileUri,
      name: solutionName,
      baseUri: solutionFileUri,
    };
    this.dirty = false;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  isSolutionDirty(): boolean {
    if (this.solution == null) {
      return false;
    }
    if (this.solution.isExplicitSolution && this.solution.solutionFileUri == null) {
      return true;
    }
    return this.dirty;
  }

  clearDirty(): void {
    this.dirty = false;
  }

  closeSolution(): void {
    this.solution = null;
    this.dirty = false;
    this.emit(EVENT_SOLUTION_CHANGED, [null]);
  }

  toggleHiddenFiles(): void {
    assertNotNull(this.solution, 'this.solution');

    this.solution.showHiddenFiles = !this.solution.showHiddenFiles;

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  getDefaultIncludedFiles(): string[] {
    return [...this.defaultIncludedFiles];
  }

  registerDefaultIncludedFiles(filePatterns: string[]): void {
    this.defaultIncludedFiles = this.defaultIncludedFiles.concat(filePatterns);
    this.reapplyIncludedFilesToOpenProjects();
  }

  /**
   * Removes previously-registered default-included file patterns.
   *
   * Removes at most one occurrence per pattern (mirroring `filePatterns`), so callers that
   * register the same pattern multiple times (e.g. multiple plugin instances) don't
   * inadvertently remove each other's entries. Intended for plugins, which — unlike built-in
   * modules — can be disabled, reloaded, or uninstalled at runtime.
   */
  unregisterDefaultIncludedFiles(filePatterns: string[]): void {
    const remaining = [...this.defaultIncludedFiles];
    for (const pattern of filePatterns) {
      const index = remaining.indexOf(pattern);
      if (index !== -1) {
        remaining.splice(index, 1);
      }
    }
    this.defaultIncludedFiles = remaining;
    this.reapplyIncludedFilesToOpenProjects();
  }

  /**
   * `Project.files.included` is a snapshot of `defaultIncludedFiles` taken once, when the
   * project is added to the solution (see `addProjectToSolution`). Built-in modules only ever
   * call `registerDefaultIncludedFiles` during their synchronous `onLoad`, before any solution
   * exists, so the snapshot was always accurate. Plugins can register document types — and
   * their default-included patterns — lazily, well after a solution has already been restored
   * and its projects created. Without republishing the current pattern list into every already-
   * open project (and notifying listeners), newly-registered patterns would silently have no
   * effect on the File Explorer until the solution was closed and reopened.
   */
  private reapplyIncludedFilesToOpenProjects(): void {
    if (this.solution == null) {
      return;
    }

    this.solution = {
      ...this.solution,
      projects: this.solution.projects.map((project) => ({
        ...project,
        files: { ...project.files, included: [...this.defaultIncludedFiles] },
      })),
    };

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  getDefaultExcludedFiles(): string[] {
    return [...this.defaultExcludedFiles];
  }

  registerDefaultExcludedFiles(filePatterns: string[]): void {
    this.defaultExcludedFiles = this.defaultExcludedFiles.concat(filePatterns);
  }

  deserialize(dump: SerializedData): void {
    if (!dump) {
      return;
    }
    const deepCopy = JSON.parse(JSON.stringify(dump));

    // TODO: verify data before overwriting

    this.solution = deepCopy.solution;

    if (this.solution != null && this.solution.isExplicitSolution == null) {
      if (this.solution.solutionFileUri != null || (this.solution.projects?.length ?? 0) > 1) {
        this.solution.isExplicitSolution = true;
      }
    }

    this.emit(EVENT_SOLUTION_CHANGED, [this.solution]);
  }

  serialize(): SerializedData {
    return { solution: this.solution };
  }

  private buildSolution(baseUri: string, name: string, defaultExcludedFiles: string[]): Solution {
    const solution: Solution = {
      type: 'solution',
      id: crypto.randomUUID(),
      name: name,
      baseUri: baseUri,
      projects: [],
      showHiddenFiles: false,
    };

    return this.addProjectToSolution(solution, baseUri, name, defaultExcludedFiles);
  }

  private addProjectToSolution(
    solution: Solution,
    projectBaseUri: string,
    projectName: string,
    defaultExcludedFiles: string[],
  ): Solution {
    const newProject: Project = {
      type: 'project',
      id: crypto.randomUUID(),
      name: projectName,
      baseUri: projectBaseUri,
      files: {
        included: this.defaultIncludedFiles,
        excluded: [...defaultExcludedFiles, ...this.defaultExcludedFiles],
      },
    };

    const projects = solution.projects.concat([newProject]);

    return { ...solution, projects };
  }
}
