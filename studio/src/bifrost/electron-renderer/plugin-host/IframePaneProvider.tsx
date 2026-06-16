import PluginIframe from '#components/webview/PluginIframe';
import type { PluginIframeManager } from '#components/webview/PluginIframeManager';
import type { PluginIframeHandle } from '#components/webview/types';

import React, { useRef } from 'react';

import type { PaneComponentProps, PaneProvider, PaneProviderModule } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader } from '@evil/bifrost_fw_sdk';

interface IframePaneProviderContext {
  pluginName: string;
  paneId: string;
  title: string;
  webviewOptions: { entryPoint: string; localResourceRoots?: string[] };
  pluginIframeManager: PluginIframeManager;
  webviewProtocol: string;
  getVisibility?: () => boolean | undefined;
}

/**
 * Factory that creates a {@link PaneProviderModule} rendering a
 * {@link PluginIframe} as the pane body. The iframe receives a
 * deterministic `iframeId` of the form `pane:<paneId>`.
 *
 * Mirrors {@link createIframeDocumentRendererConstructor} but targets
 * the pane system instead of the editor document system.
 */
export function createIframePaneProvider(context: IframePaneProviderContext): PaneProviderModule {
  function IframePaneContent(props: PaneComponentProps): React.JSX.Element {
    const iframeId = `pane:${context.paneId}`;
    const panelRef = useRef<PluginIframeHandle>(null);

    return (
      <PluginIframe
        ref={panelRef}
        iframeId={iframeId}
        pluginName={context.pluginName}
        entryPoint={context.webviewOptions.entryPoint}
        webviewProtocol={context.webviewProtocol}
        pluginIframeManager={context.pluginIframeManager}
        className="webview-pane-content"
      />
    );
  }

  function IframePane(props: PaneComponentProps): React.JSX.Element {
    return (
      <Pane classNames="app-layout__full-height-pane">
        <PaneHeader studio={props.studio} title={context.title} paneId={props.paneId} collapsed={props.collapsed} />
        {props.collapsed !== true && <IframePaneContent {...props} />}
      </Pane>
    );
  }

  const paneProvider: PaneProvider = {
    getPaneTitle: () => context.title,
    shouldBeDisplayed: () => {
      return context.getVisibility?.() ?? true;
    },
    Pane: IframePane,
    PaneContent: IframePaneContent,
  };

  return { paneProvider };
}
