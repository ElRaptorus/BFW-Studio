import { createRoot } from 'react-dom/client';

import React from 'react';

import App from '../../../src/App';
import { createAndInitializeBifrost } from '../../../src/createAndInitializeBifrost';
import { BifrostProvider } from '../../bifrostContext';
import type { Bifrost } from '../Bifrost';
import { initializeBifrostWindowOpenMagic } from '../common/WindowOpenMagicFunctions';
import type { BifrostOptions } from '../contracts/BifrostTypes';
import { getOperatingSystem } from './BrowserFunctions';
import { SearchIndex } from './SearchIndex';
import { SymbolIndex } from './SymbolIndex';

// Turn on debugging output in console
window.localStorage.debug = 'bifrost:*';

async function main(): Promise<void> {
  const client = 'web';
  const os = getOperatingSystem();
  const performanceEntries: any[] = [];
  const options: BifrostOptions = {
    client,
    os,
    performanceEntries,
    localStorageInstance: window.localStorage,
    searchIndexConstructor: SearchIndex,
    symbolIndexConstructor: SymbolIndex,
  };

  const uiRoot = document.getElementById('root')!;
  const bifrost: Bifrost = await createAndInitializeBifrost(uiRoot, options);

  initializeBifrostWindowOpenMagic(bifrost);

  (window as any).bifrost = bifrost;

  const root = createRoot(uiRoot);
  root.render(
    <BifrostProvider value={bifrost}>
      <App />
    </BifrostProvider>,
  );
}

main();
