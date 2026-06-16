import React from 'react';

export type EditorToolbarProps = React.PropsWithChildren;

export function EditorToolbar(props: EditorToolbarProps): React.JSX.Element {
  return <div className="editor-toolbar">{props.children}</div>;
}
