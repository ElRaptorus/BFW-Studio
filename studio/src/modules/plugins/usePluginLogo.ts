import type { Bifrost } from '#bifrost/Bifrost';
import * as fs from 'fs/promises';

import { useEffect, useMemo, useState } from 'react';

/**
 * Asynchronously loads a plugin logo from disk and returns a data URI.
 * Results are cached in a module-level map so repeated renders
 * (and multiple components using the same logo) do not re-read the file.
 *
 * Call {@link clearLogoCache} before triggering a re-render to force
 * all logos to be re-read from disk (e.g. after a plugin refresh).
 */
export function usePluginLogo(bifrost: Bifrost, logoPath: string | undefined): string | null {
  const cachedValue = useMemo(() => bifrost.plugins.getCachedLogo(logoPath), [bifrost.plugins, logoPath]);
  const [asyncResult, setAsyncResult] = useState<{ path: string; uri: string } | null>(null);

  useEffect(() => {
    if (!logoPath || bifrost.plugins.isLogoCached(logoPath)) {
      return;
    }

    let cancelled = false;

    fs.readFile(logoPath)
      .then((buffer) => {
        const base64 = buffer.toString('base64');
        const uri = `data:image/png;base64,${base64}`;
        bifrost.plugins.cacheLogo(logoPath, uri);
        if (!cancelled) {
          setAsyncResult({ path: logoPath, uri });
        }
      })
      .catch(() => {
        // Logo could not be read — leave as null
      });

    return () => {
      cancelled = true;
    };
  }, [bifrost.plugins, logoPath]);

  if (cachedValue) {
    return cachedValue;
  }
  if (asyncResult != null && asyncResult.path === logoPath) {
    return asyncResult.uri;
  }
  return null;
}
