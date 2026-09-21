import React from 'react';

import type { DecisionDefinition } from '@elraptorus/bfw_engine_sdk';

import './VersionSelector.scss';

interface VersionSelectorProps {
  versions: DecisionDefinition[];
  selectedVersion: string | null;
  onVersionChange: (version: string | null) => void;
  disabled?: boolean;
}

export function VersionSelector(props: VersionSelectorProps): React.JSX.Element | null {
  if (props.versions.length === 0) {
    return null;
  }

  return (
    <select
      className="engine-decision-version-selector"
      value={props.selectedVersion ?? ''}
      onChange={(event) => {
        const value = event.target.value;
        props.onVersionChange(value === '' ? null : value);
      }}
      disabled={props.disabled}
      title="Switch decision version"
    >
      <option value="">Latest</option>
      {props.versions.map((version) => (
        <option key={version.version ?? version.id} value={version.version ?? ''}>
          {version.version ?? '(no version)'}
          {version.enabled === false ? ' (disabled)' : ''}
        </option>
      ))}
    </select>
  );
}
