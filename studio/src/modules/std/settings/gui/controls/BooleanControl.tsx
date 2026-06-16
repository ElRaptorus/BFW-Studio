import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { Checkbox } from '@evil/bifrost_fw_sdk';

type BooleanControlProps = {
  studio: Studio;
  settingKey: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function BooleanControl(props: BooleanControlProps): React.JSX.Element {
  return (
    <Checkbox studio={props.studio} checked={props.value} onChange={(event) => props.onChange(event.target.checked)} />
  );
}
