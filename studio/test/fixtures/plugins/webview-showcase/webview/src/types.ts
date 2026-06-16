export interface StudioWebviewApi {
  postMessage(data: unknown): void;
  onMessage(callback: (data: unknown) => void): void;
  setState(state: unknown): void;
  getState(): unknown;
  getThemeType(): string;
}

declare global {
  interface Window {
    acquireStudioApi?: () => StudioWebviewApi;
  }
}

export interface HostMessage {
  type: string;
  payload?: unknown;
}

export interface InitPayload {
  pluginName: string;
  apiVersion: string;
  greeting: string;
  timestamp: number;
}

export interface PongPayload {
  receivedAt: number;
  echo: unknown;
}

export interface EchoReplyPayload {
  original: unknown;
  echoCount: number;
}

export interface StateUpdatePayload {
  messagesReceived: number;
  lastMessageFromWebview: unknown;
  iframeIds: string[];
  pingsSent: number;
  echoCount: number;
}

export interface CounterAckPayload {
  value: unknown;
  serverTimestamp: number;
}

export interface HostPingPayload {
  pingNumber: number;
  timestamp: number;
}
