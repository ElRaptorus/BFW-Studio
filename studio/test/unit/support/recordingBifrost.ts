import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogResult } from '#bifrost/contracts/DialogTypes';
import type { EngineConnectionManager } from '#modules/engine-core';

type CommandHandler = (...commandArguments: any[]) => unknown;

export type RecordedCall = { method: string; arguments: unknown[] };

/**
 * Minimal Bifrost stand-in for unit tests of command registrations: commands run their real
 * handlers, every other interaction (client calls, dialogs, notifications) is recorded.
 */
export function createRecordingBifrost(options: { dialogResult?: DialogResult } = {}) {
  const handlers = new Map<string, CommandHandler>();
  const calls: RecordedCall[] = [];

  const bifrost = {
    commands: {
      register: (commandName: string, handler: CommandHandler) => {
        handlers.set(commandName, handler);
      },
      executeCommand: (commandName: string, commandArguments: unknown[] = []) => {
        calls.push({ method: `command:${commandName}`, arguments: commandArguments });
        const handler = handlers.get(commandName);
        if (handler == null) {
          throw new Error(`Command ${commandName} is not registered.`);
        }
        return handler(...commandArguments);
      },
    },
    dialog: {
      open: async (dialogOptions: unknown) => {
        calls.push({ method: 'dialog.open', arguments: [dialogOptions] });
        return options.dialogResult ?? { wasCancelled: true };
      },
    },
    notifications: {
      open: (notification: unknown) => {
        calls.push({ method: 'notifications.open', arguments: [notification] });
      },
    },
  };

  return { bifrost: bifrost as unknown as Bifrost, calls, handlers };
}

/** A connection manager whose single connected engine records every client call into `calls`. */
export function createRecordingConnectionManager(
  calls: RecordedCall[],
  failures: Partial<Record<string, Error>> = {},
): EngineConnectionManager {
  const recordingNamespace = (namespace: string) =>
    new Proxy(
      {},
      {
        get:
          (_target, method: string) =>
          async (...callArguments: unknown[]) => {
            const methodName = `${namespace}.${method}`;
            calls.push({ method: methodName, arguments: callArguments });
            const failure = failures[methodName];
            if (failure != null) {
              throw failure;
            }
            return undefined;
          },
      },
    );

  const client = new Proxy({}, { get: (_target, namespace: string) => recordingNamespace(namespace) });
  const connection = { engineId: 'engine-1', url: 'http://engine', state: 'connected', client };

  return {
    getConnection: (engineId: string) => (engineId === connection.engineId ? connection : undefined),
    getConnectionByUrl: (url: string) => (url === connection.url ? connection : undefined),
    getClient: (engineId: string) => (engineId === connection.engineId ? client : undefined),
    isConnected: (engineId: string) => engineId === connection.engineId,
  } as unknown as EngineConnectionManager;
}

export function recordedMethods(calls: RecordedCall[]): string[] {
  return calls.map((call) => call.method);
}
