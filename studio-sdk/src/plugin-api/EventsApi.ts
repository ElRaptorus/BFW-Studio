import type { Disposable } from './Disposable';

/**
 * Studio event subscription API.
 *
 * Allows plugins to listen for named events emitted by the Studio runtime.
 * Unsubscribe by calling `dispose()` on the returned handle — there is no `off`.
 */
export const PluginStudioEvent = {
  /** Fired when the focused editor document changes (including focus leaving editors). */
  EditorFocusChanged: 'editorFocusChanged',
} as const;

export type PluginStudioEventName = (typeof PluginStudioEvent)[keyof typeof PluginStudioEvent];

/** Payload for {@link PluginStudioEvent.EditorFocusChanged}. */
export interface EditorFocusChangedPayload {
  uri: string | null;
  documentType: string | null;
}

export interface EventsApi {
  /**
   * Subscribe to editor focus changes.
   *
   * @param eventName - Must be `'editorFocusChanged'`.
   * @param callback - Handler invoked with the focused document URI and type, or nulls when nothing is focused.
   */
  on(
    eventName: typeof PluginStudioEvent.EditorFocusChanged,
    callback: (payload: EditorFocusChangedPayload) => void,
  ): Promise<Disposable>;

  /**
   * Subscribe to a named event.
   *
   * @param eventName - The event to listen for.
   * @param callback - Handler invoked each time the event fires.
   */
  on(eventName: string, callback: (...args: unknown[]) => void): Promise<Disposable>;
}
