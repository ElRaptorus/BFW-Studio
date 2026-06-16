import type { Bifrost } from '#bifrost/Bifrost';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';

import { EditorDocumentModel } from '@evil/bifrost_fw_sdk';

import type { GitService } from '../GitService';
import { EVENT_MERGE_FILE_CHANGED, EVENT_RESOLUTION_CHANGED } from '../GitTypes';
import type {
  GitConflictBlobs,
  GitFileStatus,
  GitMergeStateType,
  MergeConflictKind,
  MergeFileEntry,
  MergeFileType,
  MergeProgress,
} from '../GitTypes';

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svg',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.mkv',
  '.sqlite',
  '.db',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.json': 'json',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.sh': 'shell',
  '.bash': 'shell',
  '.py': 'python',
  '.rb': 'ruby',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.toml': 'toml',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.env': 'plaintext',
  '.txt': 'plaintext',
  '.csv': 'plaintext',
  '.log': 'plaintext',
};

export function getLanguageForFile(filePath: string): string {
  const ext = getFileExtension(filePath);
  return LANGUAGE_MAP[ext] ?? 'plaintext';
}

function getFileExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.');
  return dotIndex >= 0 ? filePath.substring(dotIndex).toLowerCase() : '';
}

function classifyFileType(filePath: string): MergeFileType {
  if (filePath.endsWith('.bpmn')) {
    return 'bpmn';
  }
  if (filePath.endsWith('.dmn')) {
    return 'dmn';
  }
  const ext = getFileExtension(filePath);
  if (BINARY_EXTENSIONS.has(ext)) {
    return 'binary';
  }
  return 'text';
}

/**
 * Generic merge document model.
 *
 * Manages the list of conflicted files, blob loading, progress tracking,
 * and navigation — without any knowledge of how specific file types are
 * visualized. Type-specific behaviour is delegated via the registered
 * merge resolver component and the command dispatch pattern.
 */
export default class MergeDocumentModel extends EditorDocumentModel {
  public bifrost: Bifrost;
  public fileLoader: ILoadable;

  public conflictedFiles: MergeFileEntry[] = [];
  public currentFileIndex = 0;
  public conflictKind: MergeConflictKind = 'content';

  public blobs: GitConflictBlobs | null = null;

  public textOurs: string | null = null;
  public textTheirs: string | null = null;

  /**
   * Optional reference set by type-specific resolvers so that commands
   * can reach into the resolver instance (e.g. for zoom, conflict nav).
   */
  public resolverRef: any = null;

  /**
   * Per-element resolution progress for the current file, updated by the
   * resolver via the `onResolutionChanged` callback.
   */
  public resolutionProgress: { totalConflicts: number; resolvedConflicts: number; isComplete: boolean } | null = null;

  protected gitService: GitService;
  protected repoRoot: string;
  private gitStatusDisposer: (() => void) | null = null;

  constructor(uri: string, _restoredCurrentData: any, _restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri);

    this.fileLoader = fileLoader;
    this.bifrost = bifrost;
    this.repoRoot = '';

    this.gitService = bifrost.commands.executeCommand<GitService>('git.getGitServiceRef');
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<MergeDocumentModel> {
    const model = new MergeDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    await model.initialize();
    return model;
  }

  protected async initialize(): Promise<void> {
    const repoRoot = this.resolveRepoRoot();
    if (repoRoot == null) {
      throw new Error('No Git repository selected');
    }
    this.repoRoot = repoRoot;

    this.populateConflictedFileList();
    if (this.conflictedFiles.length === 0) {
      this.closeSelf();
      return;
    }

    await this.loadFile(0);
    this.subscribeToGitStatusChanges();
  }

  private subscribeToGitStatusChanges(): void {
    const subscription = this.bifrost.events.on('gitStatusChanged' as any, () => {
      this.syncResolvedState();
      this.emitProgressUpdate();
    });

    this.gitStatusDisposer = () => subscription.dispose();
  }

