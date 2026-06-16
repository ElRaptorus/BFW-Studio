/**
 * Webview Showcase Plugin
 *
 * Registers an iframe-backed editor document type that renders a React UI
 * inside a sandboxed iframe. Demonstrates the full messaging pipeline:
 *
 *   Plugin (child process) ↔ Renderer Bridge ↔ iframe (React app)
 *
 * Commands:
 *   openShowcase  — opens the webview showcase editor tab
 *   sendPing      — sends a 'ping' message to the iframe
 *   getState      — returns the plugin-side state snapshot
 */

interface PluginApi {
  env: { pluginPath: string; pluginName: string; storagePath: string; apiVersion: string };
  commands: {
    register(
      id: string,
      handler: (...args: unknown[]) => unknown,
      options?: { visibleInSearch?: boolean; description?: string },
    ): Promise<{ dispose: () => void }>;
  };
  diagnostics: {
    set(uri: string, diagnostics: { severity: string; message: string }[]): Promise<void>;
    clear(): Promise<void>;
    get(uri?: string): Promise<Record<string, { severity: string; message: string }[]>>;
    getCount(): Promise<{ errors: number; warnings: number; infos: number }>;
    onDidChange(callback: () => void): Promise<void>;
  };
  dialogs: {
    open(options: { title: string; content: unknown[]; actions: unknown[] }): Promise<unknown>;
    prompt(title: string, placeholder?: string): Promise<string | null>;
    showOpenFile(options?: unknown): Promise<string[] | null>;
    showOpenDirectory(): Promise<string[] | null>;
    showSaveFile(options?: unknown): Promise<string | null>;
  };
  notifications: {
    open(options: {
      type: string;
      content: string;
      source?: string;
      actions?: { action: string; label: string; default?: boolean }[];
      sticky?: boolean;
    }): Promise<string>;
    close(notificationId: string): Promise<void>;
    update(notificationId: string, options: { content?: string }): Promise<void>;
    onResponse(
      notificationId: string,
      callback: (response: { action: string; label: string }) => void,
    ): Promise<{ dispose: () => void }>;
  };
  settings: {
    register(descriptors: Record<string, unknown>): Promise<void>;
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    onDidChange(key: string, callback: (newValue: unknown) => void): Promise<{ dispose: () => void }>;
  };
  editors: {
    registerWebviewDocumentType(options: {
      id: string;
      displayName: string;
      icon: string;
      uriPattern: string;
      webviewOptions: { entryPoint: string };
    }): Promise<void>;
    openDocument(uri: string): Promise<void>;
    onDidOpen(
      documentTypeLocalId: string,
      callback: (iframeId: string, uri: string) => void,
    ): Promise<{ dispose: () => void }>;
  };
  webviews: {
    postMessage(iframeId: string, data: unknown): Promise<void>;
    onMessage(iframeId: string, callback: (data: unknown) => void): Promise<{ dispose: () => void }>;
  };
  panes: {
    registerWebviewPane(options: {
      id: string;
      title: string;
      area: 'left' | 'bottom' | 'right';
      groupId?: string;
      icon?: string;
      webviewOptions: { entryPoint: string };
    }): Promise<void>;
    setVisible(paneId: string, visible: boolean): Promise<void>;
  };
  workspace: {
    readFile(uri: string): Promise<string>;
    readBinaryFile(uri: string): Promise<Uint8Array>;
    writeFile(uri: string, content: string): Promise<void>;
    writeBinaryFile(uri: string, content: Uint8Array): Promise<void>;
    listDirectory(uri: string): Promise<{ name: string; uri: string; type: 'file' | 'directory' }[]>;
    stat(uri: string): Promise<{ isDirectory: boolean; isFile: boolean; exists: boolean }>;
    createDirectory(uri: string): Promise<void>;
    deleteFile(uri: string): Promise<void>;
    onDidChangeFile(
      uri: string,
      callback: (event: { type: string; uri: string }) => void,
    ): Promise<{ dispose: () => void }>;
    onDidChangeSolution(callback: () => void): Promise<{ dispose: () => void }>;
    getProjectFolders(): Promise<{ uri: string; name: string }[]>;
  };
}

interface ShowcaseState {
  messagesReceived: number;
  lastMessageFromWebview: unknown;
  iframeIds: Set<string>;
  pingsSent: number;
  echoCount: number;
}

const state: ShowcaseState = {
  messagesReceived: 0,
  lastMessageFromWebview: null,
  iframeIds: new Set(),
  pingsSent: 0,
  echoCount: 0,
};

const messageDisposers = new Map<string, { dispose: () => void }>();
let sidebarVisible = true;

