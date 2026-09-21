import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

import { SettingRow } from './SettingRow';

type SettingsGroupProps = {
  studio: Bifrost;
  groupLabel: string;
  settings: {
    key: string;
    descriptor: SettingDescriptor;
    value: unknown;
  }[];
  onOpenJsonEditor: () => void;
};

export function SettingsGroup(props: SettingsGroupProps): React.JSX.Element {
  return (
    <div className="settings-gui__group" id={`settings-category-${props.groupLabel}`} data-category={props.groupLabel}>
      <h3 className="settings-gui__group-label">{props.groupLabel}</h3>
      {props.settings.map((entry) => (
        <SettingRow
          key={entry.key}
          studio={props.studio}
          settingKey={entry.key}
          descriptor={entry.descriptor}
          value={entry.value}
          onOpenJsonEditor={props.onOpenJsonEditor}
        />
      ))}
    </div>
  );
}
