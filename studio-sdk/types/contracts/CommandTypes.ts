/**
 * Commands are named, registered function callbacks, optionally providing a description and enabled predicate function.
 */
export declare type Command = {
  /** name of the command */
  readonly name: string;
  /**
   * Text displayed in the command search.
   * Can be multi-line to allow for commands being found under different phrases:
   * A command with the `description` "Editor: Zoom to viewport\nEditor: Fit diagram onto screen"
   * will be found when searching for "zoom" as well as "fit".
   */
  readonly description: string;
  /**
   * whether or not the command should be displayed in the command search
   */
  readonly visibleInSearch: boolean;
  /**
   * whether or not the command expects the `CommandContext` as first parameter to its callback
   */
  readonly expectsCommandContext: boolean;
  /**
   * function that is executed when calling the command
   */
  readonly callbackFn: CommandCallbackFn;
  /**
   * function that can decide whether the command is currently enabled
   */
  readonly enabledPredicateFn: CommandEnabledPredicateFn;
};
/**
 * Options for registering a command via `studio.commands.register()`.
 */
export declare type CommandRegistrationOptions = {
  readonly description?: string | string[];
  readonly visibleInSearch?: boolean;
  readonly expectsContext?: boolean;
  readonly enabledWhen?: CommandEnabledPredicateFn;
};
/**
 * Command callback functions are named, registered function callbacks that are invoked with the arguments given
 * to `studio.commands.executeCommand`.
 *
 * For callbacks registered with `expectsContext: true`, the callbacks take a `CommandContext` as their first
 * argument and the arbitrary arguments thereafter.
 *
 * The `CommandContext` argument represents the context in which the command was triggered and contains - depending on
 * its `type` - the keyboard or mouse event that triggered the command, thus exposing the target DOM element,
 * modifier keys, mouse position etc.
 */
export declare type CommandCallbackFn<T = any> = (...commandArgs: any[]) => T | Promise<T>;
/**
 * Commands can be disabled if they are registered with an enabled predicate function.
 *
 * Studio calls this function with the arguments `editorDocument, editorDocumentModel, studio` to determine whether or
 * not the command is enabled or disabled.
 */
export declare type CommandEnabledPredicateFn = (...commandsArgs: any[]) => boolean;
/**
 * Represents the context in which the command was triggered and contains - depending on its `type` - the keyboard or
 * mouse event that triggered the command, thus exposing the target DOM element, modifier keys, mouse position etc.
 */
export declare type CommandContext =
  CommandContext_Keybinding | CommandContext_Mouse | CommandContext_Generic | undefined;
export declare type CommandContext_Keybinding = {
  readonly type: 'keybinding';
  readonly keyboardEvent: KeyboardEvent;
};
export declare type CommandContext_Mouse = {
  readonly type: 'mouse';
  readonly mouseEvent: MouseEvent;
};
export declare type CommandContext_Generic = {
  readonly type: 'generic';
  readonly data: any;
  readonly event?: any;
};
export declare type CommandResult<T> = CommandResult_Success<T> | CommandResult_Failure;
declare type CommandResult_Success<T> = {
  readonly success: true;
  readonly returnValue: T;
};
declare type CommandResult_Failure = {
  readonly success: false;
  readonly error: Error;
};
export {};
