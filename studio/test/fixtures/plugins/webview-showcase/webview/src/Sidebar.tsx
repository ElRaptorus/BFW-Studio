import { useCallback, useEffect, useRef, useState } from 'react';

import type { StudioWebviewApi } from './types';

interface StatusInfo {
  connected: boolean;
  messagesReceived: number;
  editorIframeCount: number;
  lastPingSent: string | null;
}

export default function Sidebar(): React.JSX.Element {
  const apiRef = useRef<StudioWebviewApi | null>(null);
  const [status, setStatus] = useState<StatusInfo>({
    connected: false,
    messagesReceived: 0,
    editorIframeCount: 0,
    lastPingSent: null,
  });
  const [messages, setMessages] = useState<Array<{ id: number; text: string; time: string }>>([]);
  const [themeType, setThemeType] = useState('dark');

  const msgId = useRef(0);

  const addMessage = useCallback((text: string) => {
    setMessages((prev) => {
      const entry = { id: ++msgId.current, text, time: new Date().toLocaleTimeString() };
      const next = [entry, ...prev];
      return next.length > 20 ? next.slice(0, 20) : next;
    });
  }, []);

  useEffect(() => {
    const api = window.acquireStudioApi?.();
    if (api == null) return;

    apiRef.current = api;
    setThemeType(api.getThemeType());

    api.onMessage((rawData: unknown) => {
      const data = rawData as { type: string; payload?: unknown };

      switch (data.type) {
        case 'sidebar-init':
          setStatus((prev) => ({ ...prev, connected: true }));
          addMessage('Connected to plugin host');
          break;
        case 'sidebar-state': {
          const payload = data.payload as {
            messagesReceived: number;
            iframeCount: number;
            pingsSent: number;
          };
          setStatus((prev) => ({
            ...prev,
            messagesReceived: payload.messagesReceived,
            editorIframeCount: payload.iframeCount,
            lastPingSent: payload.pingsSent > 0 ? `#${payload.pingsSent}` : null,
          }));
          addMessage(`State refreshed — ${payload.messagesReceived} total messages`);
          break;
        }
        case 'sidebar-notification':
          addMessage(`Host: ${String((data.payload as { text: string })?.text ?? data.payload)}`);
          break;
      }
    });

    api.postMessage({ type: 'sidebar-ready' });
    addMessage('Sidebar loaded, sent ready signal');
  }, [addMessage]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme != null) setThemeType(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleRefreshState = () => {
    apiRef.current?.postMessage({ type: 'sidebar-request-state' });
    addMessage('Requested state from host');
  };

  const handleOpenEditor = () => {
    apiRef.current?.postMessage({ type: 'sidebar-open-editor' });
    addMessage('Requested to open editor tab');
  };

  const handleSendPing = () => {
    apiRef.current?.postMessage({ type: 'sidebar-send-ping' });
    addMessage('Triggered host ping to all editors');
  };

  return (
    <div className={`sidebar-root theme-${themeType}`}>
      <div className="sidebar-status">
        <span className={`dot ${status.connected ? 'connected' : ''}`} />
        <span className="status-text">{status.connected ? 'Connected' : 'Connecting...'}</span>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Quick Actions</div>
        <button type="button" className="sidebar-btn" onClick={handleOpenEditor}>
          <span className="btn-icon">&#xe8d4;</span>
          Open Showcase Editor
        </button>
        <button type="button" className="sidebar-btn" onClick={handleSendPing}>
          <span className="btn-icon">&#xe0c8;</span>
          Ping All Editors
        </button>
        <button type="button" className="sidebar-btn" onClick={handleRefreshState}>
          <span className="btn-icon">&#xe5d5;</span>
          Refresh State
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Plugin State</div>
        <div className="sidebar-stats">
          <div className="stat-row">
            <span className="stat-label">Messages</span>
            <span className="stat-value">{status.messagesReceived}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Editor iframes</span>
            <span className="stat-value">{status.editorIframeCount}</span>
          </div>
          {status.lastPingSent != null && (
            <div className="stat-row">
              <span className="stat-label">Last ping</span>
              <span className="stat-value">{status.lastPingSent}</span>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-section sidebar-section--grow">
        <div className="sidebar-label">Activity ({messages.length})</div>
        <div className="sidebar-log">
          {messages.map((msg) => (
            <div key={msg.id} className="log-item">
              <span className="log-time">{msg.time}</span>
              <span className="log-text">{msg.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">Theme: {themeType}</div>
    </div>
  );
}
