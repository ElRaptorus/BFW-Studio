type MessageCallback = (data: unknown) => void;
type SendFunction = (pluginName: string, data: unknown) => void;

/**
 * Per-plugin bidirectional message channel between a renderer-injected
 * diagram-js module and the plugin's host-side code.
 *
 * The renderer module receives this as a DI value named `pluginChannel`.
 * The plugin host communicates back via `api.bpmn.onRendererModuleMessage`
 * and `api.bpmn.postToRendererModule`.
 */
export class PluginChannel {
  private listeners = new Set<MessageCallback>();
  private disposed = false;

  constructor(
    readonly pluginName: string,
    private sendFn: SendFunction,
  ) {}

  /**
   * Send a message from the renderer module to the plugin host.
   * Called by the diagram-js module inside the renderer process.
   */
  postMessage(data: unknown): void {
    if (this.disposed) {
      return;
    }
    this.sendFn(this.pluginName, data);
  }

  /**
   * Register a callback for messages arriving from the plugin host.
   * Called by the diagram-js module to receive commands/data from the host.
   */
  onMessage(callback: MessageCallback): void {
    if (this.disposed) {
      return;
    }
    this.listeners.add(callback);
  }

  /**
   * Deliver a message from the plugin host to this renderer module.
   * Called by the bridge when a host→renderer message arrives.
   */
  deliverMessage(data: unknown): void {
    if (this.disposed) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`[PluginChannel] Error in message listener for plugin '${this.pluginName}':`, error);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
