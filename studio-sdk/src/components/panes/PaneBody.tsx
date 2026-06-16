import React from 'react';

type PaneBodyProps = {
  children?: any;
};

export const PaneBody = React.forwardRef<HTMLDivElement, PaneBodyProps>(
  function PaneBody(props, ref): React.JSX.Element {
    return (
      <div ref={ref} className="pane__content">
        {props.children}
      </div>
    );
  },
);
