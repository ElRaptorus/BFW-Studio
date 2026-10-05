import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';

export type MergeConflictKind = 'content' | 'ours-deleted' | 'theirs-deleted' | 'added-by-both';

export type MergeFileType = 'bpmn' | 'dmn';

export const EVENT_MERGE_FILE_CHANGED = 'EVENT_MERGE_FILE_CHANGED';
export const EVENT_RESOLUTION_CHANGED = 'EVENT_RESOLUTION_CHANGED';

export type MergeOperationKind = 'merge' | 'rebase' | 'cherry-pick' | null;

export type ElementResolutionStatus =
  'auto-applied' | 'pending' | 'accepted-ours' | 'accepted-theirs' | 'custom' | 'reverted';

/**
 * Conflict key format:
 * - `{elementId}` — base property conflict (type, standard attributes, layout)
 * - `{elementId}:cp:{propertyName}` — individual custom property conflict
 */
export type ConflictKey = string;

export type ElementResolution = {
  readonly key: ConflictKey;
  readonly elementId: string;
  readonly status: ElementResolutionStatus;
};

export type MergeResolutionProgress = {
  readonly totalConflicts: number;
  readonly resolvedConflicts: number;
  readonly isComplete: boolean;
};

/** What type-specific merge panes may read from the merge document model. */
export interface MergeResolverHost extends EditorDocumentModel {
  readonly currentFileType: MergeFileType;
  resolverRef: { current: any } | null;
  getResolutionProgress(): MergeResolutionProgress | null;
}

export type MergeResolverProps = {
  readonly studio: Bifrost;
  readonly blobs: {
    readonly base: string | null;
    readonly ours: string | null;
    readonly theirs: string | null;
  };
  readonly conflictKind: MergeConflictKind;
  readonly operationKind: MergeOperationKind;
  readonly entry: {
    readonly relativePath: string;
    readonly uri: string;
  };
  readonly resolverRef: React.MutableRefObject<any>;
  /** Called by the resolver after it finishes loading data (diffs, viewers, etc.). */
  readonly onDataReady?: () => void;
  /** Called by the resolver when per-element resolution progress changes. */
  readonly onResolutionChanged?: (progress: MergeResolutionProgress) => void;
};
