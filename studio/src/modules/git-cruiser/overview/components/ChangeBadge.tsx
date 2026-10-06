import React from 'react';

import type { OverviewFile } from '../SourceOverviewDocumentModel';

const BADGE_LABELS: Record<OverviewFile['status'], string> = {
  modified: 'Modified',
  added: 'New',
  deleted: 'Deleted',
  renamed: 'Renamed',
  conflicted: 'Conflict',
};

/** The coloured word that says what happened to a file. */
export function ChangeBadge(props: { status: OverviewFile['status'] }): React.JSX.Element {
  return (
    <span className={`source-overview__badge source-overview__badge--${props.status}`} data-test--change-badge>
      {BADGE_LABELS[props.status]}
    </span>
  );
}
