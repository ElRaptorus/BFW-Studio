import type { Disposable } from './Disposable';
import type { WebviewPanelOptions } from './types';

/**
 * Webview panel creation and messaging API.
 *
 * Use this API to create standalone webview panels and exchange
 * messages between the plugin host process and webview iframes.
 */
export interface WebviewApi {
  /**
   * Create a new webview panel.
   *
   * @param options - Panel title, entry point, and optional resource roots.
   * @returns A unique iframe ID used to address this panel in subsequent calls.
   */
  createPanel(options: WebviewPanelOptions): Promise<string>;

  /**
   * Send a message to a webview iframe. The message is received
   * via `acquireStudioApi().onMessage()` inside the webview.
   *
   * @param iframeId - Target iframe (returned by {@link createPanel} or passed to `onDidOpen`).
   * @param data - Serializable data to send.
   */
  postMessage(iframeId: string, data: unknown): Promise<void>;

  /**
   * Subscribe to messages sent from a webview iframe via
   * `acquireStudioApi().postMessage()`.
   *
   * Only one listener per iframe is active at a time; calling this again
   * for the same iframe replaces the previous listener.
   *
   * @param iframeId - Source iframe to listen to.
   * @param callback - Called with the deserialized message data.
   * @returns A disposer function that removes the listener when called.
   */
  onMessage(iframeId: string, callback: (data: unknown) => void): Promise<Disposable>;

  /**
   * Dispose a webview panel, removing its iframe and cleaning up listeners.
   *
   * @param iframeId - The iframe to dispose.
   */
  dispose(iframeId: string): Promise<void>;
}