module.exports.activate = async (api: PluginApi): Promise<void> => {
  await api.editors.registerWebviewDocumentType({
    id: 'showcase',
    displayName: 'Webview Showcase',
    icon: 'ph ph-browser',
    uriPattern: '^ext://webview-showcase/',
    webviewOptions: {
      entryPoint: 'webview/dist/index.html',
    },
  });

  await api.editors.onDidOpen('showcase', (iframeId: string, uri: string) => {
    console.log(`[webview-showcase] iframe opened: ${iframeId} for ${uri}`);
    state.iframeIds.add(iframeId);

    api.webviews
      .onMessage(iframeId, (data: unknown) => {
        state.messagesReceived++;
        state.lastMessageFromWebview = data;

        const message = data as { type: string; payload?: unknown };

        switch (message.type) {
          case 'ready':
            api.webviews.postMessage(iframeId, {
              type: 'init',
              payload: {
                pluginName: api.env.pluginName,
                apiVersion: api.env.apiVersion,
                greeting: 'Hello from the Plugin Host child process!',
                timestamp: Date.now(),
              },
            });
            break;

          case 'ping':
            api.webviews.postMessage(iframeId, {
              type: 'pong',
              payload: { receivedAt: Date.now(), echo: message.payload },
            });
            break;

          case 'echo':
            state.echoCount++;
            api.webviews.postMessage(iframeId, {
              type: 'echo-reply',
              payload: { original: message.payload, echoCount: state.echoCount },
            });
            break;

          case 'request-state':
            api.webviews.postMessage(iframeId, {
              type: 'state-update',
              payload: {
                ...state,
                iframeIds: [...state.iframeIds],
              },
            });
            break;

          case 'show-notification': {
            const notifPayload = message.payload as { type: string; content: string } | undefined;
            api.notifications.open({
              type: notifPayload?.type ?? 'info',
              content: notifPayload?.content ?? 'Notification from Webview Showcase',
              source: 'Webview Showcase',
            });
            break;
          }

          case 'counter-update':
            api.webviews.postMessage(iframeId, {
              type: 'counter-ack',
              payload: { value: message.payload, serverTimestamp: Date.now() },
            });
            break;
        }
      })
      .then((disposer) => {
        messageDisposers.set(iframeId, disposer);
      });
  });

  await api.settings.register({
    'plugin.webview-showcase.panes.showExample': {
      type: 'boolean',
      label: 'Show Webview Example Pane',
      description: 'Toggles the Webview Example Pane.',
      category: 'Webview Showcase',
      default: true,
    },
  });

  await api.commands.register(
    'webviewShowcase.openEditor',
    async () => {
      await api.editors.openDocument('ext://webview-showcase/main');
    },
    { visibleInSearch: true, description: 'Webview Showcase: Open Editor' },
  );

  await api.commands.register(
    'webviewShowcase.togglePane',
    async () => {
      sidebarVisible = !sidebarVisible;
      await api.panes.setVisible('sidebar', sidebarVisible);
      await api.settings.set('plugin.webview-showcase.panes.showExample', sidebarVisible);
    },
    { visibleInSearch: true, description: 'Webview Showcase: Toggle Pane' },
  );

  await api.commands.register(
    'sendPing',
    async () => {
      state.pingsSent++;
      for (const iframeId of state.iframeIds) {
        await api.webviews.postMessage(iframeId, {
          type: 'host-ping',
          payload: { pingNumber: state.pingsSent, timestamp: Date.now() },
        });
      }
      return { pingsSent: state.pingsSent, targetCount: state.iframeIds.size };
    },
    { visibleInSearch: true, description: 'Webview Showcase: Send Ping to All Iframes' },
  );

  await api.commands.register('getState', () => ({
    ...state,
    iframeIds: [...state.iframeIds],
  }));

  // ── Sidebar Pane (Batch 3.4) ─────────────────────────────────────
  const sidebarIframeId = 'pane:plugin.webview-showcase.sidebar';

  await api.panes.registerWebviewPane({
    id: 'sidebar',
    title: 'Showcase',
    area: 'right',
    groupId: 'property',
    icon: 'ph ph-puzzle-piece',
    webviewOptions: {
      entryPoint: 'webview/dist/sidebar.html',
    },
  });

  const initialShowSidebar = await api.settings.get('plugin.webview-showcase.panes.showExample');
  sidebarVisible = !!initialShowSidebar;
  await api.panes.setVisible('sidebar', sidebarVisible);

  await api.settings.onDidChange('plugin.webview-showcase.panes.showExample', async (value: unknown) => {
    sidebarVisible = !!value;
    await api.panes.setVisible('sidebar', sidebarVisible);
  });

  api.webviews
    .onMessage(sidebarIframeId, (data: unknown) => {
      const message = data as { type: string; payload?: unknown };

      switch (message.type) {
        case 'sidebar-ready':
          api.webviews.postMessage(sidebarIframeId, { type: 'sidebar-init' });
          sendSidebarState();
          break;

        case 'sidebar-request-state':
          sendSidebarState();
          break;

        case 'sidebar-open-editor':
          api.editors.openDocument('ext://webview-showcase/main');
          break;

        case 'sidebar-send-ping':
          state.pingsSent++;
          for (const iframeId of state.iframeIds) {
            api.webviews.postMessage(iframeId, {
              type: 'host-ping',
              payload: { pingNumber: state.pingsSent, timestamp: Date.now() },
            });
          }
          api.webviews.postMessage(sidebarIframeId, {
            type: 'sidebar-notification',
            payload: { text: `Pinged ${state.iframeIds.size} editor(s)` },
          });
          break;
      }
    })
    .then((disposer) => {
      messageDisposers.set(sidebarIframeId, disposer);
    });

  // ── Pane Visibility (Batch 6.8) ────────────────────────────────

  await api.commands.register('forcePaneVisible', async (visible: unknown) => {
    sidebarVisible = visible as boolean;
    await api.panes.setVisible('sidebar', sidebarVisible);
  });

  function sendSidebarState(): void {
    api.webviews.postMessage(sidebarIframeId, {
      type: 'sidebar-state',
      payload: {
        messagesReceived: state.messagesReceived,
        iframeCount: state.iframeIds.size,
        pingsSent: state.pingsSent,
      },
    });
  }
};

module.exports.deactivate = async (): Promise<void> => {
  for (const disposer of messageDisposers.values()) {
    disposer.dispose();
  }
  messageDisposers.clear();
  state.iframeIds.clear();
};
