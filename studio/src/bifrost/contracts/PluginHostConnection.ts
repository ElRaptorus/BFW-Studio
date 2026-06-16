import { randomUUID } from 'crypto';

import { PLUGIN_HOST_PROTOCOL_VERSION, type PluginHostMessage } from './PluginHostProtocol';

export interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class PluginHostConnection {
  private pendingRequests = new Map<string, PendingRequest>();
  private sendFn: (message: PluginHostMessage) => void;
  private timeoutMs: number;

  constructor(sendFn: (message: PluginHostMessage) => void, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.sendFn = sendFn;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Send a request and wait for the matching response.
   */
  request(type: string, payload: unknown): Promise<unknown> {
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`[PH] Request ${type} (${requestId}) timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      this.sendFn({
        protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
        type,
        requestId,
        payload,
      });
    });
  }

  /**
   * Send a fire-and-forget message (no response expected).
   */
  send(type: string, payload?: unknown): void {
    this.sendFn({
      protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
      type,
      payload,
    });
  }

  /**
   * Send a response that correlates with a pending `request()` on the other
   * side of the connection. The `requestId` is placed at the message top
   * level so that the receiver's `handleResponse()` can match it.
   */
  respond(type: string, requestId: string, payload?: unknown): void {
    this.sendFn({
      protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
      type,
      requestId,
      payload,
    });
  }

  /**
   * Handle an incoming message. If it matches a pending request, resolve or
   * reject it depending on the payload's `success` field.
   * Returns `true` if the message was consumed as a response.
   */
  handleResponse(message: PluginHostMessage): boolean {
    if (message.requestId == null) {
      return false;
    }

    const pending = this.pendingRequests.get(message.requestId);
    if (pending == null) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.requestId);

    const payload = message.payload as Record<string, unknown> | undefined;

    if (payload != null && payload.success === false) {
      const errorMessage = typeof payload.error === 'string' ? payload.error : 'Unknown Plugin Host error';
      pending.reject(new Error(errorMessage));
    } else if (payload != null && payload.success === true) {
      pending.resolve(payload.result);
    } else {
      pending.resolve(payload);
    }

    return true;
  }

  /**
   * Reject all pending requests. Used during shutdown or crash recovery.
   */
  rejectAll(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  get pendingCount(): number {
    return this.pendingRequests.size;
  }
}
