import React from 'react';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

import { SettingRow } from './SettingRow';

export type SettingsGuiEntry = {
  key: string;
  descriptor: SettingDescriptor;
  value: unknown;
  isModified: boolean;
  resetTooltip: string;
  overriddenIn: string | null;
};

type SettingsGroupProps = {
  groupLabel: string;
  settings: SettingsGuiEntry[];
  onChange: (key: string, value: unknown) => void;
  onReset: (key: string) => void;
  onOpenJsonEditor: () => void;
};

export function SettingsGroup(props: SettingsGroupProps): React.JSX.Element {
  return (
    <div className="settings-gui__group" id={`settings-category-${props.groupLabel}`} data-category={props.groupLabel}>
      <h3 className="settings-gui__group-label">{props.groupLabel}</h3>
      {props.settings.map((entry) => (
        <SettingRow
          key={entry.key}
          settingKey={entry.key}
          descriptor={entry.descriptor}
          value={entry.value}
          isModified={entry.isModified}
          resetTooltip={entry.resetTooltip}
          overriddenIn={entry.overriddenIn}
          onChange={(value) => props.onChange(entry.key, value)}
          onReset={() => props.onReset(entry.key)}
          onOpenJsonEditor={props.onOpenJsonEditor}
        />
      ))}
    </div>
  );
}
