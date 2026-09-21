# Webview Showcase

A fully-featured example plugin demonstrating iframe-based editor document types and panes with React UI, theming, and two-way messaging between the plugin host and the webview.

## What is this?

This plugin registers a custom **Editor Document Type** and a **Sidebar Pane**, both backed by sandboxed `<iframe>` containers. When you open the showcase editor or expand the sidebar, the Studio loads React applications inside the iframes via the `bifrostfw-webview://` custom protocol. The plugin backend (running in the Plugin Host child process) and the iframe UIs communicate bidirectionally through the Studio's messaging bridge.

It exercises the following APIs:

| API                                         | Namespace       | Purpose                                                   |
| ------------------------------------------- | --------------- | --------------------------------------------------------- |
| `api.editors.registerWebviewDocumentType()` | `editors`       | Registers the iframe-backed editor document type          |
| `api.editors.openDocument()`                | `editors`       | Opens the showcase editor tab programmatically            |
| `api.panes.registerWebviewPane()`           | `panes`         | Registers the sidebar pane in the right property area     |
| `api.panes.setVisible()`                    | `panes`         | Shows or hides the pane (sole runtime visibility control) |
| `api.webviews.postMessage()`                | `webviews`      | Sends messages from the plugin to an iframe               |
| `api.webviews.onMessage()`                  | `webviews`      | Receives messages from an iframe in the plugin            |
| `api.notifications.open()`                  | `notifications` | Displays Studio notifications triggered by the iframe UI  |
| `api.commands.register()`                   | `commands`      | Registers commands (optionally visible in the palette)    |

## How to open the Showcase

### Editor Tab

Use the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

- **Webview Showcase: Open Editor** — opens the showcase editor tab

Alternatively, run the command programmatically:

```
bifrost.commands.executeCommand('plugin.webview-showcase.webviewShowcase.openEditor')
```

### Sidebar Pane

The sidebar pane titled **Showcase** appears in the right-side **Properties** pane area when the plugin is loaded. It is appended to the existing `property` pane group alongside other property panes (BPMN Properties, Git Changes, etc.). You can also open the editor tab from within the sidebar using the "Open Showcase Editor" button.

## Features and interactive controls

### Editor Tab

Once the showcase editor is open, you'll see several interactive sections:

#### Plugin Info

Displays the plugin metadata received from the host on initial handshake: plugin name, API version, a greeting message, and the connection timestamp. This confirms the `ready` → `init` message exchange worked.

#### Ping / Pong

Click **Send Ping** to send a `ping` message to the plugin host. The host immediately replies with a `pong` containing the original payload. The UI displays the round-trip latency in milliseconds.

#### Echo

Type any text and click **Echo** (or press Enter). The plugin host echoes the text back along with a running echo counter. This demonstrates arbitrary data round-tripping.

#### Counter

Use the **+**, **−**, and **Reset** buttons to change a counter value. Every change is sent to the host as a `counter-update` message. The host acknowledges each update with a `counter-ack` containing the confirmed value and a server-side timestamp.

#### Notifications

Click **Info**, **Warning**, or **Error** to ask the plugin host to display a native Studio notification of that type. This demonstrates the iframe triggering Studio-side actions through the messaging bridge (the iframe itself has no direct access to the notification system).

#### Host State

Click **Request State** to ask the plugin host for its internal state snapshot. The response shows how many messages the host has received, the last message content, all active iframe IDs, pings sent, and echo count.

#### Host Pings Received

When you run **Webview Showcase: Send Ping to All Iframes** from the command palette, the host sends a `host-ping` to every open showcase iframe. This section lists all received host pings, demonstrating host-initiated messaging.

#### Message Log

A live log of the last 50 messages (newest first), showing direction (`→` sent, `←` received), message type, timestamp, and payload. Useful for debugging and understanding the message flow.

### Sidebar Pane

The sidebar pane provides a compact control surface:

- **Connection Status** — shows whether the pane has established communication with the plugin host
- **Quick Actions** — Open the showcase editor tab, ping all editors, or refresh the plugin state
- **Plugin State** — live counters for total messages received, active editor iframe count, and last ping number
- **Activity Log** — scrollable log showing sidebar events (newest first)

The sidebar communicates with the plugin backend using its own message protocol (`sidebar-ready`, `sidebar-state`, `sidebar-notification`, etc.) independently from the editor tab messaging.

## Commands

All commands are namespaced under `plugin.webview-showcase.*`:

| Command                      | Palette Label                              | Description                                                    |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `webviewShowcase.openEditor` | Webview Showcase: Open Editor              | Opens the showcase editor tab                                  |
| `webviewShowcase.togglePane` | Webview Showcase: Toggle Pane              | Toggles the sidebar pane visibility                            |
| `sendPing`                   | Webview Showcase: Send Ping to All Iframes | Sends a ping from the host to every open showcase iframe       |
| `getState`                   | _(not in palette)_                         | Returns the plugin-side state snapshot (for testing)           |
| `forcePaneVisible`           | _(not in palette)_                         | Calls `setVisible('sidebar', visible)` — show or hide the pane |

## Pane Visibility

The sidebar pane is controlled entirely via `api.panes.setVisible()`. On activation, the plugin reads the `webviewShowcase.panes.showExample` setting and calls `setVisible('sidebar', value)` accordingly. It also subscribes to `api.settings.onDidChange()` so that toggling the setting immediately updates the pane's visibility.

This demonstrates the recommended pattern: plugins register a pane (visible by default), then use `setVisible` driven by settings or events as the sole runtime visibility control.

## Theming

