import React from 'react';

type ObjectControlProps = {
  settingKey: string;
  onOpenJsonEditor: () => void;
};

export function ObjectControl(props: ObjectControlProps): React.JSX.Element {
  return (
    <button className="btn btn-sm btn-outline-secondary" onClick={props.onOpenJsonEditor}>
      Edit in JSON
    </button>
  );
}
