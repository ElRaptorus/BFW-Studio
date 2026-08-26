import React from 'react';

type EditorContentProps = React.PropsWithChildren<{
  ref?: React.Ref<HTMLDivElement>;
}>;

export function EditorContent({ ref, children }: EditorContentProps): React.JSX.Element {
  return (
    <div className="editor__content" ref={ref}>
      {children}
    </div>
  );
}
