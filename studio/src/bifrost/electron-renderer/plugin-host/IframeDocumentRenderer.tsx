import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import PluginIframe from '#components/webview/PluginIframe';
import type { PluginIframeManager } from '#components/webview/PluginIframeManager';
import type { PluginIframeHandle } from '#components/webview/types';

import React, { useEffect, useRef } from 'react';

interface IframeDocumentRendererContext {
  pluginName: string;
  webviewOptions: { entryPoint: string; localResourceRoots?: string[] };
  pluginIframeManager: PluginIframeManager;
  webviewProtocol: string;
  onDidOpenNotifier?: (iframeId: string, uri: string) => void;
}

/**
 * Factory that creates a React component rendering a {@link PluginIframe}
 * inside an editor tab. The returned component satisfies the
 * {@link EditorDocumentRendererProps} contract used by EditorDocumentTypeManager.
 *
 * Each instance gets a deterministic `iframeId` derived from the document URI
 * (`editor:<uri>`), ensuring stable identity across focus/blur cycles.
 */
export function createIframeDocumentRendererConstructor(
  context: IframeDocumentRendererContext,
): React.FC<EditorDocumentRendererProps> {
  return function IframeDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
    const { editorDocument } = props;
    const iframeId = `editor:${editorDocument.uri}`;
    const panelRef = useRef<PluginIframeHandle>(null);

    useEffect(() => {
      context.onDidOpenNotifier?.(iframeId, editorDocument.uri);
    }, [iframeId, editorDocument.uri]);

    return (
      <PluginIframe
        ref={panelRef}
        iframeId={iframeId}
        pluginName={context.pluginName}
        entryPoint={context.webviewOptions.entryPoint}
        webviewProtocol={context.webviewProtocol}
        pluginIframeManager={context.pluginIframeManager}
        className="webview-editor-document"
      />
    );
  };
}
