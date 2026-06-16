import React from 'react';

type StringControlProps = {
  settingKey: string;
  value: string | null;
  onChange: (value: string) => void;
};

export function StringControl(props: StringControlProps): React.JSX.Element {
  return (
    <input
      type="text"
      className="form-control form-control-sm"
      value={props.value ?? ''}
      onChange={(e) => props.onChange(e.target.value)}
      style={{ maxWidth: 400 }}
    />
  );
}
