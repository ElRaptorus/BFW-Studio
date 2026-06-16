import React from 'react';

import { formatSummaryValueForDisplay, partitionCustomPropertyDeltas } from './changeSummaryBuilder';
import type { CustomPropertyDelta } from './customPropertiesDiff';
import './styles/component.custom-property-overview-group.scss';

export type CustomPropertyOverviewVariant = 'change-overview' | 'history-change-overview' | 'bpmn-merge';

const classRoot: Record<CustomPropertyOverviewVariant, string> = {
  'change-overview': 'change-overview',
  'history-change-overview': 'history-change-overview',
  'bpmn-merge': 'bpmn-merge-overview',
};

/**
 * Renders custom property deltas under **Added** / **Removed** / **Changed** sub-headings
 * (no `(removed)` suffixes on property names).
 */
export function CustomPropertyChangeOverviewGroup(props: {
  changes: CustomPropertyDelta[] | undefined;
  variant: CustomPropertyOverviewVariant;
}): React.JSX.Element | null {
  const changes = props.changes ?? [];
  if (changes.length === 0) {
    return null;
  }

  const { added, removed, changed } = partitionCustomPropertyDeltas(changes);
  const root = classRoot[props.variant];

  return (
    <div className={`${root}__custom-props`}>
      <div className={`${root}__custom-props-label`}>Custom properties</div>
      {added.length > 0 && (
        <div className={`${root}__custom-props-group`}>
          <div className={`${root}__custom-props-group-title`}>Added</div>
          <ul className={`${root}__custom-props-list`}>
            {added.map((ch) => (
              <li key={ch.propertyName} className={`${root}__custom-props-item`}>
                {ch.propertyName}: {formatSummaryValueForDisplay(ch.newValue)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {removed.length > 0 && (
        <div className={`${root}__custom-props-group`}>
          <div className={`${root}__custom-props-group-title`}>Removed</div>
          <ul className={`${root}__custom-props-list`}>
            {removed.map((ch) => (
              <li key={ch.propertyName} className={`${root}__custom-props-item`}>
                {ch.propertyName}: {formatSummaryValueForDisplay(ch.oldValue)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {changed.length > 0 && (
        <div className={`${root}__custom-props-group`}>
          <div className={`${root}__custom-props-group-title`}>Changed</div>
          <ul className={`${root}__custom-props-list`}>
            {changed.map((ch) => (
              <li key={ch.propertyName} className={`${root}__custom-props-item`}>
                {ch.propertyName}: {formatSummaryValueForDisplay(ch.oldValue)} →{' '}
                {formatSummaryValueForDisplay(ch.newValue)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
