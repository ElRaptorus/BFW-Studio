import type { Bifrost } from '#bifrost/Bifrost';
import type { ModelChangeDigest, SourceControlHistoryEntry } from '#bifrost/contracts/SourceControlTypes';
import { Icon } from '#components/Icon';

import React from 'react';

import type { DigestState, OverviewFile } from '../SourceOverviewDocumentModel';
import { isModelFile } from '../SourceOverviewDocumentModel';
import { ChangeBadge } from './ChangeBadge';

const MAXIMUM_LISTED_ELEMENT_NAMES = 3;

type ChangeRowProps = {
  bifrost: Bifrost;
  repositoryRoot: string;
  file: OverviewFile;
  digest: DigestState | null;
  /** Offered when a model file was not summarized automatically. */
  onSummarize?: (file: OverviewFile) => void;
  /** The commit whose version of the file can be previewed (and restored from the History Preview). */
  previewCommit?: SourceControlHistoryEntry;
};

function getFileTypeIcon(relativePath: string): { icon: string; label: string } {
  const lowerCasePath = relativePath.toLowerCase();
  if (lowerCasePath.endsWith('.bpmn')) {
    return { icon: 'ph-light ph-flow-arrow', label: 'Process' };
  }
  if (lowerCasePath.endsWith('.dmn')) {
    return { icon: 'ph-light ph-table', label: 'Decision' };
  }
  return { icon: 'ph-light ph-file', label: 'File' };
}

/** One short line, e.g. "2 added · 1 changed · layout moved". */
function formatModelChangeDigest(digest: ModelChangeDigest): string {
  if (digest.fileChange === 'added') {
    return 'New model';
  }
  if (digest.fileChange === 'deleted') {
    return 'Deleted model';
  }

  const parts: string[] = [];
  if (digest.addedElementNames.length > 0) {
    parts.push(`${digest.addedElementNames.length} added`);
  }
  if (digest.modifiedElementNames.length > 0) {
    parts.push(`${digest.modifiedElementNames.length} changed`);
  }
  if (digest.removedElementNames.length > 0) {
    parts.push(`${digest.removedElementNames.length} removed`);
  }
  if (digest.layoutChangedCount > 0) {
    parts.push('layout moved');
  }
  if (digest.fileDetailsChanged) {
    parts.push('file details changed');
  }
  return parts.length > 0 ? parts.join(' · ') : 'No content changes';
}

function describeDigest(file: OverviewFile, digest: DigestState | null): string {
  if (file.status === 'conflicted') {
    return 'Both sides changed this file.';
  }
  if (digest == null) {
    return '';
  }
  if (digest.kind === 'loading') {
    return 'Summarizing…';
  }
  if (digest.kind === 'failed') {
    return 'This file could not be summarized.';
  }

  const elementNames = [
    ...digest.digest.addedElementNames,
    ...digest.digest.modifiedElementNames,
    ...digest.digest.removedElementNames,
  ];
  const listedNames = elementNames.slice(0, MAXIMUM_LISTED_ELEMENT_NAMES).join(', ');
  const moreCount = elementNames.length - MAXIMUM_LISTED_ELEMENT_NAMES;
  const names = moreCount > 0 ? `${listedNames} and ${moreCount} more` : listedNames;
  const headline = formatModelChangeDigest(digest.digest);
  return names === '' ? headline : `${headline}: ${names}`;
}

/**
 * One changed file as a compact row: type icon, status, name and path, and a summary line for models.
 * The main button opens the diff (the conflict resolver for conflicted files); the actions sit beside it.
 */
export function ChangeRow(props: ChangeRowProps): React.JSX.Element {
  const { bifrost, repositoryRoot, file, digest, onSummarize, previewCommit } = props;
  const fileType = getFileTypeIcon(file.path);
  const modelName = digest?.kind === 'ready' ? digest.digest.modelName : null;
  const summary = describeDigest(file, digest);
  const canSummarize = onSummarize != null && digest == null && file.status !== 'conflicted' && isModelFile(file.path);

  const open = (): void => {
    if (file.status === 'conflicted') {
      // The resolver only exists for diagrams; any other conflicted file is opened to edit its markers.
      if (isModelFile(file.path)) {
        bifrost.commands.executeCommand('git.merge.openResolver');
      } else {
        bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [`file://${repositoryRoot}/${file.path}`]);
      }
      return;
    }
    bifrost.commands.executeCommand('git.showChangeDiff', [
      repositoryRoot,
      file.path,
      file.previousPath,
      file.beforeRef,
      file.afterRef,
    ]);
  };

  return (
    <div className="source-overview__change-row" data-test--change-row={isModelFile(file.path) ? 'model' : 'other'}>
      <button
        type="button"
        className="source-overview__change-main"
        title={file.status === 'conflicted' ? 'Resolve the conflict' : 'Show the changes'}
        onClick={open}
      >
        <span className="source-overview__change-line">
          <span className="source-overview__change-type" title={fileType.label}>
            <Icon id={fileType.icon} />
          </span>
          <ChangeBadge status={file.status} />
          {modelName != null && <span className="source-overview__change-name">{modelName}</span>}
          <span className={modelName != null ? 'source-overview__change-path' : 'source-overview__change-name'}>
            {file.path}
          </span>
        </span>
        {summary !== '' && <span className="source-overview__change-summary">{summary}</span>}
      </button>
      <span className="source-overview__change-actions">
        {canSummarize && (
          <button
            type="button"
            className="source-overview__link-button"
            data-test--change-row-summarize
            onClick={() => onSummarize(file)}
          >
            Summarize
          </button>
        )}
        {previewCommit != null && (
          <button
            type="button"
            className="source-overview__icon-button"
            title="Preview this version (restore it from there)"
            aria-label="Preview this version"
            data-test--change-row-preview
            onClick={() =>
              bifrost.commands.executeCommand('git.previewFileVersion', [
                `file://${repositoryRoot}/${file.path}`,
                previewCommit.hash,
                previewCommit.subject,
                previewCommit.author,
                previewCommit.date,
              ])
            }
          >
            <Icon id="ph-light ph-clock-counter-clockwise" />
          </button>
        )}
        {file.afterRef === 'WORKING' && file.status !== 'deleted' && (
          <button
            type="button"
            className="source-overview__icon-button"
            title="Open File"
            aria-label="Open File"
            data-test--change-row-open
            onClick={() =>
              bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [
                `file://${repositoryRoot}/${file.path}`,
              ])
            }
          >
            <Icon id="ph-light ph-arrow-square-out" />
          </button>
        )}
      </span>
    </div>
  );
}
