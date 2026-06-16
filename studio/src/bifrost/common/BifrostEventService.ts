import type { StudioEmittableEventName, StudioEventName } from '@evil/bifrost_fw_sdk';

import type { BifrostEventListener, BifrostEventSubscription } from '../contracts/BifrostTypes';
import { BifrostEventEmitter } from './BifrostEventEmitter';

/**
 * Emits "BifrostEvents" which are meant for external consumers, e.g. extensions.
 *
 * The reason for this is that Bifrost's internal business logic should both be encapsuled from its external consumers
 * and that most external events have to account for the UI updates that are triggered when Bifrost's business logic
 * finishes.
 *
 * Example:
 *
 * If your plugin wants to trigger something upon Bifrost's startup based on the state of things post initialization:
 *
 *    bifrost.events.on("ready", () => {
 *      // at this point, the UI is done
 *      // all editors are open, all menu items are updated, the user interface is awaiting input
 *    })
 */
export class BifrostEventService {
  private emitter: BifrostEventEmitter;

  constructor() {
    this.emitter = new BifrostEventEmitter();
  }

  /**
   * Registers an event listener for a Bifrost Event.
   *
   * Example:
   *
   * If your plugin wants to trigger something upon Bifrost's startup based on the state of things post initialization:
   *
   *    bifrost.events.on("ready", () => {
   *      // at this point, the UI is done
   *      // all editors are open, all menu items are updated, the user interface is awaiting input
   *    })
   */
  on(eventName: StudioEventName, listener: BifrostEventListener): BifrostEventSubscription {
    return this.emitter.on(eventName, listener);
  }

  /**
   * Registers an event listener for a Bifrost Event.
   *
   * Example:
   *
   * If your plugin wants to trigger something upon Bifrost's startup based on the state of things post initialization:
   *
   *    bifrost.events.once("ready", () => {
   *      // at this point, the UI is done
   *      // all editors are open, all menu items are updated, the user interface is awaiting input
   *    })
   */
  once(eventName: StudioEventName, listener: BifrostEventListener): BifrostEventSubscription {
    return this.emitter.once(eventName, listener);
  }

  emit(bifrostEventName: StudioEmittableEventName, args: any[] = []): void {
    this.emitter.emitBifrostEvent(bifrostEventName, args);
  }

  /**
   * Internal
   */
  emitInternalBifrostEvent(bifrostEventName: StudioEventName, args: any[] = []): void {
    this.emitter.emitBifrostEvent(bifrostEventName, args);
  }
}
