import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

type DmnJumpLinkProps = {
  studio: Bifrost;
  uri: string;
  elementId: string;
};

/** "Open in new tab" link to an element (or the definitions root) of another solution file. */
export function DmnJumpLink(props: DmnJumpLinkProps): React.JSX.Element {
  const clickHandler = props.studio.commands.getClickHandler();
  return (
    <small>
      <a
        href="#"
        data-test--jump-to-symbol-in-solution
        onClick={clickHandler('std.editor.gotoSymbolInDocument', [props.uri, props.elementId])}
      >
        Open in new tab
      </a>
    </small>
  );
}
