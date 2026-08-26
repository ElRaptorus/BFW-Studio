import type { TreeDecorationSource, TreeItemDecoration } from '#bifrost/contracts/TreeTypes';

import React, { use, useEffect, useReducer } from 'react';

export const DecorationContext = React.createContext<TreeDecorationSource | null>(null);

export function useDecoration(uri: string | undefined): TreeItemDecoration | null {
  const source = use(DecorationContext);
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
