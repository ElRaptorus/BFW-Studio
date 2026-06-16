import React from 'react';

type EditorTitleProps = React.PropsWithChildren;

export function EditorTitle(props: EditorTitleProps): React.JSX.Element {
  return <div className="editor-title">{props.children}</div>;
}
