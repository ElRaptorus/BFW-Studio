import React from 'react';

import type { SanitizableIssue, SanitizerIssueSeverity } from './sanitizerTypes';

export type SanitizerBadgeProps = {
  findings: SanitizableIssue[];
  onShowInInspector: () => void;
};

function worstSeverity(findings: SanitizableIssue[]): SanitizerIssueSeverity {
  let hasWarning = false;
  for (const finding of findings) {
    if (finding.severity === 'error') {
      return 'error';
    }
    if (finding.severity === 'warning') {
      hasWarning = true;
    }
  }
  return hasWarning ? 'warning' : 'info';
}

const SEVERITY_ICON: Record<SanitizerIssueSeverity, string> = {
  error: 'ph ph-warning',
  warning: 'ph ph-warning',
  info: 'ph ph-info',
};

const SEVERITY_CSS: Record<SanitizerIssueSeverity, string> = {
  error: 'sanitizer-badge--error',
  warning: 'sanitizer-badge--warning',
  info: 'sanitizer-badge--info',
};

export function SanitizerBadge(props: SanitizerBadgeProps): React.JSX.Element {
  const { findings, onShowInInspector } = props;

  if (findings.length === 0) {
    return <></>;
  }

  const severity = worstSeverity(findings);
  const count = findings.length;
  const tooltip = `Sanitizer found ${count} issue${count !== 1 ? 's' : ''}. Click to view the report`;

  return (
    <button
      className={`sanitizer-badge ${SEVERITY_CSS[severity]}`}
      data-test--sanitizer-badge
      onClick={onShowInInspector}
      type="button"
      title={tooltip}
    >
      <i className={SEVERITY_ICON[severity]} />
      <span>{count}</span>
    </button>
  );
}
