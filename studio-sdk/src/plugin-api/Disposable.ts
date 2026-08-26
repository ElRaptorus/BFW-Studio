/**
 * Handle returned by plugin-api subscription / registration methods.
 * Call `dispose()` to unregister the callback.
 */
export interface Disposable {
  dispose(): void;
}
