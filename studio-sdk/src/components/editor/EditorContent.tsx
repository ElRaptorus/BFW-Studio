import React from 'react';

type EditorContentProps = React.PropsWithChildren;

export const EditorContent = React.forwardRef<HTMLDivElement, EditorContentProps>(
  function EditorContent(props, ref): React.JSX.Element {
    return (
      <div className="editor__content" ref={ref}>
        {props.children}
      </div>
    );
  },
);
