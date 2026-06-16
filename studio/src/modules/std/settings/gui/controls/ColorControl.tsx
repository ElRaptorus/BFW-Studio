import React from 'react';

import { ColorPicker } from '@evil/bifrost_fw_sdk';

type ColorControlProps = {
  value: string;
  onChange: (value: string) => void;
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function hexForNativePicker(value: string): string {
  return HEX6.test(value) ? value : '#000000';
}

/**
 * Native color wheel (SDK `ColorPicker`) plus a text field for exact hex entry / invalid JSON values.
 */
export function ColorControl(props: ColorControlProps): React.JSX.Element {
  const { value, onChange } = props;
  const pickerValue = hexForNativePicker(value);

  return (
    <div className="settings-gui__color-control">
      <ColorPicker
        key={pickerValue}
        value={pickerValue}
        onChange={onChange}
        className="settings-gui__color-control-swatch"
      />
      <input
        type="text"
        className="form-control form-control-sm settings-gui__color-control-hex"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label="Color value"
      />
    </div>
  );
}
