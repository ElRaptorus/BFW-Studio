import type { StoredLinterScore } from '#modules/bpmn-core/scanSolutionBpmnModels';

import React from 'react';

import type { DeployItemStatus } from '../analysis/types';
import type { LinterBadgePresentation } from './formatDeployBadges';
import { describeDeployStatus, describeStoredLinterScore } from './formatDeployBadges';

export function DeployStatusBadge(props: { status: DeployItemStatus; count?: number }): React.JSX.Element {
  const presentation = describeDeployStatus(props.status);
  return (
    <span
      className={`deploy-badge deploy-badge--${presentation.tone}`}
      title={presentation.tooltip}
      {...{ [props.count == null ? 'data-test--deploy-item-status' : 'data-test--deploy-folder-status']: props.status }}
    >
      {presentation.label}
      {props.count != null ? ` ${props.count}` : ''}
    </span>
  );
}

export function LinterBadge(props: { presentation: LinterBadgePresentation }): React.JSX.Element {
  return (
    <span
      className={`deploy-badge deploy-badge--linter deploy-badge--linter-${props.presentation.verdict}`}
      title={props.presentation.tooltip}
    >
      {props.presentation.label}
    </span>
  );
}

export function LinterScoreBadges(props: { scores: readonly StoredLinterScore[] }): React.JSX.Element {
  const presentations = props.scores
    .map((score) => ({ key: score.rulesetId, presentation: describeStoredLinterScore(score) }))
    .filter((entry): entry is { key: string; presentation: LinterBadgePresentation } => entry.presentation != null);
  if (presentations.length === 0) {
    return <span className="deploy-plan__muted">–</span>;
  }
  return (
    <span className="deploy-badge-group">
      {presentations.map((entry) => (
        <LinterBadge key={entry.key} presentation={entry.presentation} />
      ))}
    </span>
  );
}
