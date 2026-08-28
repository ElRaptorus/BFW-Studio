import type { Bifrost } from '#bifrost/Bifrost';

import React, { useEffect, useState } from 'react';

type JumpToSymbolInSolutionLinkProps = {
  promise: Promise<any>;
  studio: Bifrost;
};

export function JumpToSymbolInSolutionLink(props: JumpToSymbolInSolutionLinkProps): React.JSX.Element | null {
  const [promiseResult, setPromiseResult] = useState<any>(undefined);

  useEffect(() => {
    props.promise.then((result: any) => setPromiseResult(result));
  }, [props.promise]);

  if (promiseResult == null) {
    return null;
  }

  const cmd = props.studio.commands.getClickHandler();
  const symbol = promiseResult;

  if (symbol?.uri) {
    return (
      <small>
        <a
          href="#"
          data-test--jump-to-symbol-in-solution
          onClick={cmd('std.editor.gotoSymbolInDocument', [symbol.uri, symbol.id])}
        >
          Open in new tab
        </a>
      </small>
    );
  }

  return null;
}