  private resolveRepoRoot(): string | null {
    const explicit = this.gitService.getSelectedRepo();
    if (explicit != null) {
      return explicit;
    }

    const focusedUri = this.bifrost.editors.getFocusedEditorDocument()?.uri;
    if (focusedUri) {
      const repoRoot = this.gitService.getRepoRootForUri(focusedUri);
      if (repoRoot != null) {
        return repoRoot;
      }
    }

    const allStates = this.gitService.getAllRepoStates();

    const withConflicts = allStates.find((state) => state.mergeState.conflictedFiles.length > 0);
    if (withConflicts) {
      return withConflicts.repoRoot;
    }

    const merging = allStates.find((state) => state.mergeState?.kind != null);
    if (merging) {
      return merging.repoRoot;
    }

    if (allStates.length === 1) {
      return allStates[0].repoRoot;
    }

    return null;
  }

  get includeNonBpmn(): boolean {
    return this.bifrost.settings.get('gitCruiser.merge.includeNonBpmn') === true;
  }

  get currentFileType(): MergeFileType {
    const entry = this.getCurrentEntry();
    return entry?.fileType ?? 'bpmn';
  }

  reloadFileList(): void {
    this.populateConflictedFileList();
    this.emitProgressUpdate();
    if (this.conflictedFiles.length > 0) {
      const clampedIndex = Math.min(this.currentFileIndex, this.conflictedFiles.length - 1);
      this.loadFile(clampedIndex);
    } else {
      this.closeSelf();
    }
  }

  private populateConflictedFileList(): void {
    const state = this.gitService.getRepoState(this.repoRoot);
    if (state == null) {
      return;
    }

    const includeNonBpmn = this.includeNonBpmn;
    this.conflictedFiles = state.mergeState.conflictedFiles
      .filter((file) => {
        const fileType = classifyFileType(file.path);
        return fileType === 'bpmn' || fileType === 'dmn' || (includeNonBpmn && fileType === 'text');
      })
      .map((gitFile: GitFileStatus) => ({
        relativePath: gitFile.path,
        uri: gitFile.uri,
        resolved: false,
        fileType: classifyFileType(gitFile.path),
      }));
  }

  private syncResolvedState(): void {
    const state = this.gitService.getRepoState(this.repoRoot);
    if (state == null) {
      return;
    }

    const stillConflictedPaths = new Set(state.mergeState.conflictedFiles.map((file) => file.path));

    for (const entry of this.conflictedFiles) {
      if (!entry.resolved && !stillConflictedPaths.has(entry.relativePath)) {
        entry.resolved = true;
      }
    }
  }

  async loadFile(index: number): Promise<void> {
    if (index < 0 || index >= this.conflictedFiles.length) {
      this.closeSelf();
      return;
    }

    this.currentFileIndex = index;
    this.resolutionProgress = null;
    const entry = this.conflictedFiles[index];

    this.blobs = await this.gitService.getConflictBlobs(this.repoRoot, entry.relativePath);

    if (this.blobs.ours === null) {
      this.conflictKind = 'ours-deleted';
    } else if (this.blobs.theirs === null) {
      this.conflictKind = 'theirs-deleted';
    } else if (this.blobs.base === null) {
      this.conflictKind = 'added-by-both';
    } else {
      this.conflictKind = 'content';
    }

    if (entry.fileType === 'text') {
      this.textOurs = this.blobs.ours;
      this.textTheirs = this.blobs.theirs;
    } else {
      this.textOurs = null;
      this.textTheirs = null;
    }

    await this.onFileLoaded();

    this.emitProgressUpdate();
    this.emit(EVENT_MERGE_FILE_CHANGED, []);
  }

  /**
   * Hook for subclasses to perform type-specific processing after blobs
   * are loaded and conflict kind is determined.
   */
  protected async onFileLoaded(): Promise<void> {
    // No-op in the generic model.
  }

