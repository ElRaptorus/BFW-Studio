import React, { useEffect, useRef, useState } from 'react';

import type { MenuItem } from '../contracts/MenuTypes';
import { PresentationalContextMenu } from './PresentationalContextMenu';

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

type ContextMenuState = {
  x: number;
  y: number;
};

export function FormInput(props: FormInputProps): React.JSX.Element {
  if (props.onCommit && props.onSubmit) {
    throw new Error('FormInput does not currently support simultaneous onCommit and onSubmit callbacks');
  }

  const valueFromProps = props.value || '';
  const { valueRef } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  const [originalValue] = useState(valueFromProps);
  const [currentValue, setCurrentValue] = useState(valueFromProps);
  const lastSyncedToRef = useRef(valueFromProps);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

  function onChange(event: React.ChangeEvent<HTMLInputElement>): void {
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

  function blur(event: React.FocusEvent): void {
    const related = event.relatedTarget as HTMLElement | null;
    if (related?.closest('.studio-presentational-context-menu') != null) {
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

  function openContextMenu(event: React.MouseEvent<HTMLInputElement>): void {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }

  async function runContextMenuCommand(command: string): Promise<void> {
    const input = inputRef.current;
    if (input == null) {
      return;
    }

    const value = input.value;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? value.length;
    const noSelection = selectionStart === selectionEnd;
    const selection = noSelection ? value : value.substring(selectionStart, selectionEnd);

    switch (command) {
      case 'std.internal.cutToClipboard': {
        await navigator.clipboard.writeText(selection);
        const newValue = noSelection ? '' : value.substring(0, selectionStart) + value.substring(selectionEnd);
        input.value = newValue;
        onContextMenuEdit(newValue);
        break;
      }
      case 'std.internal.copyToClipboard': {
        await navigator.clipboard.writeText(selection);
        break;
      }
      case 'std.internal.pasteFromClipboard': {
        const clipboardText = await navigator.clipboard.readText();
        const newValue = value.substring(0, selectionStart) + clipboardText + value.substring(selectionEnd);
        input.value = newValue;
        onContextMenuEdit(newValue);
        break;
      }
      case 'std.internal.clear': {
        input.value = '';
        onContextMenuEdit('');
        input.focus();
        break;
      }
      case 'std.internal.selectAll': {
        input.focus();
        input.select();
        break;
      }
      default:
        break;
    }
  }

  const canMutate = !props.disabled && !props.readonly;
  const contextMenuItems: MenuItem[] = [
    {
      type: 'command',
      label: 'Cut',
      id: 'std/component/input/text/cut',
      command: 'std.internal.cutToClipboard',
      visible: canMutate,
    },
    {
      type: 'command',
      label: 'Copy',
      id: 'std/component/input/text/copy',
      command: 'std.internal.copyToClipboard',
    },
    {
      type: 'command',
      label: 'Paste',
      id: 'std/component/input/text/paste',
      command: 'std.internal.pasteFromClipboard',
      visible: canMutate,
    },
    {
      type: 'command',
      label: 'Clear',
      id: 'std/component/input/text/clear',
      command: 'std.internal.clear',
      visible: canMutate,
    },
    {
      type: 'command',
      label: 'Select All',
      id: 'std/component/input/text/select-all',
      command: 'std.internal.selectAll',
    },
  ];

  return (
    <>
      <input
        ref={inputRef}
        id={props.htmlId}
        type={props.type || 'text'}
        className={props.className}
        placeholder={props.placeholder}
        disabled={props.disabled}
        readOnly={props.readonly}
        value={currentValue}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>): void => onKeyDown(event.nativeEvent)}
        onChange={(e) => onChange(e)}
        onBlur={(e) => blur(e)}
        onContextMenu={openContextMenu}
        autoFocus={props.autoselect}
        {...props.htmlAttributes}
      />
      {contextMenu != null && (
        <PresentationalContextMenu
          items={contextMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onCommand={(command) => {
            void runContextMenuCommand(command);
          }}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
