import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { ExplorerDefinition } from '#bifrost/contracts/ExplorerTypes';
import type { TreeBadge, TreeItemStyles } from '#bifrost/contracts/TreeTypes';

import type { Bifrost } from '../../Bifrost';
import type { FileOrDirectory } from '../../contracts/FileSystemTypes';
import type { Project, Solution } from '../../contracts/SolutionTypes';
import type { FileHandlingService } from '../FileHandlingService';
import { FilePatternMatcher, computeRelativeUri } from '../FilePatternMatcher';

type SolutionViewData = {
  type: string;
  subtype: string;
  label: string;
  labelIcon?: string;
  labelTooltip?: string;
  menuId?: string;
  metadata?: any;
  expanded: boolean;
  showHiddenFiles: boolean;
  isExplicitSolution: boolean;
  pathId: string;
  entries: ProjectViewData[];
  styles?: TreeItemStyles;
  badges?: TreeBadge[];
};

type ProjectViewData = {
  type: string;
  label: string;
  labelIcon?: string;
  labelTooltip?: string;
  menuId?: string;
  metadata?: any;
  uri: string; // usually a directory
  expanded: boolean;
  pathId: string;
  entries?: any[];
  styles?: TreeItemStyles;
  badges?: TreeBadge[];
};

type ProtectedFolder = { viewId: string; uri: string };

export const EVENT_FILE_EXPLORER_OPENED_SOLUTION = 'EVENT_FILE_EXPLORER_OPENED_SOLUTION';

const PROJECT_LOADING_ENTRY = {
  type: 'loading-indicator',
  label: 'loading ...',
  uri: 'loading-indicator',
  expanded: false,
  pathId: 'loading-indicator',
  styles: { labelColor: 'gray' },
};

/**
 * The tree one explorer shows: the projects of the open solution (with view folders marked protected),
 * or the folder of one solution view.
 */
export class FileExplorerView extends AbstractEmitter {
  private bifrost: Bifrost;
  private fileHandling: FileHandlingService;
  private definition: ExplorerDefinition;
  private solution: Solution | null;
  private solutionViewData: SolutionViewData | null;
  private fileUris: Set<string> = new Set();

  constructor(bifrost: Bifrost, fileHandling: FileHandlingService, definition: ExplorerDefinition) {
    super();

    this.bifrost = bifrost;
    this.fileHandling = fileHandling;
    this.definition = definition;

    this.solution = null;
    this.solutionViewData = null;
  }

  getDefinition(): ExplorerDefinition {
    return this.definition;
  }

  clearSolution(): void {
    this.solution = null;
    this.solutionViewData = null;
    this.fileUris = new Set();
    this.emit(EVENT_FILE_EXPLORER_OPENED_SOLUTION, [null]);
  }

  async setSolution(solution: Solution): Promise<void> {
    const solutionHasNotChanged = solution?.id === this.solution?.id;
    const solutionViewDataWithoutEntries = await this.getSolutionViewDataWithoutEntries(solution);
    const loadingBadges: TreeBadge[] = [{ type: 'icon', icon: 'std/tree/loading' }];

    if (solutionHasNotChanged && this.solutionViewData != null) {
      this.solution = { ...solution };
      this.solutionViewData = {
        ...this.solutionViewData,
        badges: loadingBadges,
        entries: this.solutionViewData.entries.map((existingEntry) => {
          const matchingProject = solution.projects.find((project) => project.baseUri === existingEntry.uri);
          if (matchingProject != null && this.definition.source.kind === 'solution') {
            return { ...existingEntry, label: matchingProject.name };
          }
          return existingEntry;
        }),
      };
    } else {
      this.solution = { ...solution };
      this.solutionViewData = {
        ...solutionViewDataWithoutEntries,
        badges: loadingBadges,
        entries: [PROJECT_LOADING_ENTRY],
      };
    }
    this.emit(EVENT_FILE_EXPLORER_OPENED_SOLUTION, [solution.baseUri]);

    setTimeout(async () => {
      const resolvedProjectViewData = await this.buildRootEntries(solution);

      if (solutionHasNotChanged && this.solutionViewData != null) {
        const existingEntries = this.solutionViewData.entries;
        for (const projectData of resolvedProjectViewData) {
          const existing = existingEntries.find((entry) => entry.pathId === projectData.pathId);
          if (existing != null) {
            projectData.expanded = existing.expanded;
          }
        }
      }

      const newSolutionData = {
        ...solutionViewDataWithoutEntries,
        badges: [],
        entries: resolvedProjectViewData,
      };

      const solutionStillCurrent = solution?.id === this.solution?.id;
      if (solutionStillCurrent) {
        this.solutionViewData = newSolutionData;
        this.fileUris = new Set();
        this.traverse((entry) => {
          if (entry.type === 'file' && entry.metadata?.uri) {
            this.fileUris.add(entry.metadata.uri);
          }
        });

        this.emit(EVENT_FILE_EXPLORER_OPENED_SOLUTION, [solution.baseUri]);
      }
    }, 30);
  }

