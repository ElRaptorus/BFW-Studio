import { AbstractEmitter } from '../AbstractEmitter';

type BufferedEvent = {
  name: string;
  args: any[];
};

export abstract class AbstractEmitterWithInitialBuffer extends AbstractEmitter {
  private isBuffered = true;
  private bufferedEvents: BufferedEvent[] = [];

  protected emit(eventName: string, args: any[] = []): void {
    if (this.isBuffered) {
      this.bufferedEvents.push({ name: eventName, args: args });
    } else {
      super.emit(eventName, args);
    }
  }

  /**
   * Flushes all buffered events as if they were emitted just now and stops buffering events afterwards.
   */
  releaseEventBuffer(): void {
    this.bufferedEvents.forEach(({ name, args }) => super.emit(name, args));
    this.bufferedEvents = [];
    this.isBuffered = false;
  }
}
