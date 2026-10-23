import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { WatcherDisposable } from '#bifrost/common/FileHandlingService';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';

import type { Solution } from '../contracts/SolutionTypes';
import type { FileHandlingService } from './FileHandlingService';
import type { LocalStorageItem } from './LocalStorageItem';
import type { Performance } from './Performance';
import type { RecentlyOpenedMediator } from './RecentlyOpenedMediator';
import type { SettingsMediator } from './SettingsMediator';
import {
  SolutionFileUnreadableError,
  readSolutionFile,
  repairSolutionFile,
  writeSolutionFolders,
  writeSolutionView,
} from './SolutionFile';
import { isUriIncludedInSolution } from './SolutionFunctions';
import { EVENT_SOLUTION_CHANGED, SolutionManager } from './SolutionManager';
import type { FileExplorerView } from './activities';
import { EVENT_FILE_EXPLORER_OPENED_SOLUTION } from './activities';

const DEFAULT_EXCLUDED_FILES = ['.*', '**/.*', 'node_modules', '**/node_modules'];
const UPDATE_SOLUTION_TIMEOUT = 300;

export class SolutionMediator extends AbstractEmitter {
  private fileHandling: FileHandlingService;
  private performance: Performance;
  private recentlyOpened: RecentlyOpenedMediator;
  private settings: SettingsMediator;
  private fileExplorerView: FileExplorerView;
  private solutionManager: SolutionManager;
  private solutionStorage: LocalStorageItem;
  private watchers: Map<string, WatcherDisposable> = new Map();
  private watchSolutionTimeoutId: number | null = null;
  private viewFolderWatcherUris: Set<string> = new Set();

  private solutionEntryUris: Set<string> = new Set();
  private offerSolutionFileRepair: (error: SolutionFileUnreadableError) => Promise<boolean>;

  constructor(
    fileHandling: FileHandlingService,
    performance: Performance,
    recentlyOpened: RecentlyOpenedMediator,
    settings: SettingsMediator,
    fileExplorerView: FileExplorerView,
    localStorage: LocalStorageItem,
    offerSolutionFileRepair: (error: SolutionFileUnreadableError) => Promise<boolean>,
  ) {
    super();
    this.fileHandling = fileHandling;
    this.performance = performance;
    this.recentlyOpened = recentlyOpened;
    this.settings = settings;
    this.fileExplorerView = fileExplorerView;
    this.solutionManager = new SolutionManager();
    this.solutionStorage = localStorage;
    this.offerSolutionFileRepair = offerSolutionFileRepair;

    this.solutionManager.on(EVENT_SOLUTION_CHANGED, (solution: Solution) => {
      const solutionDatas = this.solutionManager.serialize();
      this.solutionStorage.save(solutionDatas);

      this.emit(EVENT_SOLUTION_CHANGED, [solution]);
    });

    this.settings.register({
      'std.fileExplorer.exclude': {
        category: 'General',
        type: 'array',
        label: 'Excluded Files',
        description: 'Glob patterns for files and folders to exclude from the file explorer.',
        default: DEFAULT_EXCLUDED_FILES,
        items: { type: 'string' },
      },
    });

    this.settings.on(EVENT_SETTINGS_CHANGED, (key, value) => {
      if (key === 'std.fileExplorer.exclude') {
        const solution = this.getSolution();
        if (solution == null) {
          return;
        }

        if (solution.solutionFileUri != null) {
          this.openSolutionFile(solution.solutionFileUri);
        } else if (solution.projects.length > 0) {
          this.openDirectoryAsSolution(solution.projects[0].baseUri);
        }
      }
    });

    const solutionData = this.solutionStorage.load();
    this.solutionManager.deserialize(solutionData);

    const getSolutionEntryUris = () => {
      this.solutionEntryUris = new Set();
      this.fileExplorerView.traverse((entry) => {
        if (entry.type === 'file' && entry.metadata?.uri) {
          this.solutionEntryUris.add(entry.metadata.uri);
        }
      });
    };

    this.fileExplorerView.on(EVENT_FILE_EXPLORER_OPENED_SOLUTION, () => {
      getSolutionEntryUris();
    });
  }

