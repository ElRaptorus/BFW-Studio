import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CounterAckPayload,
  EchoReplyPayload,
  HostMessage,
  HostPingPayload,
  InitPayload,
  PongPayload,
  StateUpdatePayload,
  StudioWebviewApi,
} from './types';

interface LogEntry {
  id: number;
  direction: 'sent' | 'received';
  type: string;
  payload: unknown;
  timestamp: number;
}

let logIdCounter = 0;

export default function App(): React.JSX.Element {
  const apiRef = useRef<StudioWebviewApi | null>(null);
  const [connected, setConnected] = useState(false);
  const [initData, setInitData] = useState<InitPayload | null>(null);
  const [counter, setCounter] = useState(0);
  const [echoInput, setEchoInput] = useState('');
  const [lastPong, setLastPong] = useState<PongPayload | null>(null);
  const [lastEchoReply, setLastEchoReply] = useState<EchoReplyPayload | null>(null);
  const [hostState, setHostState] = useState<StateUpdatePayload | null>(null);
  const [hostPings, setHostPings] = useState<HostPingPayload[]>([]);
  const [lastCounterAck, setLastCounterAck] = useState<CounterAckPayload | null>(null);
  const [messageLog, setMessageLog] = useState<LogEntry[]>([]);
  const [themeType, setThemeType] = useState('dark');

  const addLog = useCallback((direction: 'sent' | 'received', type: string, payload: unknown) => {
    setMessageLog((prev) => {
      const entry: LogEntry = { id: ++logIdCounter, direction, type, payload, timestamp: Date.now() };
      const next = [entry, ...prev];
      return next.length > 50 ? next.slice(0, 50) : next;
    });
  }, []);

  const sendMessage = useCallback(
    (type: string, payload?: unknown) => {
      if (apiRef.current == null) return;
      const msg = { type, payload };
      apiRef.current.postMessage(msg);
      addLog('sent', type, payload);
    },
    [addLog],
  );

  useEffect(() => {
    const api = window.acquireStudioApi?.();
    if (api == null) {
      console.error('[webview-showcase] acquireStudioApi not available');
      return;
    }

    apiRef.current = api;
    setThemeType(api.getThemeType());

    api.onMessage((rawData: unknown) => {
      const data = rawData as HostMessage;
      addLog('received', data.type, data.payload);

      switch (data.type) {
        case 'init':
          setInitData(data.payload as InitPayload);
          setConnected(true);
          break;
        case 'pong':
          setLastPong(data.payload as PongPayload);
          break;
        case 'echo-reply':
          setLastEchoReply(data.payload as EchoReplyPayload);
          break;
        case 'state-update':
          setHostState(data.payload as StateUpdatePayload);
          break;
        case 'counter-ack':
          setLastCounterAck(data.payload as CounterAckPayload);
          break;
        case 'host-ping':
          setHostPings((prev) => [...prev.slice(-9), data.payload as HostPingPayload]);
          break;
      }
    });

    const msg = { type: 'ready' };
    api.postMessage(msg);
    addLog('sent', 'ready', undefined);
  }, [addLog]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme != null) setThemeType(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handlePing = () => sendMessage('ping', { sentAt: Date.now() });
  const handleEcho = () => {
    sendMessage('echo', echoInput || 'Hello, host!');
    setEchoInput('');
  };
  const handleRequestState = () => sendMessage('request-state');
  const handleNotification = (type: string) =>
    sendMessage('show-notification', {
      type,
      content: `${type} from Webview Showcase at ${new Date().toLocaleTimeString()}`,
    });

  const handleIncrement = () => {
    const next = counter + 1;
    setCounter(next);
    sendMessage('counter-update', next);
  };
  const handleDecrement = () => {
    const next = counter - 1;
    setCounter(next);
    sendMessage('counter-update', next);
  };
  const handleReset = () => {
    setCounter(0);
    sendMessage('counter-update', 0);
  };

  return (
    <div className={`showcase-root theme-${themeType}`}>
      <header className="showcase-header">
        <h1>Webview Showcase</h1>
        <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </header>

      {initData != null && (
        <section className="card init-card">
          <h2>Plugin Info</h2>
          <dl>
            <dt>Plugin Name</dt>
            <dd>{initData.pluginName}</dd>
            <dt>API Version</dt>
            <dd>{initData.apiVersion}</dd>
            <dt>Greeting</dt>
            <dd>{initData.greeting}</dd>
            <dt>Connected At</dt>
            <dd>{new Date(initData.timestamp).toLocaleTimeString()}</dd>
          </dl>
        </section>
      )}

      <section className="card">
        <h2>Ping / Pong</h2>
        <p>Send a ping to the plugin host and get a pong back.</p>
        <button type="button" className="btn btn-primary" onClick={handlePing}>
          Send Ping
        </button>
        {lastPong != null && (
          <div className="result-box">
            <strong>Pong received!</strong> Round-trip: {Date.now() - (lastPong.echo as { sentAt: number })?.sentAt}ms
          </div>
        )}
      </section>

      <section className="card">
        <h2>Echo</h2>
        <p>Send any text and the host will echo it back with a counter.</p>
        <div className="input-row">
          <input
            type="text"
            className="text-input"
            placeholder="Type a message..."
            value={echoInput}
            onChange={(event) => setEchoInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleEcho()}
          />
          <button type="button" className="btn btn-primary" onClick={handleEcho}>
            Echo
          </button>
        </div>
        {lastEchoReply != null && (
          <div className="result-box">
            <strong>Echo #{lastEchoReply.echoCount}:</strong> &quot;{String(lastEchoReply.original)}&quot;
          </div>
        )}
      </section>

      <section className="card">
        <h2>Counter</h2>
        <p>Each change is sent to the host, which acknowledges with a server timestamp.</p>
        <div className="counter-controls">
          <button type="button" className="btn" onClick={handleDecrement}>
            −
          </button>
          <span className="counter-value">{counter}</span>
          <button type="button" className="btn" onClick={handleIncrement}>
            +
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
        {lastCounterAck != null && (
          <div className="result-box">
            Acknowledged value: {String(lastCounterAck.value)} at{' '}
            {new Date(lastCounterAck.serverTimestamp).toLocaleTimeString()}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Notifications</h2>
        <p>Ask the plugin host to display a Studio notification.</p>
        <div className="btn-row">
          <button type="button" className="btn btn-info" onClick={() => handleNotification('info')}>
            Info
          </button>
          <button type="button" className="btn btn-warning" onClick={() => handleNotification('warning')}>
            Warning
          </button>
          <button type="button" className="btn btn-error" onClick={() => handleNotification('error')}>
            Error
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Host State</h2>
        <p>Request the plugin-side state snapshot.</p>
        <button type="button" className="btn btn-primary" onClick={handleRequestState}>
          Request State
        </button>
        {hostState != null && <pre className="code-block">{JSON.stringify(hostState, null, 2)}</pre>}
      </section>

      {hostPings.length > 0 && (
        <section className="card">
          <h2>Host Pings Received</h2>
          <p>Pings sent by the host via the &quot;Send Ping&quot; command.</p>
          <ul className="ping-list">
            {hostPings.map((ping) => (
              <li key={ping.pingNumber}>
                Ping #{ping.pingNumber} at {new Date(ping.timestamp).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Message Log</h2>
        <p>Last {messageLog.length} messages (newest first, max 50).</p>
        <div className="message-log">
          {messageLog.length === 0 && <p className="muted">No messages yet.</p>}
          {messageLog.map((entry) => (
            <div key={entry.id} className={`log-entry log-${entry.direction}`}>
              <span className="log-direction">{entry.direction === 'sent' ? '→' : '←'}</span>
              <span className="log-type">{entry.type}</span>
              <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
              {entry.payload != null && <span className="log-payload">{JSON.stringify(entry.payload)}</span>}
            </div>
          ))}
        </div>
      </section>

      <footer className="showcase-footer">
        <span>Theme: {themeType}</span>
        <span>Webview Showcase v1.0.0</span>
      </footer>
    </div>
  );
}
