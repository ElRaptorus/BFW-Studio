import React from 'react';

type EditorTitleRightProps = React.PropsWithChildren;

export function EditorTitleRight(props: EditorTitleRightProps): React.JSX.Element {
  return <div className="editor-title__right">{props.children}</div>;
}
