import React, { useState } from 'react';

import { showContextMenu } from './ContextMenuFunctions';

type TextAreaProps = {
  value: string;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  htmlAttributes?: object;
};

export function TextArea(props: TextAreaProps): React.JSX.Element {
  const valueFromProps = props.value || '';

  const [originalValue, _setOriginalValue] = useState(valueFromProps);
  const [currentValue, setCurrentValue] = useState(valueFromProps);

  const [prevValueFromProps, setPrevValueFromProps] = useState(valueFromProps);
  if (valueFromProps !== prevValueFromProps) {
    setPrevValueFromProps(valueFromProps);
    setCurrentValue(valueFromProps);
  }

  const onContextMenuEdit = (value: string): void => {
    if (props.onChange) {
      props.onChange(value);
    }

    setCurrentValue(value);
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape') {
      cancel();
    } else if (event.key === 'Enter') {
      commit();
    }
  }

  function onChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    const value: string = event.target.value;

    setCurrentValue(value);
  }

  function blur(e: React.FocusEvent): void {
    if (e.relatedTarget?.className === 'react-contextmenu-item') {
      return;
    }

    props.onBlur?.();
    commit();
  }

  function cancel(): void {
    setCurrentValue(originalValue);
  }

  function commit(): void {
    props.onChange?.(currentValue.trim());
  }

  return (
    <textarea
      className={props.className}
      placeholder={props.placeholder}
      value={currentValue}
      onKeyDown={(e) => onKeyDown(e)}
      onChange={(e) => onChange(e)}
      onBlur={(e) => blur(e)}
      onContextMenu={(event) => showContextMenu(event, 'std/component/input/text', [event.target, onContextMenuEdit])}
      {...props.htmlAttributes}
    ></textarea>
  );
}
