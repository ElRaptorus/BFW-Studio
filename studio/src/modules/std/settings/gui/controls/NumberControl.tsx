import React from 'react';

type NumberControlProps = {
  settingKey: string;
  value: number;
  isInteger: boolean;
  minimum?: number;
  maximum?: number;
  onChange: (value: number) => void;
};

export function NumberControl(props: NumberControlProps): React.JSX.Element {
  return (
    <input
      type="number"
      className="form-control form-control-sm"
      value={props.value}
      step={props.isInteger ? 1 : 'any'}
      min={props.minimum}
      max={props.maximum}
      onChange={(e) => {
        const raw = e.target.value;
        let num = props.isInteger ? parseInt(raw, 10) : parseFloat(raw);
        if (isNaN(num)) {
          return;
        }
        if (props.minimum != null && num < props.minimum) {
          num = props.minimum;
        }
        if (props.maximum != null && num > props.maximum) {
          num = props.maximum;
        }
        props.onChange(num);
      }}
      style={{ maxWidth: 200 }}
    />
  );
}
