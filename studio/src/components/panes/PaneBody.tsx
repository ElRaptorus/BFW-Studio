import React from 'react';

type PaneBodyProps = {
  children?: any;
  ref?: React.Ref<HTMLDivElement>;
};

export function PaneBody({ ref, children }: PaneBodyProps): React.JSX.Element {
  return (
    <div ref={ref} className="pane__content">
      {children}
    </div>
  );
}
