import { createRoot } from 'react-dom/client';

import React from 'react';

import App from '../../App';
import { BifrostProvider } from '../../bifrostContext';
import { createAndInitializeBifrost } from '../../createAndInitializeBifrost';
import type { Bifrost } from '../Bifrost';
import type { BifrostOptions } from '../contracts/BifrostTypes';
import { getOperatingSystem } from './BrowserFunctions';

// Turn on debugging output in console
window.localStorage.debug = 'bifrost:*';

function onDocumentReady(documentReadyCallback: any): void {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(documentReadyCallback, 1);
  } else {
    // document.addEventListener('DOMContentLoaded', documentReadyCallback);
    window.addEventListener('load', documentReadyCallback);
  }
}

class StudioEmbedded {
  static initializeViaTagName(tagName: string = 'studio-embed'): void {
    const elements = document.getElementsByTagName(tagName);
    const elementsAsArray = Array.prototype.slice.call(elements, 0);

    elementsAsArray.forEach((uiRoot: HTMLElement) => {
      StudioEmbedded.create(uiRoot);
    });
  }

  static async initializeViaClassName(className: string = 'studio-embed'): Promise<void> {
    const elements = document.getElementsByClassName(className);
    const elementsAsArray = Array.prototype.slice.call(elements, 0);

    for (const uiRoot of elementsAsArray) {
      await StudioEmbedded.create(uiRoot);
    }
  }

  static async create(uiRoot: HTMLElement): Promise<Bifrost> {
    const options: BifrostOptions = {
      appKey: 'embed',
      os: getOperatingSystem(),
      client: 'embed',
      addWindowErrorHandlers: false,
      autoTogglePropertyPanelOnSelection: true,
    };

    const bifrost = await createAndInitializeBifrost(uiRoot, options);
    bifrost.commands.executeCommand('std.workbench.toggleFocusMode');

    const bpmn = StudioEmbedded.getXmlFromEmbed(uiRoot);
    if (bpmn != null) {
      const editorDocument = bifrost.editors.createNewEditorDocumentAsBuffer('bpmn', bpmn);

      bifrost.editors.focusOrOpenEditorDocument(editorDocument);
    }

    const bpmnUri = StudioEmbedded.getUriFromEmbed(uiRoot);
    if (bpmnUri != null) {
      bifrost.editors.focusOrOpenEditorDocument(bpmnUri);
    }

    const root = createRoot(uiRoot);
    root.render(
      <BifrostProvider value={bifrost}>
        <App />
      </BifrostProvider>,
    );

    return bifrost;
  }

  private static getXmlFromEmbed(uiRoot: HTMLElement): string | null {
    const xmlNode = StudioEmbedded.getScriptChildNodes(uiRoot).find(
      (node: any) => node.innerHTML != null && node.innerHTML !== '',
    );

    return xmlNode == null ? null : xmlNode.innerHTML;
  }

  private static getUriFromEmbed(uiRoot: HTMLElement): string | null {
    const attribute = uiRoot.getAttribute('data-src');
    if (attribute == null) {
      return null;
    }

    return new URL(attribute, window.location.origin).href;
  }

  private static getScriptChildNodes(uiRoot: HTMLElement): any[] {
    const results: any[] = [];

    uiRoot.childNodes.forEach((node: any) => {
      if (node.tagName === 'SCRIPT' && node.getAttribute('type') === 'text/bpmn') {
        results.push(node);
      }
    });

    return results;
  }
}

(window as any).StudioEmbed = StudioEmbedded;

onDocumentReady(() => {
  StudioEmbedded.initializeViaClassName('studio-embed');
});
