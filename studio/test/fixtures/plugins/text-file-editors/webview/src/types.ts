export interface StudioWebviewApi {
  postMessage(data: unknown): void;
  onMessage(callback: (data: unknown) => void): void;
  setState(state: unknown): void;
  getState(): unknown;
  getThemeType(): string;
}

/**
 * Reads the `acquireStudioApi` bridge function injected into the iframe by the Studio's
 * webview bridge script. Deliberately *not* a `declare global` augmentation of `Window`:
 * every fixture webview would then declare the same global in one TypeScript program,
 * which collides (TS2717) when the Studio type-checks all fixtures at once.
 */
export function acquireStudioApi(): StudioWebviewApi | undefined {
  const acquire = (window as unknown as { acquireStudioApi?: () => StudioWebviewApi }).acquireStudioApi;
  return acquire?.();
}

export type HostToWebviewMessage = { type: 'load'; payload: string };

export function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element == null) {
    throw new Error(`[text-file-editors] Missing required element #${id} in the webview HTML shell.`);
  }
  return element;
}

export type WebviewToHostMessage = { type: 'ready' } | { type: 'change'; payload: string } | { type: 'save-requested' };

/**
 * Attaches a Ctrl+S / Cmd+S interceptor inside the iframe.
 *
 * Keydown events originating inside a plugin `<iframe>` never bubble to the host's
 * `KeybindingsMediator` (bound to `document.body` of the main renderer window) — standard
 * DOM/browser iframe isolation, not Studio-specific. Without this listener, saving is only
 * possible when focus happens to be outside the iframe (e.g. clicking a tab first).
 *
 * See docs/architecture/common-pitfalls.md
 * §"Ctrl+S does not reach the host from inside a plugin webview iframe".
 */
export function installSaveShortcut(studioApi: StudioWebviewApi): void {
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      studioApi.postMessage({ type: 'save-requested' } satisfies WebviewToHostMessage);
    }
  });
}
