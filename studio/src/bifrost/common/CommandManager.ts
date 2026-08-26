import { getClosestMatch } from '#bifrost/common/StringMatchFunctions';
import type {
  Command,
  CommandCallbackFn,
  CommandContext,
  CommandRegistrationOptions,
  CommandResult,
} from '#bifrost/contracts/CommandTypes';
import type { CommandEnabledPredicateFn } from '#bifrost/contracts/CommandTypes';

const NAME_VALID_CHARACTERS = ['a-z', '0-9', '-', '_', '.', 'A-Z'];
const NAME_VALID_CHARATERS_AS_SENTENCE = NAME_VALID_CHARACTERS.map((char) => `"${char}"`).join(', ');
const NAME_INVALID_CHARACTER_CLASS = `^${NAME_VALID_CHARACTERS.join('')}`;
const NAME_INVALID_REGEX = new RegExp(`[${NAME_INVALID_CHARACTER_CLASS}]`);

/**
 * Holds all commands executable by Bifrost.
 *
 * Commands are an important building block for Bifrost's API model as they provide a uniform interface to
 * execute a "thing" like "focus or open the document for a given URI" or "select and zoom to given element".
 */
export class CommandManager {
  static BIFROST_COMMAND_PREFIX_REGEX = /^std./;

  private commands: { [name: string]: Command };

  constructor() {
    this.commands = {};
  }

  /**
   * Returns `true` if a command with the given `commandName` is registered.
   */
  isCommandRegistered(commandName: string): boolean {
    return this.commands[commandName] != null;
  }

  /**
   * Returns all registered commands.
   */
  getCommands(): Command[] {
    return Object.values(this.commands);
  }

  /**
   * Executes the Command with the given `name`, providing the given `args` as parameters to the
   * registered callback function.
   */
  executeCommand<T = any>(name: string, args: any[] = [], commandContext?: CommandContext): T {
    const commandResult = this.tryToExecuteCommand<T>(name, args, commandContext);
    if (commandResult.success === false) {
      throw commandResult.error;
    }

    return commandResult.returnValue;
  }

  /**
   * Executes the Command with the given `name`, providing the given `args` as parameters to the
   * registered callback function.
   */
  tryToExecuteCommand<T>(name: string, args: any[] = [], commandContext?: CommandContext): CommandResult<T> {
    const foundCommand = this.commands[name];

    if (foundCommand == null) {
      return { success: false, error: new Error(this.getCommandNotFoundErrorMessage(name)) };
    }

    const callbackArgs = foundCommand.expectsCommandContext ? [commandContext, ...args] : [...args];

    try {
      const value: T = foundCommand.callbackFn.apply(null, callbackArgs);
      return { success: true, returnValue: value };
    } catch (e) {
      console.error(e);
      return { success: false, error: e };
    }
  }

  /**
   * Internal: Determines whether the Command with the given `name` is enabled.
   *
   * Takes an array of arguments via `givenEnabledPredicateFnArgs` which are provided to the command's
   * `enabledPredicateFn`.
   *
   * Used by `Bifrost`.
   */
  isCommandEnabled(name: string, givenEnabledPredicateFnArgs?: any[]): boolean {
    const enabledPredicateFnArgs = givenEnabledPredicateFnArgs ?? [];
    const foundCommand = this.commands[name];

    if (foundCommand == null) {
      return false;
    }

    return foundCommand.enabledPredicateFn.apply(null, enabledPredicateFnArgs);
  }

  register<T>(name: string, callbackFn: CommandCallbackFn<T>, options?: CommandRegistrationOptions): void {
    this.doRegisterCommand<T>(
      name,
      options?.description ?? null,
      options?.visibleInSearch ?? false,
      callbackFn,
      options?.enabledWhen ?? null,
      options?.expectsContext ?? false,
    );
  }

  private doRegisterCommand<T>(
    name: string,
    description: string | string[] | null,
    visibleInSearch: boolean,
    callbackFn: CommandCallbackFn<T>,
    enabledPredicateFn: CommandEnabledPredicateFn | null,
    expectsCommandContext: boolean,
  ): void {
    const nameIsInvalid = name.match(NAME_INVALID_REGEX) != null;
    if (nameIsInvalid) {
      throw new Error(`Command name is not valid: ${name} (valid characters are ${NAME_VALID_CHARATERS_AS_SENTENCE})`);
    }
    if (this.commands[name] != null) {
      throw new Error(`Command already registered: ${name}`);
    }

    description = description || this.getDefaultDescription(name);
    if (Array.isArray(description)) {
      description = description.join('\n');
    }

    enabledPredicateFn = enabledPredicateFn || (() => true);

    this.commands[name] = {
      name,
      description,
      visibleInSearch: visibleInSearch,
      callbackFn,
      enabledPredicateFn,
      expectsCommandContext,
    };
  }

  /**
   * Removes a previously registered command. Used by the PluginHostBridge
   * to clean up commands registered by plugins on dispose/refresh.
   */
  unregister(commandName: string): void {
    delete this.commands[commandName];
  }

  /**
   * Internal: Used by tests.
   *
   * Returns a default description for the command with the given `name`.
   */
  getDefaultDescription(name: string): string {
    const [first, ...rest] = name.replace(CommandManager.BIFROST_COMMAND_PREFIX_REGEX, '').split('.');
    const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.substring(1);
    const title = rest.join(' ').replace(/-/g, ' ');

    const second = title.replace(/([A-Z])/g, ' $1').toLowerCase();

    return capitalize(first) + ': ' + capitalize(second);
  }

  private getCommandNotFoundErrorMessage(name: string): string {
    const commandNames = this.getCommands().map((command: Command) => command.name);
    const suggestion = getClosestMatch(name, commandNames);

    return `Command '${name}' is not registered. Did you mean '${suggestion}'?`;
  }
}
