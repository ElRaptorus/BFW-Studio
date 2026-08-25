import type { Bifrost } from '#bifrost/Bifrost';

import type { PropsWithChildren } from 'react';
import React, { use } from 'react';

const BifrostContext = React.createContext<Bifrost>(null as any);

export function useBifrost(): Bifrost {
  return use(BifrostContext);
}

export function BifrostProvider({ value, children }: PropsWithChildren<{ value: Bifrost }>) {
  return <BifrostContext value={value}>{children}</BifrostContext>;
}
