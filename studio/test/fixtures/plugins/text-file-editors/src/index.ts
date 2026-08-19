/**
 * Text File Editors Plugin
 *
 * Registers two iframe-backed editor document types — Markdown and JSON —
 * reproducing (verbatim, by file extension) the Studio's removed built-in
 * `editor-document-markdown-editor` and `editor-document-default-editor`
 * document types. Both are rendered with CodeMirror 6 inside a sandboxed
 * iframe via the public Plugin API.
 *
 * Save paths (see docs/architecture/common-pitfalls.md
 * §"Ctrl+S does not reach the host from inside a plugin webview iframe"):
 *
 *   1. Host-triggered saves (Save menu, command palette, unsaved-changes-on-
 *      close dialog) call `bifrost.editors.saveEditorDocument()` directly and
 *      are handled here via `api.editors.onSaveRequest(uri, ...)`.
 *   2. Ctrl+S pressed while focus is inside the iframe's CodeMirror instance
 *      never reaches the host's keybinding system (keydown events do not
 *      bubble across the iframe boundary). The webview scripts
 *      (`webview/src/markdown.ts`, `webview/src/json.ts`) intercept this
 *      themselves and relay a `save-requested` message, handled here
 *      identically to `onSaveRequest`.
 *
 * Both paths funnel through the same `persist(uri)` helper so the on-disk
 * write and the dirty-flag reset always stay in sync.
 */

interface PluginApi {
  env: { pluginPath: string; pluginName: string; storagePath: string; apiVersion: string };
  editors: {
    registerWebviewDocumentType(options: {
      id: string;
      displayName: string;
      icon: string;
      uriPattern: string;
      webviewOptions: { entryPoint: string };
      includedFilePatterns?: string[];
    }): Promise<void>;
    onDidOpen(
      documentTypeLocalId: string,
      callback: (iframeId: string, uri: string) => void,
    ): Promise<{ dispose: () => void }>;
    onSaveRequest(uri: string, callback: () => void | Promise<void>): Promise<{ dispose: () => void }>;
    setDirty(uri: string, isDirty: boolean): Promise<void>;
  };
  webviews: {
    postMessage(iframeId: string, data: unknown): Promise<void>;
    onMessage(iframeId: string, callback: (data: unknown) => void): Promise<{ dispose: () => void }>;
  };
  workspace: {
    readFile(uri: string): Promise<string>;
    writeFile(uri: string, content: string): Promise<void>;
  };
}

type WebviewMessage = { type: 'ready' } | { type: 'change'; payload: string } | { type: 'save-requested' };

/** Latest in-memory content per document URI, kept fresh by undebounced `change` messages. */
const cachedContent = new Map<string, string>();

/** Disposers for `onSaveRequest` delegates and `onMessage` subscriptions, keyed by URI/iframeId. */
const disposers = new Map<string, { dispose: () => void }>();

function registerDocumentType(
  api: PluginApi,
  options: {
    id: 'markdown' | 'json';
    displayName: string;
    icon: string;
    uriPattern: string;
    entryPoint: string;
  },
): Promise<void> {
  // includedFilePatterns is declared once via contributes.editorDocumentTypes in package.json
  // (registered as a placeholder at discovery time, before activation) — it is intentionally
  // NOT repeated here, since this call only replaces the placeholder with the real iframe editor.
  return api.editors
    .registerWebviewDocumentType({
      id: options.id,
      displayName: options.displayName,
      icon: options.icon,
      uriPattern: options.uriPattern,
      webviewOptions: { entryPoint: options.entryPoint },
    })
    .then(() =>
      api.editors.onDidOpen(options.id, (iframeId: string, uri: string) => {
        wireUpDocument(api, iframeId, uri);
      }),
    )
    .then((disposer) => {
      disposers.set(`onDidOpen:${options.id}`, disposer);
    });
}

function wireUpDocument(api: PluginApi, iframeId: string, uri: string): void {
  const persist = async (): Promise<void> => {
    const content = cachedContent.get(uri);
    if (content == null) {
      return;
    }
    await api.workspace.writeFile(uri, content);
    await api.editors.setDirty(uri, false);
  };

  api.editors
    .onSaveRequest(uri, () => persist())
    .then((disposer) => {
      disposers.set(`onSaveRequest:${uri}`, disposer);
    });

  api.webviews
    .onMessage(iframeId, (data: unknown) => {
      const message = data as WebviewMessage;

      switch (message.type) {
        case 'ready':
          api.workspace.readFile(uri).then((content) => {
            cachedContent.set(uri, content);
            api.webviews.postMessage(iframeId, { type: 'load', payload: content });
          });
          break;

        case 'change':
          cachedContent.set(uri, message.payload);
          api.editors.setDirty(uri, true);
          break;

        case 'save-requested':
          persist();
          break;
      }
    })
    .then((disposer) => {
      disposers.set(`onMessage:${iframeId}`, disposer);
    });
}

module.exports.activate = async (api: PluginApi): Promise<void> => {
  // Fail-loud guard: the iframes load `webview/dist/*.html`, produced by esbuild
  // (`node webview/build.mjs`), NOT by `tsc`. Surface a missing build here instead
  // of failing silently with a blank "Not found" iframe.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  for (const htmlFile of ['markdown.html', 'json.html']) {
    const entryHtml = path.join(api.env.pluginPath, 'webview', 'dist', htmlFile);
    if (!fs.existsSync(entryHtml)) {
      console.warn(
        `[text-file-editors] Webview build missing — '${entryHtml}' not found. ` +
          `Build the webview with esbuild ("node webview/build.mjs"); do NOT run "tsc" in webview/, ` +
          `which only type-checks. Until it is built, matching files render a blank "Not found" page.`,
      );
    }
  }

  await registerDocumentType(api, {
    id: 'markdown',
    displayName: 'Markdown Editor',
    icon: 'ph ph-markdown-logo',
    uriPattern: '\\.(mdx?|mdc|markdown|mdown|mkd|mkdn)$',
    entryPoint: 'webview/dist/markdown.html',
  });

  await registerDocumentType(api, {
    id: 'json',
    displayName: 'JSON Editor',
    icon: 'ph ph-brackets-curly',
    uriPattern: '\\.json$',
    entryPoint: 'webview/dist/json.html',
  });
};

module.exports.deactivate = async (): Promise<void> => {
  for (const disposer of disposers.values()) {
    disposer.dispose();
  }
  disposers.clear();
  cachedContent.clear();
};
