/**
 * Returns a `Promise` which resolves once the given `acceptPredicateFn` returns `true`.
 *
 * Waits a maximum of `timeoutInMilliseconds` before rejecting with the given `timeoutMessage`.
 */
export async function waitForAcceptance(
  acceptPredicateFn: () => boolean,
  timeoutMessage: string,
  timeoutInMilliseconds: number = 5000,
  retryInterval: number = 10,
): Promise<void> {
  const maxRetries = timeoutInMilliseconds / retryInterval;

  return new Promise((resolve, reject) => {
    const accepted = acceptPredicateFn.apply(null, []) === true;
    if (accepted) {
      resolve();
    } else {
      let retries = 0;
      const interval = setInterval(() => {
        const accepted = acceptPredicateFn.apply(null, []) === true;
        if (accepted) {
          clearInterval(interval);
          resolve();
        } else {
          retries++;
          if (retries > maxRetries) {
            clearInterval(interval);
            reject(timeoutMessage);
          }
        }
      }, retryInterval);
    }
  });
}
