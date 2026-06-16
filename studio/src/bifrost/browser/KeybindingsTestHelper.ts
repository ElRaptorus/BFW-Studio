type KeyboardEventOptions = {
  key: string;
  keyCode?: number;
  metaKey?: boolean;
  crtlKey?: boolean;
  shiftKey?: boolean;
  bubbles?: boolean;
};

export function dispatchKeyboardEvent(options: any, type: string = 'keydown'): void {
  const event = createKeyboardEvent(type, options);
  document.body.dispatchEvent(event);
}

export function createKeyboardEvent(type: string, options: KeyboardEventOptions): KeyboardEvent {
  if (options.key.length === 1 && !options.keyCode) {
    options.keyCode = options.key.charCodeAt(0);
  }
  options.bubbles = true;

  const event = new KeyboardEvent(type, options as any);
  Object.defineProperty(event, 'keyCode', { value: options.keyCode });
  return event;
}
