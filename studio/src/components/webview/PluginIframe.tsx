import { pluginNameToHostname } from '#bifrost/common/plugin-host/permissions/ScopedPluginName';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { PluginIframeManager } from './PluginIframeManager';
import type { PluginIframeGuestMessage, PluginIframeHandle } from './types';
import { BRIDGE_CHANNEL } from './types';

interface PluginIframeProps {
  iframeId: string;
  pluginName: string;
  entryPoint: string;
  webviewProtocol: string;
  pluginIframeManager: PluginIframeManager;
  className?: string;
}

/**
 * React component rendering a sandboxed `<iframe>` served by the
 * `evil-webview://` custom protocol. Each plugin gets a unique origin
 * (`evil-webview://<pluginName>/`), enforcing storage isolation and
 * same-origin policy boundaries.
 *
 * Registers itself with {@link PluginIframeManager} on mount and
 * unregisters on unmount. Validates `event.origin` on every
 * incoming `message` event.
 */
const PluginIframe = forwardRef<PluginIframeHandle, PluginIframeProps>(function PluginIframe(props, ref) {
  const { iframeId, pluginName, entryPoint, webviewProtocol, pluginIframeManager, className } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [crashed, setCrashed] = useState(false);

  const hostname = pluginNameToHostname(pluginName);
  const expectedOrigin = `${webviewProtocol}://${hostname}`;
  const iframeSrc = `${webviewProtocol}://${hostname}/${entryPoint}`;

  const handle = useMemo<PluginIframeHandle>(
    () => ({
      postMessage(data: unknown): void {
        if (iframeRef.current?.contentWindow == null) {
          return;
        }
        iframeRef.current.contentWindow.postMessage(
          { channel: BRIDGE_CHANNEL, direction: 'to-guest', payload: data as PluginIframeGuestMessage },
          expectedOrigin,
        );
      },
      reload(): void {
        if (iframeRef.current != null) {
          setCrashed(false);
          iframeRef.current.src = iframeSrc;
        }
      },
    }),
    [expectedOrigin, iframeSrc],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  const managerRef = useRef<PluginIframeHandle>(handle);

  useEffect(() => {
    managerRef.current = handle;
  }, [handle]);

  useEffect(() => {
    pluginIframeManager.register(iframeId, pluginName, managerRef);
    return () => {
      pluginIframeManager.unregister(iframeId);
    };
  }, [iframeId, pluginName, pluginIframeManager]);

  const handleLoad = useCallback(() => {
    setCrashed(false);
    pluginIframeManager.sendRestoredState(iframeId);
  }, [iframeId, pluginIframeManager]);

  const handleError = useCallback(() => {
    setCrashed(true);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== expectedOrigin) {
        return;
      }
      if (event.data?.channel !== BRIDGE_CHANNEL || event.data?.direction !== 'to-host') {
        return;
      }
      pluginIframeManager.handleIframeMessage(iframeId, event.data.payload);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [expectedOrigin, iframeId, pluginIframeManager]);

  if (crashed) {
    return (
      <div
        className={`plugin-iframe-crashed ${className ?? ''}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <button
          type="button"
          onClick={() => {
            setCrashed(false);
            if (iframeRef.current != null) {
              iframeRef.current.src = iframeSrc;
            }
          }}
          style={{ cursor: 'pointer', padding: '8px 16px' }}
        >
          Plugin UI crashed. Click to reload.
        </button>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      sandbox="allow-scripts allow-same-origin"
      style={{ border: 'none', width: '100%', height: '100%' }}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

export default PluginIframe;
