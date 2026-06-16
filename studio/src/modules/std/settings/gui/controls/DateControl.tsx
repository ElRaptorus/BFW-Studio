import React from 'react';

type DateControlProps = {
  value: string;
  onChange: (value: string) => void;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function DateControl(props: DateControlProps): React.JSX.Element {
  const { value, onChange } = props;
  const inputValue = ISO_DATE.test(value) ? value : '';

  return (
    <input
      type="date"
      className="form-control form-control-sm settings-gui__date-control"
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
