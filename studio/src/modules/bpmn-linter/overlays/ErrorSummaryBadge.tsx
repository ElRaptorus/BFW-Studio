import React from 'react';

import { Icon } from '@evil/bifrost_fw_sdk';

import type { FindingCounts, LintScoreSnapshot } from '../types';

export type ErrorSummaryBadgeProps = {
  counts: FindingCounts;
  scoreSnapshot: LintScoreSnapshot | null;
  isActive: boolean;
  foreignLintingBlocked: boolean;
  onShowProblemsPane: () => void;
};

export function ErrorSummaryBadge(props: ErrorSummaryBadgeProps): React.JSX.Element {
  const { counts, scoreSnapshot, isActive, foreignLintingBlocked, onShowProblemsPane } = props;
  const total = counts.errors + counts.warnings + counts.infos;

  if (!isActive || foreignLintingBlocked) {
    return <></>;
  }

  const scoreSegment =
    scoreSnapshot != null ? (
      <span
        className={`lint-badge__score lint-badge__score--${scoreSnapshot.complianceStatus}`}
        title={`Linter score: ${scoreSnapshot.scorePercentDisplay}`}
      >
        {scoreSnapshot.scorePercentDisplay}
      </span>
    ) : null;

  if (total === 0) {
    return (
      <button className="lint-badge lint-badge--clean" onClick={onShowProblemsPane} type="button">
        <span className="lint-badge__segment">
          <Icon id="bpmn-linter/badge/check" />
          No issues
        </span>
        {scoreSegment}
      </button>
    );
  }

  let severityClass = 'lint-badge--info';
  if (counts.errors > 0) {
    severityClass = 'lint-badge--error';
  } else if (counts.warnings > 0) {
    severityClass = 'lint-badge--warning';
  }

  return (
    <button className={`lint-badge ${severityClass}`} onClick={onShowProblemsPane} type="button">
      {counts.errors > 0 && (
        <span className="lint-badge__segment lint-badge__segment--error">
          <Icon id="bpmn-linter/badge/error" />
          {counts.errors}
        </span>
      )}
      {counts.warnings > 0 && (
        <span className="lint-badge__segment lint-badge__segment--warning">
          <Icon id="bpmn-linter/badge/warning" />
          {counts.warnings}
        </span>
      )}
      {counts.infos > 0 && (
        <span className="lint-badge__segment lint-badge__segment--info">
          <Icon id="bpmn-linter/badge/info" />
          {counts.infos}
        </span>
      )}
      {scoreSegment}
    </button>
  );
}
