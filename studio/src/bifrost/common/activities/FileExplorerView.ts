import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type {
  TreeBadge,
  TreeDecorationProvider,
  TreeDecorationSource,
  TreeItemDecoration,
  TreeItemStyles,
} from '#bifrost/contracts/TreeTypes';

import type { Bifrost } from '../../Bifrost';
import type { FileOrDirectory } from '../../contracts/FileSystemTypes';
import type { Project, Solution } from '../../contracts/SolutionTypes';
import type { FileHandlingService } from '../FileHandlingService';
import { FilePatternMatcher, computeRelativeUri } from '../FilePatternMatcher';

export type { TreeItemDecoration, TreeDecorationProvider as TreeItemDecorationProvider };

class FileExplorerDecorationSource implements TreeDecorationSource {
  private providers: TreeDecorationProvider[] = [];
  private listeners = new Set<(changedUris: Set<string>) => void>();

  registerProvider(provider: TreeDecorationProvider): void {
    this.providers.push(provider);
    provider.onDidChange((uris) => {
      const uriSet = new Set(uris);
      for (const listener of this.listeners) {
        listener(uriSet);
      }
    });
  }

  getDecoration(uri: string): TreeItemDecoration | null {
    let merged: TreeItemDecoration | null = null;

    for (const provider of this.providers) {
      const decoration = provider.provideDecoration(uri);
      if (decoration == null) {
        continue;
      }

      if (merged == null) {
        merged = {
          styles: decoration.styles ? { ...decoration.styles } : undefined,
          badges: decoration.badges ? [...decoration.badges] : undefined,
        };
      } else {
        if (decoration.styles) {
          merged.styles = { ...merged.styles, ...decoration.styles };
        }
        if (decoration.badges && decoration.badges.length > 0) {
          merged.badges = [...(merged.badges ?? []), ...decoration.badges];
        }
      }
    }

    return merged;
  }

  subscribe(listener: (changedUris: Set<string>) => void): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }
}

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
 * Holds information about the files present in the open solution.
 */
export class FileExplorerView extends AbstractEmitter {
  private bifrost: Bifrost;
  private fileHandling: FileHandlingService;
  private solution: Solution | null;
  private solutionViewData: SolutionViewData | null;
  private readonly decorationSource = new FileExplorerDecorationSource();

  constructor(bifrost: Bifrost, fileHandling: FileHandlingService) {
    super();

    this.bifrost = bifrost;
    this.fileHandling = fileHandling;

    this.solution = null;
    this.solutionViewData = null;
  }

  registerDecorationProvider(provider: TreeDecorationProvider): void {
    this.decorationSource.registerProvider(provider);
  }

  getDecorationSource(): TreeDecorationSource {
    return this.decorationSource;
  }

  clearSolution(): void {
    this.solution = null;
    this.solutionViewData = null;
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
          if (matchingProject != null) {
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
      const isMultiRoot = solution.projects.length > 1 || solution.isExplicitSolution === true;
      const projectViewDataPromiseMap = solution.projects.map((project) =>
        this.getProjectViewData(project, solution.showHiddenFiles, isMultiRoot),
      );

      const resolvedProjectViewData = await Promise.all(projectViewDataPromiseMap);

      if (solutionHasNotChanged && this.solutionViewData != null) {
        const existingEntries = this.solutionViewData.entries;
        for (const projectData of resolvedProjectViewData) {
          const existing = existingEntries.find((e) => e.pathId === projectData.pathId);
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

        this.emit(EVENT_FILE_EXPLORER_OPENED_SOLUTION, [solution.baseUri]);
      }
    }, 30);
  }

  private async getSolutionViewDataWithoutEntries(solution: Solution): Promise<SolutionViewData> {
    const directoryUri = solution.baseUri;

    let labelTooltip: string;
    if (solution.solutionFileUri != null) {
      labelTooltip = this.fileHandling.getLocalFilenameForUri(solution.solutionFileUri);
    } else {
      labelTooltip = await this.fileHandling.getLocalDirectory(directoryUri, true);
    }

    return {
      type: 'section',
      subtype: 'section',
      label: solution.name,
      labelTooltip,
      expanded: true,
      menuId: 'std/file-explorer/solution',
      pathId: directoryUri,
      metadata: { openUriOnClick: false, uri: directoryUri, type: 'solution' },
      showHiddenFiles: solution.showHiddenFiles,
      isExplicitSolution: solution.isExplicitSolution === true,
      entries: [],
    };
  }

  private async getProjectViewData(
    project: Project,
    showHiddenFiles: boolean,
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
      metadata: { openUriOnClick: false, uri: directoryUri, type: 'project' },
      entries: await this.getEntriesForFileList(project, showHiddenFiles),
    };
  }

  private async getEntriesForFileList(project: Project, showHiddenFiles: boolean): Promise<any> {
    const traverse = showHiddenFiles
      ? (cb: (item: FileOrDirectory) => Promise<any>) => this.fileHandling.traverseDirectory(project.baseUri, cb)
      : (cb: (item: FileOrDirectory) => Promise<any>) => this.fileHandling.traverseProject(project, cb);

    const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);

    const entries = await traverse(async (fileOrDirectory: FileOrDirectory) => {
      const { uri, type } = fileOrDirectory;

      const treeNode = this.buildTreeNode(uri, type);
      if (treeNode == null) {
        return null;
      }

      if (!showHiddenFiles) {
        return {
          ...treeNode,
          labelTooltip: this.fileHandling.getLocalFilenameForUri(uri, true),
          styles: {},
        };
      }

      const relativeUri = computeRelativeUri(uri, project.baseUri);
      const styles: any = {};
      let tooltipSuffix = '';

      if (!matcher.isIncluded(relativeUri)) {
        styles.labelColor = 'gray';
        tooltipSuffix = ' (normally not included)';
      }
      if (matcher.isExcluded(relativeUri)) {
        styles.labelColor = 'gray';
        tooltipSuffix = ' (normally excluded)';
      }

      return {
        ...treeNode,
        labelTooltip: this.fileHandling.getLocalFilenameForUri(uri, true) + tooltipSuffix,
        styles: styles,
      };
    });

    return entries;
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
    if (type === 'directory') {
      return {
        type,
        label: this.fileHandling.getFilename(uri),
        labelIcon: 'std/tree/folder-{closed:open}',
        expanded: false,
        menuId: 'std/file-explorer/directory',
        pathId: uri,
        metadata: { openUriOnClick: false, uri, type },
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
        metadata: { openUriOnClick: true, uri, type },
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
