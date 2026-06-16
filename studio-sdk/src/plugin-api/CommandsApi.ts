import type { PluginCommandOptions, SerializedCommandInfo, SerializedCommandResult } from './types';

/**
 * Command registration and execution API.
 *
 * Command IDs are automatically namespaced to `plugin.<pluginName>.<id>` when registered.
 * Use the full namespaced ID when calling {@link executeCommand} across plugins.
 */
export interface CommandsApi {
  /**
   * Register a command with the given ID and callback.
   *
   * By default, commands are internal (not visible in the command search palette).
   * Pass an `options` object to control visibility and description.
   *
   * @param id - Command identifier (auto-namespaced to `plugin.<pluginName>.<id>`).
   * @param callback - Handler invoked when the command is executed.
   * @param options - Optional settings for search visibility and description.
   */
  register(id: string, callback: (...args: unknown[]) => unknown, options?: PluginCommandOptions): Promise<void>;

  /**
   * Execute a registered command by its full ID.
   *
   * @param id - Full command ID (including namespace, e.g. `"plugin.my-plugin.hello"`).
   * @param args - Optional arguments forwarded to the command handler.
   * @returns The value returned by the command handler.
   */
  executeCommand(id: string, args?: unknown[]): Promise<unknown>;

  /**
   * Execute a command, returning a structured result instead of throwing on failure.
   *
   * @param id - Full command ID.
   * @param args - Optional arguments forwarded to the command handler.
   */
  tryToExecuteCommand(id: string, args?: unknown[]): Promise<SerializedCommandResult>;

  /**
   * Check whether a command is currently enabled.
   *
   * @param id - Full command ID.
   * @param args - Optional arguments passed to the enabled predicate.
   */
  isCommandEnabled(id: string, args?: unknown[]): Promise<boolean>;

  /** Check whether a command with the given name is registered. */
  isRegistered(commandName: string): Promise<boolean>;

  /** Retrieve a list of all registered commands (serializable subset). */
  getCommands(): Promise<SerializedCommandInfo[]>;
}
