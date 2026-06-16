import React from 'react';

type EditorToolbarCenterProps = React.PropsWithChildren;

export function EditorToolbarCenter(props: EditorToolbarCenterProps): React.JSX.Element {
  return <div className="editor-toolbar__center">{props.children}</div>;
}
