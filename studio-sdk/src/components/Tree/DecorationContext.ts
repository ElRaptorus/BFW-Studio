import React, { useContext, useEffect, useReducer } from 'react';

import type { TreeDecorationSource, TreeItemDecoration } from '../../contracts/TreeTypes';

export const DecorationContext = React.createContext<TreeDecorationSource | null>(null);

export function useDecoration(uri: string | undefined): TreeItemDecoration | null {
  const source = useContext(DecorationContext);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!uri || !source) {
      return;
    }
    const sub = source.subscribe((changedUris) => {
      if (changedUris.has(uri)) {
        forceUpdate();
      }
    });
    return () => sub.dispose();
  }, [uri, source]);

  if (!uri || !source) {
    return null;
  }
  return source.getDecoration(uri);
}
