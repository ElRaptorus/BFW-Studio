import React from 'react';

type EditorTitleCenterProps = React.PropsWithChildren;

export function EditorTitleCenter(props: EditorTitleCenterProps): React.JSX.Element {
  return <div className="editor-title__center">{props.children}</div>;
}
