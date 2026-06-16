import type { Bifrost } from '#bifrost/Bifrost';

import type { PropsWithChildren } from 'react';
import React from 'react';

const BifrostContext = React.createContext<Bifrost>(null as any);

export function useBifrost(): Bifrost {
  return React.useContext(BifrostContext);
}

export function BifrostProvider({ value, children }: PropsWithChildren<{ value: Bifrost }>) {
  return <BifrostContext.Provider value={value}>{children}</BifrostContext.Provider>;
}
