import React from 'react';

type EditorToolbarLeftProps = React.PropsWithChildren;

export function EditorToolbarLeft(props: EditorToolbarLeftProps): React.JSX.Element {
  return <div className="editor-toolbar__left">{props.children}</div>;
}