Both the editor tab and the sidebar pane are fully themed using `--theme-*` CSS custom properties injected by the Studio bridge script. When the Studio theme changes, updated tokens are broadcast to all iframes automatically. The stylesheets use variables like:

- `--theme-fg`, `--theme-editor-bg`, `--theme-sidebar-bg`
- `--theme-border`, `--theme-accent`, `--theme-link`
- `--theme-surface-primary`, `--theme-surface-elevated`, `--theme-surface-inset`
- `--theme-input-bg`, `--theme-button-bg`, `--theme-button-hover-bg`
- `--theme-scrollbar-track`, `--theme-scrollbar-thumb`
- `--theme-success`, `--theme-warning`, `--theme-error`, `--theme-info`

All variables include dark-theme fallback values. The current theme type (`dark` / `light`) is displayed in the footer and is tracked via a `MutationObserver` on `document.documentElement[data-theme]`.

See `studio-sdk/src/webview/studio-webview-theme.css` for the full reference of available tokens.

## Message protocol

All messages between the iframes and the host follow a `{ type, payload? }` structure.

### Editor: Iframe → Host

| Type                | Payload                             | Description                                        |
| ------------------- | ----------------------------------- | -------------------------------------------------- |
| `ready`             | —                                   | Sent on iframe mount; triggers the `init` response |
| `ping`              | `{ sentAt: number }`                | Requests a pong for latency measurement            |
| `echo`              | `string`                            | Arbitrary text to echo back                        |
| `request-state`     | —                                   | Requests the host-side state snapshot              |
| `show-notification` | `{ type: string, content: string }` | Asks the host to display a notification            |
| `counter-update`    | `number`                            | Reports the current counter value                  |

### Editor: Host → Iframe

| Type           | Payload                                           | Description                       |
| -------------- | ------------------------------------------------- | --------------------------------- |
| `init`         | `{ pluginName, apiVersion, greeting, timestamp }` | Initial handshake response        |
| `pong`         | `{ receivedAt: number, echo: unknown }`           | Reply to a ping                   |
| `echo-reply`   | `{ original: string, echoCount: number }`         | Echoed text with counter          |
| `state-update` | `ShowcaseState`                                   | Host-side state snapshot          |
| `counter-ack`  | `{ value: number, serverTimestamp: number }`      | Counter acknowledgement           |
| `host-ping`    | `{ pingNumber: number, timestamp: number }`       | Host-initiated ping (via command) |

### Sidebar: Iframe → Host

| Type                    | Payload | Description                                     |
| ----------------------- | ------- | ----------------------------------------------- |
| `sidebar-ready`         | —       | Sent on sidebar mount; triggers initialization  |
| `sidebar-request-state` | —       | Requests the current plugin state               |
| `sidebar-open-editor`   | —       | Asks the host to open the showcase editor tab   |
| `sidebar-send-ping`     | —       | Asks the host to ping all active editor iframes |

### Sidebar: Host → Iframe

| Type                   | Payload                                        | Description                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------- |
| `sidebar-init`         | —                                              | Connection confirmation             |
| `sidebar-state`        | `{ messagesReceived, iframeCount, pingsSent }` | Plugin state snapshot               |
| `sidebar-notification` | `{ text: string }`                             | Inline notification for sidebar log |

## Project structure

```
webview-showcase/
├── package.json              # Plugin manifest (main: dist/index.js)
├── tsconfig.json             # Backend TypeScript config
├── README.md                 # This file
├── LOGO.png                  # Plugin logo (shown in Plugins pane)
├── src/
│   └── index.ts              # Plugin backend (activate/deactivate)
├── dist/
│   └── index.js              # Compiled backend (CommonJS)
└── webview/
    ├── package.json          # Frontend dependencies (React, esbuild)
    ├── tsconfig.json         # Frontend TypeScript config
    ├── build.mjs             # esbuild bundler script
    ├── src/
    │   ├── main.tsx          # React entry point (editor)
    │   ├── App.tsx           # Main React component (editor)
    │   ├── sidebar-main.tsx  # React entry point (sidebar)
    │   ├── Sidebar.tsx       # Sidebar React component
    │   ├── types.ts          # TypeScript type definitions
    │   ├── styles.css        # Themed stylesheet (editor)
    │   ├── sidebar.css       # Themed stylesheet (sidebar)
    │   ├── index.html        # HTML shell (editor)
    │   └── sidebar.html      # HTML shell (sidebar)
    └── dist/
        ├── index.html        # Copied HTML entry point (editor)
        ├── main.js           # Bundled React app (editor, esbuild IIFE)
        ├── styles.css        # Copied stylesheet (editor)
        ├── sidebar.html      # Copied HTML entry point (sidebar)
        ├── sidebar.js        # Bundled React app (sidebar, esbuild IIFE)
        └── sidebar.css       # Copied stylesheet (sidebar)
```

## Building from source

From `studio/`, compile both TypeScript fixtures (backend + webview) in one step:

```bash
npm run build:plugin-fixtures
```

**Backend only** (plugin host code):

```bash
cd studio/test/fixtures/plugins/webview-showcase
npx tsc
```

**Frontend** (iframe React apps — both editor and sidebar):

```bash
cd studio/test/fixtures/plugins/webview-showcase/webview
npm install
node build.mjs
```

The backend compiles `src/index.ts` → `dist/index.js` (CommonJS). The frontend bundles two React apps: `webview/src/main.tsx` → `webview/dist/main.js` and `webview/src/sidebar-main.tsx` → `webview/dist/sidebar.js` (both IIFE), and copies the HTML and CSS files to `webview/dist/`.
