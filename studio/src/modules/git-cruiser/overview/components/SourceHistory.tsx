import type { Bifrost } from '#bifrost/Bifrost';
import type { SourceControlHistoryEntry } from '#bifrost/contracts/SourceControlTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { Icon } from '#components/Icon';

import React from 'react';

import type { DigestState, ExpandedCommit, OverviewFile } from '../SourceOverviewDocumentModel';
import { OVERVIEW_HISTORY_ENTRY_MENU_ID } from '../overviewCommands';
import { ChangeRow } from './ChangeRow';

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * "12 minutes ago", "yesterday", "2 weeks ago". Anything under a minute (or slightly in the future because of a
 * clock difference) is "just now". An unparsable date yields an empty string.
 */
function formatCommitAge(isoDate: string): string {
  const commitTime = Date.parse(isoDate);
  if (Number.isNaN(commitTime)) {
    return '';
  }

  const minutes = Math.floor((Date.now() - commitTime) / MILLISECONDS_PER_MINUTE);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < MINUTES_PER_HOUR) {
    return RELATIVE_TIME_FORMAT.format(-minutes, 'minute');
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return RELATIVE_TIME_FORMAT.format(-hours, 'hour');
  }

  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < 7) {
    return RELATIVE_TIME_FORMAT.format(-days, 'day');
  }
  if (days < 30) {
    return RELATIVE_TIME_FORMAT.format(-Math.floor(days / 7), 'week');
  }
  if (days < 365) {
    return RELATIVE_TIME_FORMAT.format(-Math.min(11, Math.floor(days / 30)), 'month');
  }
  return RELATIVE_TIME_FORMAT.format(-Math.floor(days / 365), 'year');
}

type SourceHistoryProps = {
  bifrost: Bifrost;
  repositoryRoot: string;
  entries: readonly SourceControlHistoryEntry[];
  hasMore: boolean;
  /** The text the list is filtered by; empty when it is not. */
  searchText: string;
  getExpandedCommit: (hash: string) => ExpandedCommit | null;
  getDigest: (file: OverviewFile) => DigestState | null;
  onToggleCommit: (hash: string) => void;
  onLoadMore: () => void;
};

type CommitFilesProps = {
  bifrost: Bifrost;
  repositoryRoot: string;
  entry: SourceControlHistoryEntry;
  expanded: ExpandedCommit;
  getDigest: (file: OverviewFile) => DigestState | null;
};

function CommitFiles(props: CommitFilesProps): React.JSX.Element {
  const { bifrost, repositoryRoot, entry, expanded, getDigest } = props;

  if (expanded === 'loading') {
    return (
      <div className="source-overview__muted source-overview__commit-files">Reading the files of this commit…</div>
    );
  }
  if (expanded.files.length === 0) {
    return <div className="source-overview__muted source-overview__commit-files">This commit changed no files.</div>;
  }

  return (
    <div className="source-overview__commit-files" data-test--commit-files>
      {expanded.files.map((file) => (
        <ChangeRow
          key={file.path}
          bifrost={bifrost}
          repositoryRoot={repositoryRoot}
          file={file}
          digest={getDigest(file)}
          previewCommit={expanded.previewablePaths.has(file.path) ? entry : undefined}
        />
      ))}
    </div>
  );
}

/** The commits of the checked-out branch, newest first. A click on a commit shows the files it changed. */
export function SourceHistory(props: SourceHistoryProps): React.JSX.Element {
  const { bifrost, repositoryRoot, entries, hasMore, searchText, getExpandedCommit, getDigest } = props;

  if (entries.length === 0 && searchText !== '') {
    return (
      <div className="source-overview__empty" data-test--history-no-match>
        No commits match "{searchText}".
      </div>
    );
  }
  if (entries.length === 0) {
    return <div className="source-overview__empty">There are no commits on this branch yet.</div>;
  }

  return (
    <div className="source-overview__history" data-test--history>
      {entries.map((entry) => {
        const expanded = getExpandedCommit(entry.hash);
        const age = formatCommitAge(entry.date);
        return (
          <div key={entry.hash} className="source-overview__commit" data-test--commit>
            <button
              className="source-overview__commit-row"
              data-test--commit-row
              onClick={() => props.onToggleCommit(entry.hash)}
              onContextMenu={(event) => showContextMenu(event, OVERVIEW_HISTORY_ENTRY_MENU_ID, [entry.hash])}
            >
              <span
                className={[
                  'source-overview__commit-marker',
                  entry.mergedBranchName != null && 'source-overview__commit-marker--merge',
                  entry.refs.some((ref) => ref.kind === 'head') && 'source-overview__commit-marker--head',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <Icon id={expanded == null ? 'ph-light ph-caret-right' : 'ph-light ph-caret-down'} />
              <span className="source-overview__commit-subject">{entry.subject}</span>
              {entry.mergedBranchName != null && (
                <span className="source-overview__tag">Merged {entry.mergedBranchName}</span>
              )}
              {entry.refs.map((ref) => (
                <span
                  key={`${ref.kind}:${ref.name}`}
                  className={
                    ref.kind === 'head' || ref.kind === 'local'
                      ? 'source-overview__tag source-overview__tag--local'
                      : 'source-overview__tag'
                  }
                >
                  {ref.name}
                </span>
              ))}
              {entry.isUnpushed && (
                <span className="source-overview__tag source-overview__tag--unpushed">Not pushed</span>
              )}
              <span className="source-overview__muted source-overview__commit-meta">
                {entry.author}
                {age !== '' && ` · ${age}`}
              </span>
            </button>
            {expanded != null && (
              <CommitFiles
                bifrost={bifrost}
                repositoryRoot={repositoryRoot}
                entry={entry}
                expanded={expanded}
                getDigest={getDigest}
              />
            )}
          </div>
        );
      })}
      {hasMore && (
        <button className="btn btn-sm btn-secondary" data-test--history-load-more onClick={props.onLoadMore}>
          Show older commits
        </button>
      )}
    </div>
  );
}
