import { KeybindingsManager } from '#bifrost/browser/KeybindingsManager';
import assert from 'node:assert';
import { afterEach, describe, it, vi } from 'vitest';

const EDITOR_SELECTOR = '.kbm-editor[data-editor-document-type=bpmn-landscape-map]';

/** Presses Ctrl+F on an `svg` inside the landscape editor and returns the command that ran. */
function commandForCtrlF(manager: KeybindingsManager, sendKeydown: (event: unknown) => void): string | null {
  let executed: string | null = null;
  manager.on('executeCommand', (command: string) => {
    executed = command;
  });
  sendKeydown({
    key: 'f',
    keyCode: 70,
    ctrlKey: true,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    target: { nodeName: 'svg', matches: (selector: string) => selector.includes(' svg') },
  });
  return executed;
}

describe('KeybindingsManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the binding of the more specific selector, whatever the registration order', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64' });
    for (const order of [
      ['body', EDITOR_SELECTOR],
      [EDITOR_SELECTOR, 'body'],
    ]) {
      let sendKeydown: (event: unknown) => void = () => {};
      const rootElement = {
        addEventListener: (_type: string, listener: (event: unknown) => void) => (sendKeydown = listener),
      };
      const manager = new KeybindingsManager(rootElement as unknown as Element, 'electron', 'linux');
      for (const selector of order) {
        const command = selector === 'body' ? 'std.editor.showAndFocusInlineSearch' : 'bpmn.landscape.find';
        manager.registerKeyBindings({ client: '*', os: '*', bindings: { [selector]: { 'ctrl-f': command } } });
      }

      assert.equal(commandForCtrlF(manager, sendKeydown), 'bpmn.landscape.find', `order ${order.join(', ')}`);
    }
  });
});
