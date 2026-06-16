export declare type AbstractSubscription = {
  dispose: () => void;
};

export declare type AbstractListener = (...args: any[]) => void;

export declare abstract class AbstractEmitter {
  on(eventName: string, listener: AbstractListener): AbstractSubscription;
  once(eventName: string, listener: AbstractListener): AbstractSubscription;
}
