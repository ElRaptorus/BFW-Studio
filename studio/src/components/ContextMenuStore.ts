export type ContextMenuState = {
  x: number;
  y: number;
  menuId: string;
  menuArgs: any[];
} | null;

type Listener = (state: ContextMenuState) => void;

let currentState: ContextMenuState = null;
const listeners: Set<Listener> = new Set();

function notify(): void {
  for (const listener of listeners) {
    listener(currentState);
  }
}

export const ContextMenuStore = {
  show(x: number, y: number, menuId: string, menuArgs: any[]): void {
    currentState = { x, y, menuId, menuArgs };
    notify();
  },

  hide(): void {
    if (currentState == null) {
      return;
    }
    currentState = null;
    notify();
  },

  getState(): ContextMenuState {
    return currentState;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
