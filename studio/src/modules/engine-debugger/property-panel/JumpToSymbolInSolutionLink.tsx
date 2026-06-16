import React, { useCallback, useEffect, useState } from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { EVENT_SYMBOL_INDEX_UPDATED } from '@evil/bifrost_fw_sdk/src/contracts/internal/SymbolEvents';
import type { SymbolResult } from '@evil/bifrost_fw_sdk/types/contracts';

type JumpLinkProps = {
  definitionId: string;
  elementId: string;
  studio: Studio;
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
