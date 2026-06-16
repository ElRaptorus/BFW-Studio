import React from 'react';

export function TodoMarker(props: any): React.JSX.Element {
  const message = props.message || 'Under construction';
  return (
    <div className="todo">
      <div className="todo__inner">{message}</div>
    </div>
  );
}
