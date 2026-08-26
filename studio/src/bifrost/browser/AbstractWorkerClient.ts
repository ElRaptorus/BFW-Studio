import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { Debugger } from 'debug';
import Debug from 'debug';

type WorkerType = Worker | SharedWorker;
/**
 * The `AbstractWorkerClient` abstracts calls to a web worker.
 *
 * The goal is to be able to implement the same function signature on both the client and the web worker side
 * so we can use the web worker through its client as if it was a local variable/instance.
 *
 * Example:
 *
 *    //
 *    // MyWorkerClient.js
 *    //
 *
 *    import { AbstractWorkerClient } from './AbstractWorkerClient';
 *    import Worker from 'worker-loader!./MyWorker';
 *
 *    export class MyWorkerClient extends AbstractWorkerClient {
 *      constructor() {
 *        super(new Worker());
 *      }
 *
 *      async add(a: number, b: number): Promise<number> {
 *        return this.invoke('add', a, b);
 *      }
 *    }
 *
 *    //
 *    // MyWorker.ts
 *    //
 *
 *    import { AbstractWorkerServer } from './AbstractWorkerServer';
 *
 *    class MyWorker extends AbstractWorkerServer {
 *      async add(a: number, b: number): Promise<number> {
 *        return a + b;
 *      }
 *    }
 *
 *    const server = new MyWorker(self as any);
 *
 *    //
 *    // inside the app
 *    //
 *
 *    // create an instance of the client and keep it
 *    this.myWorker = new MyWorkerClient();
 *
 *    // later, use it like every other object
 *    const result = await this.myWorker.add(123, 456);
 *
 */
export abstract class AbstractWorkerClient<T extends WorkerType = Worker> extends AbstractEmitter {
  private messageIdCounter: number = 0;
  private messageResponses: any = {};
  private port: MessagePort;

  protected worker: T;
  protected log: Debugger;

  constructor(worker: T, logPrefix?: string) {
    super();
    this.log = Debug(`${logPrefix || ''}/${this.constructor.name}`);
    this.log('Initializing AbstractWorkerClient');

    this.worker = worker;

    if (worker instanceof SharedWorker) {
      this.port = worker.port;
      this.port.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (event) => {
        this.log('Error in worker:', event);
        this.emit('error', [event]);
      };
      this.port.start();
    } else {
      this.port = worker as unknown as MessagePort;
      this.port.onmessage = this.handleMessage.bind(this);
    }
  }

  on(event: 'error', listener: (event: ErrorEvent) => void): ReturnType<typeof AbstractEmitter.prototype.on>;
  on(
    event: 'error',
    listener: (event: { __message: 'error'; type: 'error' | 'unhandledrejection'; error: Error }) => void,
  ): ReturnType<typeof AbstractEmitter.prototype.on>;
  on(
    event: 'connected',
    listener: (event: { __message: 'connected'; ports: number }) => void,
  ): ReturnType<typeof AbstractEmitter.prototype.on>;
  on(
    event: 'disconnected',
    listener: (event: { __message: 'disconnected'; ports: number }) => void,
  ): ReturnType<typeof AbstractEmitter.prototype.on>;
  on(event: string, listener: (...args: any[]) => void): ReturnType<typeof AbstractEmitter.prototype.on>;
  on(event: string, listener: (...args: any[]) => void): ReturnType<typeof AbstractEmitter.prototype.on> {
    return super.on(event, listener);
  }

  private handleMessage(event: MessageEvent): void {
    this.log('Received message:', event.data);
    const message = event.data.__message;
    const messageId = event.data.__messageId;

    this.messageResponses[messageId] = message;
    if (!messageId) {
      this.emit(message, [event.data]);
    }
  }

  /**
   * Invokes the method with the given `methodName` and `methodArgs` on the `AbstractWorkerServer` object
   * and returns the result.
   */
  protected async invoke(methodName: string, ...methodArgs: any[]): Promise<any> {
    this.log(`Invoking method: ${methodName} with arguments:`, methodArgs);
    return this.postMessageAndAwaitResult({ methodName, methodArgs });
  }

  /**
   * Invokes the method with the given `methodName` and `methodArgs` on the `AbstractWorkerServer` object.
   */
  protected invokeWithoutReturn(methodName: string, ...methodArgs: any[]): void {
    this.log(`Invoking method without return: ${methodName} with arguments:`, methodArgs);
    this.postMessage({ methodName, methodArgs });
  }

  private async postMessageAndAwaitResult(message: any, maxRetries = 1000, retryInterval = 100): Promise<any> {
    const messageId = this.generateMessageId();
    this.log(`Posting message with ID: ${messageId}`, message);

    this.port.postMessage({ __messageId: messageId, __message: message });

    let retryCount = 0;
    while (true) {
      // this.messageResponses[messageId] is never true if the result was set with:
      // id1: null,
      // id2: undefined,
      // id3: 0,
      // id4: '',
      // id5: false,
      // so we need to check if the key exists
      if (Object.hasOwn(this.messageResponses, messageId)) {
        const result = this.messageResponses[messageId];
        delete this.messageResponses[messageId];
        this.log(`Received response for message ID: ${messageId}`, result);

        return result;
      }

      if (++retryCount > maxRetries) {
        this.log(
          `Worker invocation for the following message failed after ${maxRetries} retries:`,
          `WorkerClient: ${this.constructor.name}`,
          `Message: ${JSON.stringify(message, null, 2)}`,
        );

        break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  private postMessage(message: any): void {
    this.log('Posting message:', message);
    this.port.postMessage({ __message: message });
  }

  private generateMessageId(): number {
    const newMessageId = ++this.messageIdCounter;
    this.log(`Generated new message ID: ${newMessageId}`);
    return newMessageId;
  }
}
