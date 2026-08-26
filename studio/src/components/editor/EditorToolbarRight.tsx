import React from 'react';

type EditorToolbarRightProps = React.PropsWithChildren;

export function EditorToolbarRight(props: EditorToolbarRightProps): React.JSX.Element {
  return <div className="editor-toolbar__right">{props.children}</div>;
}
