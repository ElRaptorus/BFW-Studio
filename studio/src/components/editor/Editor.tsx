import React, { Fragment } from 'react';

export type EditorProps = React.PropsWithChildren;

export function Editor(props: EditorProps): React.JSX.Element {
  return <Fragment>{props.children}</Fragment>;
}