  /** `true` when the tree shows a file with this URI. */
  containsFile(uri: string): boolean {
    return this.fileUris.has(uri);
  }

  /** `true` when the tree shows at least one file. */
  hasFiles(): boolean {
    return this.fileUris.size > 0;
  }

  private async getSolutionViewDataWithoutEntries(solution: Solution): Promise<SolutionViewData> {
    const directoryUri = solution.baseUri;
    const isSolutionSource = this.definition.source.kind === 'solution';

    let labelTooltip: string;
    if (solution.solutionFileUri != null) {
      labelTooltip = this.fileHandling.getLocalFilenameForUri(solution.solutionFileUri);
    } else {
      labelTooltip = await this.fileHandling.getLocalDirectory(directoryUri, true);
    }

    return {
      type: 'section',
      subtype: 'section',
      label: this.definition.label ?? solution.name,
      labelTooltip,
      expanded: true,
      menuId: isSolutionSource ? 'std/file-explorer/solution' : undefined,
      pathId: directoryUri,
      metadata: { openUriOnClick: false, uri: directoryUri, type: 'solution', explorerId: this.definition.id },
      showHiddenFiles: this.showsHiddenFiles(solution),
      isExplicitSolution: isSolutionSource && solution.isExplicitSolution === true,
      entries: [],
    };
  }

  private showsHiddenFiles(solution: Solution): boolean {
    return this.definition.structuralOperations === true && solution.showHiddenFiles;
  }

  private async buildRootEntries(solution: Solution): Promise<ProjectViewData[]> {
    const source = this.definition.source;
    if (source.kind === 'solution') {
      const isMultiRoot = solution.projects.length > 1 || solution.isExplicitSolution === true;
      return Promise.all(solution.projects.map((project) => this.getProjectViewData(project, solution, isMultiRoot)));
    }

    const viewUri = solution.solutionFileUri != null ? solution.views?.[source.viewId]?.uri : undefined;
    if (viewUri == null) {
      return [];
    }
    const viewProject: Project = {
      type: 'project',
      id: `view:${source.viewId}`,
      name: this.definition.label ?? source.viewId,
      baseUri: viewUri,
      files: {
        included: [...source.includedFiles],
        excluded: [
          ...(this.bifrost.settings.get('std.fileExplorer.exclude') ?? []),
          ...this.bifrost.solution.getDefaultExcludedFiles(),
        ],
      },
    };
    try {
      return [await this.getProjectViewData(viewProject, solution, false)];
    } catch {
      // The view folder does not exist (yet); the explorer shows its empty state.
      return [];
    }
  }

  private async getProjectViewData(
    project: Project,
    solution: Solution,
    isMultiRoot: boolean,
  ): Promise<ProjectViewData> {
    const directoryUri = project.baseUri;

    return {
      type: 'project',
      label: project.name,
      labelIcon: isMultiRoot ? 'std/tree/project-{closed:open}' : 'std/tree/folder-{closed:open}',
      labelTooltip: await this.fileHandling.getLocalDirectory(directoryUri, true),
      uri: directoryUri,
      pathId: directoryUri,
      expanded: true,
      menuId: isMultiRoot ? 'std/file-explorer/solution-root' : 'std/file-explorer/project',
      metadata: { openUriOnClick: false, uri: directoryUri, type: 'project', explorerId: this.definition.id },
      entries: await this.getEntriesForFileList(project, solution),
    };
  }

  private getViewManager(viewId: string): string {
    const viewExplorer = this.bifrost.explorers.getViewExplorer(viewId);
    return viewExplorer?.label != null ? `the ${viewExplorer.label} explorer` : 'its own page';
  }

