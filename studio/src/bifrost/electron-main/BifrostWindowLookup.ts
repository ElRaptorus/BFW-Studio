import type BifrostWindow from './BifrostWindow';

export default class BifrostWindowLookup {
  private windows: { [windowId: string]: BifrostWindow };
  private windowsIds: string[];

  constructor() {
    this.windows = {};
    this.windowsIds = [];
  }

  focus(focussedId: string): void {
    this.windowsIds = [focussedId].concat(...this.windowsIds.filter((id: string) => id !== focussedId));
  }

  getFocussedWindow(): BifrostWindow {
    const windowId = this.windowsIds[0];

    return this.getWindowById(windowId);
  }

  getWindowById(id: string): BifrostWindow {
    const bifrostWindow = this.windows[id];
    if (bifrostWindow == null) {
      throw new Error(`Could not find BifrostWindow with id '${id}'.`);
    }

    return bifrostWindow;
  }

  getWindowIds(): string[] {
    return this.windowsIds;
  }

  register(id: string, win: BifrostWindow): void {
    this.windows[id] = win;
    this.windowsIds.unshift(id);
  }

  remove(removedId: string): void {
    this.windowsIds = this.windowsIds.filter((id: string) => id !== removedId);
    delete this.windows[removedId];
  }
}
