import React from 'react';

import type { Studio } from '../../../types/Studio';

type EditorToolbarTextInputProps = {
  studio: Studio;

  /**
   * Current input value.
   */
  value: string;

  /**
   * Called when the input value changes.
   */
  onChange: (value: string) => void;

  /**
   * Placeholder text shown when the input is empty.
   */
  placeholder?: string;

  /**
   * Optional icon displayed inside the input on the left, e.g. "ph ph-magnifying-glass".
   */
  icon?: string;

  /**
   * Tooltip shown on hover.
   */
  tooltip?: string;

  /**
   * A set of additional CSS class names.
   */
  className?: string;

  /**
   * Optional minimum width in pixels. Defaults to 160.
   */
  minWidth?: number;
};

/**
 * A standardized text input for the EditorToolbar. Provides consistent
 * sizing, theming, and focus behavior across all toolbar search/filter fields.
 */
export function EditorToolbarTextInput(props: EditorToolbarTextInputProps): React.JSX.Element {
  const classNames = ['editor-toolbar__text-input'];
  if (props.icon) {
    classNames.push('editor-toolbar__text-input--has-icon');
  }
  if (props.className) {
    classNames.push(props.className);
  }

  const style = props.minWidth !== undefined ? { minWidth: `${props.minWidth}px` } : undefined;

  return (
    <span className="editor-toolbar__text-input-wrapper" title={props.tooltip} style={style}>
      {props.icon && <span className={`${props.icon} editor-toolbar__text-input-icon`} />}
      <input
        className={classNames.join(' ')}
        type="text"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </span>
  );
}
