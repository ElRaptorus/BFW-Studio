import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import type { MenuBarItem_SelectEntry } from '@evil/bifrost_fw_sdk/types/contracts';

import { useBifrost } from '../../bifrostContext';

type MenuBarSelectProps = {
  command: string;
  entries: MenuBarItem_SelectEntry[];
  htmlAttributes: Record<string, any>;
  value: string;

  disabled?: boolean;
  tooltip?: string;
};

export default function MenuBarSelect(props: MenuBarSelectProps): React.JSX.Element {
  const bifrost: Bifrost = useBifrost();
  const disabled = props.disabled === true;
  const value = props.value;
  const onChange = (event: any): void => {
    const selectedValue = event.target.value;
    bifrost.commands.executeCommand(props.command, [selectedValue]);
  };
  const selectProps = { disabled, onChange, value };
  const entries = props.entries || [];
  if (props.entries == null) {
    console.error('<MenuBarSelect /> entries missing', props);
  }

  return (
    <div className="menu-bar__element" {...props.htmlAttributes}>
      <select
        className="form-control form-control-sm"
        {...selectProps}
        data-bs-title={props.tooltip}
        data-bs-toggle="tooltip"
      >
        {entries.map((entry: any) => (
          <option key={`${entry.value}:${entry.label}`} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}
