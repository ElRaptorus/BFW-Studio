import type { Bifrost } from '#bifrost/Bifrost';
import type { SymbolResult } from '#bifrost/contracts/SymbolTypes';
import { EVENT_SYMBOL_INDEX_UPDATED } from '#bifrost/contracts/internal/SymbolEvents';

import React, { useCallback, useEffect, useState } from 'react';

type JumpLinkProps = {
  definitionId: string;
  elementId: string;
  studio: Bifrost;
};

export function JumpToSymbolInSolutionLink(props: JumpLinkProps) {
  const [symbol, setSymbol] = useState<null | SymbolResult>(null);

  const loadSymbol = useCallback(() => {
    props.studio.symbolIndex
      .getAll({ definitionId: props.definitionId, id: props.elementId })
      .then((res) => setSymbol(res[0]));
  }, [props.studio.symbolIndex, props.definitionId, props.elementId]);

  useEffect(() => {
    loadSymbol();
    const subscription = props.studio.symbolIndex.on(EVENT_SYMBOL_INDEX_UPDATED, () => loadSymbol());
    return () => subscription.dispose();
  }, [props.studio.symbolIndex, loadSymbol]);

  if (!symbol) {
    return null;
  }

  const cmd = props.studio.commands.getClickHandler();
  return (
    <small>
      <a href="#" onClick={cmd('std.editor.gotoSymbolInDocument', [symbol.uri, symbol.id])}>
        Jump to Element in Solution
      </a>
    </small>
  );
}
