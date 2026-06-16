import React, { useEffect, useRef } from 'react';

type ColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

const ONCHANGE_TIMEOUT = 200;

export function ColorPicker(props: ColorPickerProps): React.JSX.Element {
  const onChangeTimeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (onChangeTimeoutIdRef.current != null) {
        window.clearTimeout(onChangeTimeoutIdRef.current);
      }
    };
  }, []);

  function onChange(event: any): void {
    const value: string = event.target.value;

    if (onChangeTimeoutIdRef.current != null) {
      window.clearTimeout(onChangeTimeoutIdRef.current);
    }

    onChangeTimeoutIdRef.current = window.setTimeout(() => {
      props.onChange(value);
    }, ONCHANGE_TIMEOUT);
  }

  return (
    <input
      type="color"
      className={props.className}
      defaultValue={props.value}
      onChange={(event) => onChange(event)}
    ></input>
  );
}