  /**
   * Returns `true` if the open solution contains a document with the given `uri`.
   */
  containsEditorDocumentWithUri(uri: string): boolean {
    if (!this.fileHandling.isLocalFilename(uri)) {
      console.warn(`containsEditorDocumentWithUri is not implemented for non-file protocols: ${uri}`);
      return false;
    }

    return this.solutionEntryUris.has(uri);
  }

  /**
   * Returns the currently opened solution (or `null`).
   */
  getSolution(): Solution | null {
    return this.solutionManager.getSolution();
  }

  /**
   * Returns `true` if there is an open solution.
   */
  hasOpenSolution(): boolean {
    return this.solutionManager.hasOpenSolution();
  }

  /**
   * Files of the open solution whose URI matches `pattern` and pass the solution include/exclude rules, sorted by URI.
   */
  async listIncludedFileUris(pattern: RegExp): Promise<string[]> {
    const solution = this.getSolution();
    if (solution == null) {
      return [];
    }

    const uris = new Set<string>();
    for (const project of solution.projects) {
      await this.fileHandling.traverseProject(project, async (fileOrDirectory) => {
        if (
          fileOrDirectory.type === 'file' &&
          pattern.test(fileOrDirectory.uri) &&
          isUriIncludedInSolution(solution, fileOrDirectory.uri)
        ) {
          uris.add(fileOrDirectory.uri);
        }
        return fileOrDirectory;
      });
    }

    return [...uris].sort((first, second) => first.localeCompare(second));
  }

  /**
   * Opens a directory in the local file system as solution using the given `directoryUri`.
   */
  openDirectoryAsSolution(directoryUri: string): void {
    this.performance.mark(`bifrost:files:open-solution ${directoryUri} #start`);

    const name = this.fileHandling.getFilename(directoryUri);
    const excludedFiles = this.settings.get('std.fileExplorer.exclude');
    this.solutionManager.openDirectoryAsSolution(directoryUri, name, excludedFiles);

    this.recentlyOpened.addRecentlyOpenedSolutionItem({ uri: directoryUri });

    this.disposeAllWatchers();
    this.setupWatcherForDirectory(directoryUri);
  }

  /**
   * Opens a `.bfwsln` solution file, creating a multi-root solution from its contents.
   */
  async openSolutionFile(solutionFileUri: string): Promise<void> {
    this.performance.mark(`bifrost:files:open-solution-file ${solutionFileUri} #start`);

    const solutionFileContent = await readSolutionFile(solutionFileUri, this.fileHandling);
    const solutionFileName = this.fileHandling.getFilename(solutionFileUri).replace(/\.bfwsln$/, '');
    const excludedFiles = this.settings.get('std.fileExplorer.exclude');

    const foldersWithUris = solutionFileContent.folders.map((folder) => ({
      ...folder,
      path: this.fileHandling.getUriForFilename(folder.path),
    }));

    this.solutionManager.openSolutionFromFile(
      solutionFileUri,
      solutionFileName,
      foldersWithUris,
      excludedFiles,
      solutionFileContent.views,
    );

    this.recentlyOpened.addRecentlyOpenedSolutionItem({ uri: solutionFileUri });

    this.disposeAllWatchers();
    for (const folder of foldersWithUris) {
      this.setupWatcherForDirectory(folder.path);
    }
    this.syncViewFolderWatchers();
  }

  /**
   * The folder the saved solution file declares for `viewId` (`views.<viewId>` in the `.bfwsln`),
   * or `null` without a saved solution file or without that entry. The folder may not exist on disk.
   */
  getViewFolderUri(viewId: string): string | null {
    const solution = this.getSolution();
    if (solution?.solutionFileUri == null) {
      return null;
    }
    return solution.views?.[viewId]?.uri ?? null;
  }

