/**
 * API available inside plugin webview iframes via `acquireStudioApi()`.
 *
 * The bridge script (`/studio-bridge.js`) is injected by the Studio into
 * every plugin iframe and exposes this API on `window.acquireStudioApi()`.
 *
 * All communication with the Plugin Host goes through `postMessage` /
 * `onMessage`; the webview has no direct access to Node.js or Electron APIs.
 */
export interface StudioWebviewApi {
  /**
   * Send a message from the webview to the Plugin Host.
   * The plugin receives it via `api.webviews.onMessage(iframeId, callback)`.
   *
   * @param data - Serializable data to send.
   */
  postMessage(data: unknown): void;

  /**
   * Register a handler for messages sent from the Plugin Host via
   * `api.webviews.postMessage(iframeId, data)`.
   *
   * Only one handler is active at a time; calling this again replaces the previous one.
   *
   * @param callback - Called with the deserialized message data.
   */
  onMessage(callback: (data: unknown) => void): void;

  /**
   * Persist arbitrary state that survives iframe reloads.
   * The state is automatically restored via the `restore-state` bridge message.
   *
   * @param state - Serializable state object.
   */
  setState(state: unknown): void;

  /**
   * Retrieve the last state set via {@link setState}, or `undefined` if none was set.
   */
  getState(): unknown;

  /**
   * Returns the current Studio theme type (e.g. `"dark"` or `"light"`).
   * Reads from `document.documentElement.getAttribute('data-theme')`.
   */
  getThemeType(): string;
}

/**
 * Typed wrapper for data received in an {@link StudioWebviewApi.onMessage} callback.
 *
 * Use this to narrow the `unknown` payload to a known shape:
 *
 * @example
 * ```typescript
 * interface MyMessage { type: string; payload: number }
 * api.onMessage((data: unknown) => {
 *   const msg = data as WebviewMessageEvent<MyMessage>;
 *   console.log(msg.type, msg.payload);
 * });
 * ```
 *
 * @typeParam T - The expected shape of the deserialized message data.
 */
export type WebviewMessageEvent<T = unknown> = T;

/**
 * Global augmentation so plugin webview code can call `acquireStudioApi()`
 * without a manual type cast.
 *
 * @example
 * ```typescript
 * const api = acquireStudioApi();
 * api.postMessage({ type: 'ready' });
 * ```
 */
declare global {
  interface Window {
    acquireStudioApi?(): StudioWebviewApi;
  }
}
