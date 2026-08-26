import { Checkbox } from '#components/Checkbox';

import React from 'react';

type BooleanControlProps = {
  settingKey: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function BooleanControl(props: BooleanControlProps): React.JSX.Element {
  return <Checkbox checked={props.value} onChange={(event) => props.onChange(event.target.checked)} />;
}