  /**
   * Declares `folderUri` as the folder of `viewId` in the saved solution file (written relative to it),
   * or removes the entry when `folderUri` is `null`. Returns `false` when the solution file could not be written.
   */
  async setViewFolder(viewId: string, folderUri: string | null): Promise<boolean> {
    const solutionFileUri = this.getSolution()?.solutionFileUri;
    if (solutionFileUri == null) {
      throw new Error(`Save the solution as a .bfwsln file before setting the "${viewId}" folder.`);
    }
    try {
      await writeSolutionView(solutionFileUri, this.fileHandling, viewId, folderUri);
    } catch (error) {
      if (!(error instanceof SolutionFileUnreadableError)) {
        throw error;
      }
      await this.offerSolutionFileRepair(error);
      return false;
    }
    this.solutionManager.setView(viewId, folderUri);
    this.syncViewFolderWatchers();
    return true;
  }

  /**
   * Saves the current solution to a `.bfwsln` file.
   */
  async saveSolutionFile(solutionFileUri: string): Promise<boolean> {
    const solution = this.solutionManager.getSolution();
    if (solution == null) {
      return false;
    }

    const saved = await this.persistSolutionFolders(solutionFileUri);
    if (!saved) {
      return false;
    }

    const solutionName = this.fileHandling.getFilename(solutionFileUri).replace(/\.bfwsln$/, '');
    this.solutionManager.setSolutionFileUri(solutionFileUri, solutionName);
    return true;
  }

  async repairSolutionFile(solutionFileUri: string): Promise<string | null> {
    const solution = this.solutionManager.getSolution();
    if (solution == null) {
      throw new Error('No solution is open.');
    }
    return repairSolutionFile(solutionFileUri, solution, this.fileHandling);
  }

  /**
   * Adds a folder to the current solution. If the solution has no `.bfwsln` file yet,
   * the caller must prompt the user to save one first via `saveSolutionFile`.
   */
  addFolderToSolution(directoryUri: string): void {
    const excludedFiles = this.settings.get('std.fileExplorer.exclude');
    this.solutionManager.addFolder(directoryUri, excludedFiles);
    this.setupWatcherForDirectory(directoryUri);
    this.syncViewFolderWatchers();
  }

  async renameProjectInSolution(projectId: string, newName: string): Promise<void> {
    this.solutionManager.renameProject(projectId, newName);

    const solution = this.solutionManager.getSolution();
    if (solution?.solutionFileUri != null && (await this.persistSolutionFolders(solution.solutionFileUri))) {
      this.solutionManager.clearDirty();
    }
  }

  /**
   * Removes a folder (project) from the current solution by its project ID.
   */
  async removeFolderFromSolution(projectId: string): Promise<void> {
    const solution = this.solutionManager.getSolution();
    const project = solution?.projects.find((existingProject) => existingProject.id === projectId);
    if (project != null) {
      this.disposeWatcherForDirectory(project.baseUri);
    }

    this.solutionManager.removeFolder(projectId);
    this.syncViewFolderWatchers();

    if (solution?.solutionFileUri != null && (await this.persistSolutionFolders(solution.solutionFileUri))) {
      this.solutionManager.clearDirty();
    }
  }

  private async persistSolutionFolders(solutionFileUri: string): Promise<boolean> {
    const solution = this.solutionManager.getSolution();
    if (solution == null) {
      return false;
    }
    try {
      await writeSolutionFolders(solutionFileUri, solution, this.fileHandling);
      return true;
    } catch (error) {
      if (!(error instanceof SolutionFileUnreadableError)) {
        throw error;
      }
      return this.offerSolutionFileRepair(error);
    }
  }

  isSolutionDirty(): boolean {
    return this.solutionManager.isSolutionDirty();
  }

  closeSolution(): void {
    this.disposeAllWatchers();
    this.solutionManager.closeSolution();
  }

