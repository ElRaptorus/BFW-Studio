/**
 * Studio event subscription API.
 *
 * Allows plugins to listen for named events emitted by the Studio runtime.
 */
export interface EventsApi {
  /**
   * Subscribe to a named event.
   *
   * @param eventName - The event to listen for.
   * @param callback - Handler invoked each time the event fires.
   */
  on(eventName: string, callback: (...args: unknown[]) => void): Promise<void>;

  /**
   * Unsubscribe a previously registered event listener.
   * The `callback` reference must be the same function passed to {@link on}.
   *
   * @param eventName - The event to unsubscribe from.
   * @param callback - The exact callback reference that was registered.
   */
  off(eventName: string, callback: (...args: unknown[]) => void): Promise<void>;
}
