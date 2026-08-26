import React from 'react';

type PaneProps = {
  children?: any;
  classNames?: string;
};

export function Pane(props: PaneProps): React.JSX.Element {
  const classNames = props.classNames ? props.classNames : '';

  return <div className={`pane__inner ${classNames}`}>{props.children}</div>;
}
