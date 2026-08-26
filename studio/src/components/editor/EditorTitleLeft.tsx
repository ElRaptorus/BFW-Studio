import React from 'react';

type EditorTitleLeftProps = React.PropsWithChildren;

export function EditorTitleLeft(props: EditorTitleLeftProps): React.JSX.Element {
  return <div className="editor-title__left">{props.children}</div>;
}
