import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { StudioEventName } from '#bifrost/contracts/StudioEvents';

const BIFROST_EVENT_DELAY = 73;
const BIFROST_UNSPECIFIED_GLOBAL_UPDATE_DELAY = 160;

export class BifrostEventEmitter extends AbstractEmitter {
  private unspecifiedGlobalUpdateTimeoutId: any = null;

  emitBifrostEvent(bifrostEventName: StudioEventName, args: any[] = []): void {
    if (bifrostEventName === 'unspecifiedGlobalUpdate') {
      this.delayUnspecifiedGlobalUpdate();
    } else {
      setTimeout(() => this.emit(bifrostEventName, args), BIFROST_EVENT_DELAY);
    }
  }

  private delayUnspecifiedGlobalUpdate(): void {
    if (this.unspecifiedGlobalUpdateTimeoutId != null) {
      clearTimeout(this.unspecifiedGlobalUpdateTimeoutId);
    }

    this.unspecifiedGlobalUpdateTimeoutId = setTimeout(() => {
      this.unspecifiedGlobalUpdateTimeoutId = null;
      this.emit('unspecifiedGlobalUpdate');
    }, BIFROST_UNSPECIFIED_GLOBAL_UPDATE_DELAY);
  }
}
