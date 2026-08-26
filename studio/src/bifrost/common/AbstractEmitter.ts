import { EventEmitter } from 'events';

export type AbstractSubscription = {
  dispose: () => void;
};
export type AbstractListener = (...args: any[]) => void;

export abstract class AbstractEmitter {
  protected eventEmitter: EventEmitter = new EventEmitter();

  on(eventName: string, listener: AbstractListener): AbstractSubscription {
    this.eventEmitter.on(eventName, listener);

    return this.createSubscription(eventName, listener);
  }

  once(eventName: string, listener: AbstractListener): AbstractSubscription {
    this.eventEmitter.once(eventName, listener);

    return this.createSubscription(eventName, listener);
  }

  protected emit(eventName: string, args: any[] = []): void {
    this.eventEmitter.emit(eventName, ...args);
  }

  protected getListenerCount(eventName: string): number {
    return this.eventEmitter.listenerCount(eventName);
  }

  protected removeAllListeners(eventName?: string | symbol | undefined): void {
    this.eventEmitter.removeAllListeners(eventName);
  }

  private createSubscription(eventName: string, listener: AbstractListener): AbstractSubscription {
    return {
      dispose: () => this.eventEmitter.off(eventName, listener),
    };
  }
}
