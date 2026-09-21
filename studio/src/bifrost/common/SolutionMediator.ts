import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { WatcherDisposable } from '#bifrost/common/FileHandlingService';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';

import type { Solution } from '../contracts/SolutionTypes';
import type { FileHandlingService } from './FileHandlingService';
import type { LocalStorageItem } from './LocalStorageItem';
import type { Performance } from './Performance';
import type { RecentlyOpenedMediator } from './RecentlyOpenedMediator';
import type { SettingsMediator } from './SettingsMediator';
import { EVENT_SOLUTION_CHANGED, SolutionManager, readSolutionFile, writeSolutionFile } from './SolutionManager';
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

  private solutionEntryUris: Set<string> = new Set();

  constructor(
    fileHandling: FileHandlingService,
    performance: Performance,
    recentlyOpened: RecentlyOpenedMediator,
    settings: SettingsMediator,
    fileExplorerView: FileExplorerView,
    localStorage: LocalStorageItem,
  ) {
    super();
    this.fileHandling = fileHandling;
    this.performance = performance;
    this.recentlyOpened = recentlyOpened;
    this.settings = settings;
    this.fileExplorerView = fileExplorerView;
    this.solutionManager = new SolutionManager();
    this.solutionStorage = localStorage;

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

    this.solutionManager.openSolutionFromFile(solutionFileUri, solutionFileName, foldersWithUris, excludedFiles);

    this.recentlyOpened.addRecentlyOpenedSolutionItem({ uri: solutionFileUri });

    this.disposeAllWatchers();
    for (const folder of foldersWithUris) {
      this.setupWatcherForDirectory(folder.path);
    }
  }

  /**
   * Saves the current solution to a `.bfwsln` file.
   */
  async saveSolutionFile(solutionFileUri: string): Promise<void> {
    const solution = this.solutionManager.getSolution();
    if (solution == null) {
      return;
    }

    await writeSolutionFile(solutionFileUri, solution, this.fileHandling);

    const solutionName = this.fileHandling.getFilename(solutionFileUri).replace(/\.bfwsln$/, '');
    this.solutionManager.setSolutionFileUri(solutionFileUri, solutionName);
  }

  /**
   * Adds a folder to the current solution. If the solution has no `.bfwsln` file yet,
   * the caller must prompt the user to save one first via `saveSolutionFile`.
   */
  addFolderToSolution(directoryUri: string): void {
    const excludedFiles = this.settings.get('std.fileExplorer.exclude');
    this.solutionManager.addFolder(directoryUri, excludedFiles);
    this.setupWatcherForDirectory(directoryUri);
  }

  renameProjectInSolution(projectId: string, newName: string): void {
    this.solutionManager.renameProject(projectId, newName);

    const solution = this.solutionManager.getSolution();
    if (solution?.solutionFileUri != null) {
      writeSolutionFile(solution.solutionFileUri, solution, this.fileHandling);
      this.solutionManager.clearDirty();
    }
  }

  /**
   * Removes a folder (project) from the current solution by its project ID.
   */
  removeFolderFromSolution(projectId: string): void {
    const solution = this.solutionManager.getSolution();
    const project = solution?.projects.find((existingProject) => existingProject.id === projectId);
    if (project != null) {
      this.disposeWatcherForDirectory(project.baseUri);
    }

    this.solutionManager.removeFolder(projectId);

    if (solution?.solutionFileUri != null) {
      const updatedSolution = this.solutionManager.getSolution();
      if (updatedSolution != null) {
        writeSolutionFile(solution.solutionFileUri, updatedSolution, this.fileHandling);
        this.solutionManager.clearDirty();
      }
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
  }
}