  onRefresh(): void {
    this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]);
  }

  async onElementAdded(uri: string): Promise<void> {
    this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]);
  }

  async onElementsRemoved(uris: string[]): Promise<void> {
    this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]);
  }

  async onElementRenamed(uri: string): Promise<void> {
    this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]);
  }

  async onElementMoved(uri: string): Promise<void> {
    this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]);
  }

  /**
   * Gets all filePatterns which are shown in the File Explorer by default.
   **/
  getDefaultIncludedFiles(): string[] {
    return this.solutionManager.getDefaultIncludedFiles();
  }

  /**
   * Adds `filePatterns` which are shown in the File Explorer by default.
   *
   * Examples:
   *
   *    bifrost.solution.registerDefaultIncludedFiles(['*.txt']);
   */
  registerDefaultIncludedFiles(filePatterns: string[]): void {
    this.solutionManager.registerDefaultIncludedFiles(filePatterns);
  }

  /**
   * Removes `filePatterns` previously added via {@link registerDefaultIncludedFiles}.
   *
   * Intended for plugins, which can be disabled, reloaded, or uninstalled at runtime — unlike
   * built-in modules, which register their patterns once for the lifetime of the process.
   */
  unregisterDefaultIncludedFiles(filePatterns: string[]): void {
    this.solutionManager.unregisterDefaultIncludedFiles(filePatterns);
  }

  /**
   * Gets all filePatterns which are excluded from the File Explorer by default.
   */
  getDefaultExcludedFiles(): string[] {
    return this.solutionManager.getDefaultExcludedFiles();
  }

  /**
   * Adds `filePatterns` which are excluded from the File Explorer by default.
   *
   * Example: `bifrost.solution.registerDefaultExcludedFiles(['target'])`
   */
  registerDefaultExcludedFiles(filePatterns: string[]): void {
    this.solutionManager.registerDefaultExcludedFiles(filePatterns);
  }

  toggleHiddenFiles(): void {
    this.solutionManager.toggleHiddenFiles();
  }

  clearInstance(): void {
    this.solutionStorage.clear();
  }

  private setupWatcherForDirectory(directoryUri: string): void {
    try {
      const excludedFiles = this.settings.get('std.fileExplorer.exclude');
      const allExcluded = [...excludedFiles, ...this.solutionManager.getDefaultExcludedFiles()];
      const watcherDisposable = this.fileHandling.watchDirectory(
        directoryUri,
        () => {
          if (this.watchSolutionTimeoutId != null) {
            window.clearTimeout(this.watchSolutionTimeoutId);
          }

          this.watchSolutionTimeoutId = window.setTimeout(
            () => this.emit(EVENT_SOLUTION_CHANGED, [this.solutionManager.getSolution()]),
            UPDATE_SOLUTION_TIMEOUT,
          );
        },
        allExcluded,
      );
      this.watchers.set(directoryUri, watcherDisposable);
    } catch (error) {
      console.warn(error);
    }
  }

  /** View folders outside every project get their own watcher, so their explorers refresh like a project. */
  private syncViewFolderWatchers(): void {
    const solution = this.getSolution();
    const wanted = new Set(
      Object.values(solution?.views ?? {})
        .map((view) => view.uri)
        .filter(
          (uri) =>
            !solution?.projects.some((project) => uri === project.baseUri || uri.startsWith(`${project.baseUri}/`)),
        ),
    );
    for (const uri of this.viewFolderWatcherUris) {
      if (!wanted.has(uri)) {
        this.disposeWatcherForDirectory(uri);
        this.viewFolderWatcherUris.delete(uri);
      }
    }
    for (const uri of wanted) {
      if (!this.viewFolderWatcherUris.has(uri) && !this.watchers.has(uri)) {
        this.setupWatcherForDirectory(uri);
        this.viewFolderWatcherUris.add(uri);
      }
    }
  }

  private disposeWatcherForDirectory(directoryUri: string): void {
    const watcher = this.watchers.get(directoryUri);
    if (watcher != null) {
      watcher.dispose();
      this.watchers.delete(directoryUri);
    }
  }

  private disposeAllWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.viewFolderWatcherUris.clear();
  }
}