  private getProtectedFolders(solution: Solution): ProtectedFolder[] {
    if (this.definition.source.kind !== 'solution' || solution.solutionFileUri == null) {
      return [];
    }
    return Object.entries(solution.views ?? {}).map(([viewId, view]) => ({ viewId, uri: view.uri }));
  }

  private async getEntriesForFileList(project: Project, solution: Solution): Promise<any> {
    const showHiddenFiles = this.showsHiddenFiles(solution);
    const traverse = showHiddenFiles
      ? (callback: (item: FileOrDirectory) => Promise<any>) =>
          this.fileHandling.traverseDirectory(project.baseUri, callback)
      : (callback: (item: FileOrDirectory) => Promise<any>) => this.fileHandling.traverseProject(project, callback);

    const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);
    const protectedFolders = this.getProtectedFolders(solution);

    const entries = await traverse(async (fileOrDirectory: FileOrDirectory) => {
      const { uri, type } = fileOrDirectory;

      const treeNode = this.buildTreeNode(uri, type);
      if (treeNode == null) {
        return null;
      }

      const styles: any = {};
      let tooltipSuffix = '';

      if (showHiddenFiles) {
        const relativeUri = computeRelativeUri(uri, project.baseUri);
        if (!matcher.isIncluded(relativeUri)) {
          styles.labelColor = 'gray';
          tooltipSuffix = ' (normally not included)';
        }
        if (matcher.isExcluded(relativeUri)) {
          styles.labelColor = 'gray';
          tooltipSuffix = ' (normally excluded)';
        }
      }

      const protectedFolder = protectedFolders.find((folder) => uri === folder.uri || uri.startsWith(`${folder.uri}/`));
      if (protectedFolder != null) {
        styles.labelColor = 'gray';
        treeNode.metadata.protected = true;
        treeNode.metadata.protectedViewId = protectedFolder.viewId;
        if (uri === protectedFolder.uri) {
          tooltipSuffix = ` (${protectedFolder.viewId} folder of this solution; read-only here, managed in ${this.getViewManager(protectedFolder.viewId)})`;
        }
      }

      return {
        ...treeNode,
        labelTooltip: this.fileHandling.getLocalFilenameForUri(uri, true) + tooltipSuffix,
        styles,
      };
    });

    return (this.definition.emptyDirectories ?? 'hide') === 'hide' ? pruneEmptyDirectories(entries) : entries;
  }

  traverse(itemCallback: (entry: any) => void, entry: any = this.solutionViewData): void {
    if (entry == null) {
      return;
    }
    itemCallback.apply(null, [entry]);

    if (entry.entries) {
      entry.entries.forEach((subEntry: any) => this.traverse(itemCallback, subEntry));
    }
  }

  getViewData(): any {
    return { solution: this.solutionViewData };
  }

  private buildTreeNode(uri: string, type: string): any | null {
    const explorerId = this.definition.id;
    if (type === 'directory') {
      return {
        type,
        label: this.fileHandling.getFilename(uri),
        labelIcon: 'std/tree/folder-{closed:open}',
        expanded: false,
        menuId: 'std/file-explorer/directory',
        pathId: uri,
        metadata: { openUriOnClick: false, uri, type, explorerId },
        entries: [],
      };
    }

    if (type === 'file') {
      return {
        type,
        label: this.fileHandling.getFilename(uri),
        labelIcon: this.getIconForFileType(uri),
        menuId: 'std/file-explorer/file',
        pathId: uri,
        metadata: { openUriOnClick: true, uri, type, explorerId },
      };
    }

    return null;
  }

  private getIconForFileType(uri: string): string {
    if (!this.bifrost.editors.hasDocumentTypeDefinitionForUri(uri)) {
      return 'std/tree/file';
    }

    const editorDocumentDefinition = this.bifrost.editors.getDocumentTypeDefinitionByUri(uri);

    return editorDocumentDefinition.icon || 'std/tree/file';
  }
}

function pruneEmptyDirectories(entries: any[]): any[] {
  return entries.flatMap((entry) => {
    if (entry.type !== 'directory') {
      return [entry];
    }
    const children = pruneEmptyDirectories(entry.entries ?? []);
    return children.length > 0 ? [{ ...entry, entries: children }] : [];
  });
}
