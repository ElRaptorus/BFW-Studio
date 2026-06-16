import React, { useEffect, useRef, useState } from 'react';

import { showContextMenu } from './ContextMenuFunctions';

type FormInputProps = {
  type: string;
  value: string;
  autoselect?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  htmlId?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onSubmit?: (value: string, event: KeyboardEvent) => void;
  onCancel?: (value: string) => void;
  valueRef?: { current: string };
  htmlAttributes?: object;
};

export function FormInput(props: FormInputProps): React.JSX.Element {
  if (props.onCommit && props.onSubmit) {
    throw new Error('FormInput does not currently support simultaneous onCommit and onSubmit callbacks');
  }

  const valueFromProps = props.value || '';
  const { valueRef } = props;

  const [originalValue, _setOriginalValue] = useState(valueFromProps);
  const [currentValue, setCurrentValue] = useState(valueFromProps);
  const lastSyncedToRef = useRef(valueFromProps);

  const [prevValueFromProps, setPrevValueFromProps] = useState(valueFromProps);
  if (valueFromProps !== prevValueFromProps) {
    setPrevValueFromProps(valueFromProps);
    setCurrentValue(valueFromProps);
  }

  useEffect(() => {
    if (valueRef) {
      valueRef.current = valueFromProps;
      lastSyncedToRef.current = valueFromProps;
    }
  }, [valueFromProps, valueRef]);

  useEffect(() => {
    if (!valueRef) {
      return;
    }
    const checkForExternalMutation = (): void => {
      if (valueRef.current !== lastSyncedToRef.current) {
        const externalValue = valueRef.current;
        lastSyncedToRef.current = externalValue;
        setCurrentValue(externalValue);
      }
    };
    const interval = setInterval(checkForExternalMutation, 50);
    return () => clearInterval(interval);
  }, [valueRef]);

  function syncToRef(value: string): void {
    if (valueRef) {
      valueRef.current = value;
      lastSyncedToRef.current = value;
    }
  }

  const onContextMenuEdit = (value: string): void => {
    if (props.onChange) {
      props.onChange(value);
    }
    syncToRef(value);
    setCurrentValue(value);
  };

  function onChange(event: any): void {
    const value: string = event.target.value;
    if (props.onChange) {
      props.onChange(value);
    }
    syncToRef(value);
    setCurrentValue(value);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (props.onKeyDown) {
      props.onKeyDown(event);
    }

    if (event.key === 'Escape') {
      cancel();
    } else if (event.key === 'Enter') {
      if (props.onSubmit) {
        props.onSubmit(currentValue, event);
      } else {
        commit();
      }
    }
  }

  function blur(e: React.FocusEvent): void {
    if (e.relatedTarget?.className === 'react-contextmenu-item') {
      return;
    }

    if (props.onBlur) {
      props.onBlur();
    } else {
      commit();
    }
  }

  function cancel(): void {
    if (props.onCancel) {
      props.onCancel(currentValue);
    }
    syncToRef(originalValue);
    setCurrentValue(originalValue);
  }

  function commit(): void {
    if (props.onCommit) {
      props.onCommit(currentValue);
    }
  }

  return (
    <input
      id={props.htmlId}
      type={props.type || 'text'}
      className={props.className}
      placeholder={props.placeholder}
      disabled={props.disabled}
      readOnly={props.readonly}
      value={currentValue}
      onKeyDown={(event: any): void => onKeyDown(event)}
      onChange={(e) => onChange(e)}
      onBlur={(e) => blur(e)}
      onContextMenu={(event) => showContextMenu(event, 'std/component/input/text', [event.target, onContextMenuEdit])}
      autoFocus={props.autoselect}
      {...props.htmlAttributes}
    />
  );
}
