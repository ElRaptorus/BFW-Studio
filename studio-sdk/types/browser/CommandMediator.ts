import type {
  Command,
  CommandCallbackFn,
  CommandContext,
  CommandRegistrationOptions,
  CommandResult,
} from '../contracts/CommandTypes';

/**
 * Provides access to the commands of Studio and its plugins.
 *
 * Commands are named, registered function callbacks with optional description, enabled predicate,
 * command search visibility, and context expectation — all controlled via a single options object.
 *
 * Registering a command visible in the command search palette:
 *
 *    studio.commands.register('std.editor.saveFocusedDocument',
 *      () => {
 *        const focusedEditorDocument = studio.editors.getFocusedEditorDocument();
 *        // implement the save logic
 *      },
 *      { visibleInSearch: true, description: 'Editor: Save focused document' }
 *    )
 *
 * Registering an internal command (not in command search):
 *
 *    studio.commands.register('std.editor.saveDocument',
 *      (editorDocument: EditorDocument): void => {
 *        // implement the save logic
 *      }
 *    )
 *
 * Executing a command:
 *
 *    studio.commands.executeCommand('std.editor.saveFocusedDocument')
 */
export declare class CommandMediator {
  /**
   * Executes the command with the given `name`, provides the given `args` as parameters.
   *
   * Returns the result of the registered callback. Throws an Error if the execution fails.
   */
  executeCommand<T = any>(name: string, commandArgs?: any[], commandContext?: CommandContext): T;

  /**
   * Executes the command with the given `name`, provides the given `args` as parameters.
   *
   * Returns a CommandResult which contains an Error if the execution failed.
   */
  tryToExecuteCommand<T = any>(name: string, commandArgs?: any[], commandContext?: CommandContext): CommandResult<T>;

  /**
   * Returns whether the command with the given `name` is enabled.
   *
   * If the command is not registered, returns `false` (does not throw). If the enabled predicate
   * throws, the implementation may show an error notification (at most once per distinct failure)
   * and still returns `false`.
   */
  isCommandEnabled(name: string, commandArgs?: any[]): boolean;

  /**
   * Returns `true` if a command with the given `commandName` is registered.
   */
  isRegistered(commandName: string): boolean;

  /**
   * Returns a click handler that can be used inside React components to easily execute commands.
   */
  getClickHandler(): (commandName: string, commandArgs?: any[]) => (event: any) => void;

  /**
   * Returns all registered commands.
   */
  getCommands(): Command[];

  /**
   * Registers a command with the given name and callback.
   *
   * By default, commands are internal (not shown in the command search palette).
   * Use the `options` parameter to control visibility, description, context expectation,
   * and enabled predicate.
   *
   * Example (internal command):
   *
   *    studio.commands.register("foo.getService", () => fooService)
   *
   * Example (searchable command with description and enabled predicate):
   *
   *    studio.commands.register("foo.save", () => save(), {
   *      visibleInSearch: true,
   *      description: "Foo: Save document",
   *      enabledWhen: () => hasUnsavedChanges(),
   *    })
   */
  register<T>(name: string, callbackFn: CommandCallbackFn<T>, options?: CommandRegistrationOptions): void;
}
