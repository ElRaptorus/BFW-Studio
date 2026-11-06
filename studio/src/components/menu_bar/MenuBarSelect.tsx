import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItem_SelectEntry } from '#bifrost/contracts/MenuBarTypes';

import React from 'react';

import { useBifrost } from '../../bifrostContext';
import { Icon } from '../Icon';

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

  const hasEntryIcons = entries.some((entry) => entry.icon != null);

  const selectClassName = hasEntryIcons
    ? 'form-control form-control-sm menu-bar__select--with-icons'
    : 'form-control form-control-sm';

  return (
    <div className="menu-bar__element" {...props.htmlAttributes}>
      <select
        className={selectClassName}
        {...selectProps}
        aria-label={props.tooltip}
        data-bs-title={props.tooltip}
        data-bs-toggle="tooltip"
      >
        {hasEntryIcons ? (
          <>
            <button type="button">{React.createElement('selectedcontent')}</button>
            {entries.map((entry) => (
              <option
                key={`${entry.value}:${entry.label}`}
                value={entry.value}
                aria-label={entry.iconLabel == null ? undefined : `${entry.label} (${entry.iconLabel})`}
              >
                {entry.icon != null ? (
                  <span key={entry.icon} className="menu-bar__option-icon" aria-hidden="true">
                    <Icon id={entry.icon} />
                  </span>
                ) : null}
                <span className="menu-bar__option-label">{entry.label}</span>
              </option>
            ))}
          </>
        ) : (
          entries.map((entry) => (
            <option key={`${entry.value}:${entry.label}`} value={entry.value}>
              {entry.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
