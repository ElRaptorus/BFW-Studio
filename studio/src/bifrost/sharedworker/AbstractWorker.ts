/**
 * The `AbstractWorker` lives inside a shared worker and abstracts method calls to that worker.
 *
 * It has a complimentary class in `AbstractWorkerClient`, which abstracts the calls to the server.
 *
 * Example:
 *
 *      //
 *      // MyWorkerClient.js
 *      //
 *
 *      import { AbstractWorkerClient } from './AbstractWorkerClient';
 *
 *      export class MyWorkerClient extends AbstractWorkerClient {
 *        constructor() {
 *          const worker = new Worker(new URL('../webworker/SearchIndexWorker.ts', import.meta.url));
 *          super(worker);
 *        }
 *
 *       async add(a: number, b: number): Promise<number> {
 *         return this.invoke('add', a, b);
 *       }
 *      }
 *
 *        async add(a: number, b: number): Promise<number> {
 *          return this.invoke('add', a, b);
 *        }
 *      }
 *
 *      //
 *      // MyWorker.ts
 *      //
 *
 *      import { AbstractWorker } from './AbstractWorker';
 *
 *      class MyWorker extends AbstractWorker {
 *        async add(a: number, b: number): Promise<number> {
 *          return a + b;
 *        }
 *      }
 *
 *      const server = new MyWorker(self as any);
 *
 *      //
 *      // inside the app
 *      //
 *
 *      // create an instance of the client and keep it
 *      this.myWorker = new MyWorkerClient();
 *
 *      // later, use it like every other object
 *      const result = await this.myWorker.add(123, 456);
 *
 */
/// <reference lib="webworker" />

export class AbstractWorker {
  protected connections: MessagePort[] = [];

  constructor(workerContext: SharedWorkerGlobalScope) {
    workerContext.onconnect = (event: MessageEvent) => {
      const port = event.ports[0];
      this.connections.push(port);

      port.onmessageerror = (error) => {
        throw new Error(`OnMessageError: ${error.data}\n${error.type}\n${error.lastEventId}`);
      };
      port.onmessage = async (event: MessageEvent) => {
        const message = event.data.__message;
        const messageId = event.data.__messageId;

        try {
          if (messageId != null) {
            const result = await this.handleMessage(message, port);

            port.postMessage({ __message: result, __messageId: messageId });
          } else {
            await this.handleMessage(message, port);
          }
        } catch (error) {
          port.postMessage({ __message: 'error', __messageId: messageId, type: 'error', error });
        }
      };

      port.start();
      this.broadcast({ __message: 'connected', ports: this.connections.length });
    };

    workerContext.onerror = (error) => {
      this.broadcast({ __message: 'error', type: 'error', error });
    };

    workerContext.onunhandledrejection = (error) => {
      this.broadcast({ __message: 'error', type: 'unhandledrejection', error });
    };
  }

  protected broadcast(message, senderPort?: MessagePort): void {
    this.connections.forEach((connection) => {
      if (senderPort == null || connection !== senderPort) {
        try {
          connection.postMessage(message);
        } catch {
          this.disconnect(connection);
        }
      }
    });
  }

  private disconnect(port: MessagePort): void {
    this.connections = this.connections.filter((conn) => conn !== port);
    this.broadcast({ __message: 'disconnected', ports: this.connections.length });
  }

  private async handleMessage(message: any, port: MessagePort): Promise<any> {
    const handleFn = (this as { [key: string]: any })[message.methodName] as (...args: unknown[]) => unknown;

    if (handleFn != null) {
      return handleFn.apply(this, [...message.methodArgs, port]);
    }

    throw new Error(`Could not find method '${message.methodName}' on Worker '${this.constructor.name}'`);
  }
}
