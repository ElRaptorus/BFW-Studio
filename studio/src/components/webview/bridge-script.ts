/**
 * Bridge script that runs inside each plugin iframe.
 *
 * Served by the custom protocol as a normal JavaScript file — the
 * plugin's HTML includes it via `<script src="/studio-bridge.js"></script>`.
 *
 * This is NOT a preload script. It runs in the iframe's main world
 * with no access to Node.js or Electron APIs. It exposes
 * `window.acquireStudioApi()` for plugin code to use.
 *
 * Build target: `web` (standard browser context).
 */

type StudioThemeType = 'light' | 'dark';

interface StudioWebviewApi {
  postMessage(data: unknown): void;
  onMessage(callback: (data: unknown) => void): void;
  setState(state: unknown): void;
  getState(): unknown;
  getThemeType(): StudioThemeType;
}

const BRIDGE_CHANNEL = 'studio-bridge';

let currentState: unknown = undefined;
let messageCallback: ((data: unknown) => void) | undefined;

const api: StudioWebviewApi = {
  postMessage(data: unknown): void {
    window.parent.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        direction: 'to-host',
        payload: { type: 'plugin-message', data },
      },
      '*',
    );
  },

  onMessage(callback: (data: unknown) => void): void {
    messageCallback = callback;
  },

  setState(state: unknown): void {
    currentState = state;
    window.parent.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        direction: 'to-host',
        payload: { type: 'set-state', state },
      },
      '*',
    );
  },

  getState(): unknown {
    return currentState;
  },

  getThemeType(): StudioThemeType {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },
};

window.addEventListener('message', (event) => {
  if (event.data?.channel !== BRIDGE_CHANNEL || event.data?.direction !== 'to-guest') {
    return;
  }

  const payload = event.data.payload;
  if (payload.type === 'plugin-message' && messageCallback) {
    messageCallback(payload.data);
  }
  if (payload.type === 'restore-state') {
    currentState = payload.state;
  }
  if (payload.type === 'theme') {
    applyThemeTokens(payload.tokens, payload.themeType === 'light' ? 'light' : 'dark');
  }
});

function applyThemeTokens(tokens: Record<string, string>, themeType: StudioThemeType): void {
  let styleEl = document.getElementById('studio-theme-tokens');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'studio-theme-tokens';
    document.head.appendChild(styleEl);
  }

  const cssVars = Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  styleEl.textContent = `:root {\n${cssVars}\n  --studio-theme-type: ${themeType};\n}`;
  document.documentElement.setAttribute('data-theme', themeType);
}

(window as any).acquireStudioApi = () => api;