  getProgress(): MergeProgress {
    const total = this.conflictedFiles.length;
    const remaining = this.conflictedFiles.filter((file) => !file.resolved).length;
    return {
      current: this.currentFileIndex + 1,
      total,
      remaining,
    };
  }

  getCurrentEntry(): MergeFileEntry | null {
    return this.conflictedFiles[this.currentFileIndex] ?? null;
  }

  advanceToNext(): boolean {
    const nextIndex = this.conflictedFiles.findIndex((file, idx) => idx > this.currentFileIndex && !file.resolved);

    if (nextIndex !== -1) {
      this.loadFile(nextIndex);
      return true;
    }

    const wrapIndex = this.conflictedFiles.findIndex((file, idx) => idx !== this.currentFileIndex && !file.resolved);
    if (wrapIndex !== -1) {
      this.loadFile(wrapIndex);
      return true;
    }

    const allResolved = this.conflictedFiles.every((file) => file.resolved);
    if (allResolved) {
      this.closeSelf();
    }

    return false;
  }

  markCurrentResolved(): void {
    const entry = this.conflictedFiles[this.currentFileIndex];
    if (entry) {
      entry.resolved = true;
    }
  }

  getRepoRoot(): string {
    return this.repoRoot;
  }

  /**
   * Resolves the editor document type string for the current file (e.g. "bpmn"),
   * or `null` if no document type is registered for the file's extension.
   */
  getFileDocumentType(): string | null {
    const entry = this.getCurrentEntry();
    if (entry == null) {
      return null;
    }
    try {
      const typeDef = this.bifrost.editors.getDocumentTypeDefinitionByUri(entry.uri);
      return typeDef.documentType;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the merge resolver component for the current file's document type,
   * or `null` if no resolver is registered (triggers the text fallback).
   */
  resolveResolverComponent(): any | null {
    const entry = this.getCurrentEntry();
    if (entry == null) {
      return null;
    }
    return this.bifrost.editors.getMergeResolverForUri(entry.uri);
  }

  /**
   * Called by the renderer when the type-specific resolver has finished
   * loading its data (diffs, viewers, etc.), so that dependent UI (e.g.
   * the Merge Changes pane) can re-read the resolver's imperative API.
   */
  public notifyResolverReady(): void {
    this.emit(EVENT_MERGE_FILE_CHANGED, []);
  }

  /**
   * Called by the renderer when the resolver reports resolution progress changes.
   */
  public updateResolutionProgress(progress: {
    totalConflicts: number;
    resolvedConflicts: number;
    isComplete: boolean;
  }): void {
    this.resolutionProgress = progress;
    this.emit(EVENT_RESOLUTION_CHANGED, []);
    this.emitProgressUpdate();
  }

  public getResolutionProgress(): { totalConflicts: number; resolvedConflicts: number; isComplete: boolean } | null {
    return this.resolutionProgress;
  }

  public isCurrentFileFullyResolved(): boolean {
    return this.resolutionProgress?.isComplete === true;
  }

  public getMergeStateType(): GitMergeStateType {
    const state = this.gitService.getRepoState(this.repoRoot);
    return state?.mergeState.kind ?? 'merge';
  }

  public getMergeStateTypeCapitalized(): string {
    const state = this.getMergeStateType() ?? 'merge';
    return `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
  }

  protected emitProgressUpdate(): void {
    const progress = this.getProgress();
    const entry = this.getCurrentEntry();
    this.updateMetadata({
      mergeProgress: progress,
      currentFile: entry?.relativePath ?? null,
      conflictKind: this.conflictKind,
      resolutionProgress: this.resolutionProgress,
    });
  }

  protected closeSelf(): void {
    const doc = this.bifrost.editors.getOpenEditorDocuments().find((ed) => ed.uri === this.uri);
    if (doc) {
      this.bifrost.editors.closeEditorDocument(doc);
    }
  }

  onEditorDocumentWillClose(): void {
    this.gitStatusDisposer?.();
    this.gitStatusDisposer = null;
  }
}
