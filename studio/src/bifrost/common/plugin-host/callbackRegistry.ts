/**
 * Global callback registry. Every per-plugin API class registers its
 * callbacks here. This avoids iterating over all loaded plugins to find
 * the owning API — O(1) lookup instead of O(n) per invocation.
 */
const globalCallbackRegistry = new Map<string, (...args: unknown[]) => unknown>();

export function registerGlobalCallback(callbackId: string, callback: (...args: unknown[]) => unknown): void {
  globalCallbackRegistry.set(callbackId, callback);
}

export function unregisterGlobalCallback(callbackId: string): void {
  globalCallbackRegistry.delete(callbackId);
}

export function getGlobalCallback(callbackId: string): ((...args: unknown[]) => unknown) | undefined {
  return globalCallbackRegistry.get(callbackId);
}

export function clearGlobalCallbacks(): void {
  globalCallbackRegistry.clear();
}
