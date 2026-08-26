import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type {
  Command,
  CommandCallbackFn,
  CommandContext,
  CommandRegistrationOptions,
  CommandResult,
} from '#bifrost/contracts/CommandTypes';
import type { DialogOptions, DialogResult, DialogValidationResult } from '#bifrost/contracts/DialogTypes';
import type { Debugger } from 'debug';
import Debug from 'debug';

import { CommandManager } from '../common/CommandManager';
import type { DialogManager } from '../common/DialogManager';
import type { NotificationManager } from '../common/NotificationManager';
import type { Performance } from '../common/Performance';

/**
 * Provides access to the commands of Bifrost and its modules.
 *
 * Commands are named, registered function callbacks with optional description, enabled predicate,
 * command search visibility, and context expectation — all controlled via a single options object.
 *
 * Registering a command visible in the command search palette:
 *
 *    bifrost.commands.register('std.editor.saveFocusedDocument',
 *      () => {
 *        const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
 *        // implement the save logic
 *      },
 *      { visibleInSearch: true, description: 'Editor: Save focused document' }
 *    )
 *
 * Registering an internal command (not in command search):
 *
 *    bifrost.commands.register('std.editor.saveDocument',
 *      (editorDocument: EditorDocument): void => {
 *        // implement the save logic
 *      }
 *    )
 *
 * Executing a command:
 *
 *    bifrost.commands.executeCommand('std.editor.saveFocusedDocument')
 */
export class CommandMediator extends AbstractEmitter {
  private dialog: DialogManager;
  private log: Debugger;
  private performance: Performance;
  private commandManager: CommandManager;
  private notifications: NotificationManager;
  /**
   * Circuit Breaker for preventing infinte rerendering loops, when an isCommandEnabledCheck fails
   * and then triggres a re-render by showing the proper error notification.
   * This way the notification is only shown once. No repeated re-renders. No notification spam.
   * */
  private isCommandEnabledErrors: Set<string>;

  constructor(dialog: DialogManager, performance: Performance, notifications: NotificationManager) {
    super();
    this.log = Debug(`/${this.constructor.name}`);

    this.dialog = dialog;
    this.performance = performance;
    this.notifications = notifications;

    this.commandManager = new CommandManager();
    this.isCommandEnabledErrors = new Set();
  }

  /**
   * Executes the command with the given `name`, provides the given `args` as parameters.
   *
   * Example:
   *
   *    bifrost.commands.executeCommand('std.editor.saveFocusedDocument')
   *    bifrost.commands.executeCommand('std.editor.saveFocusedDocument', ['file:///Users/hello/bifrost/kebap.bpmn'])
   *
   * Returns the result of the registered callback. Throws an Error if the execution fails.
   */
  executeCommand<T = any>(name: string, commandArgs: any[] = [], commandContext?: CommandContext): T {
    let commandResult: T;
    this.log('executeCommand', 'name:', name, 'commandContext:', commandContext, 'args:', commandArgs);

    this.performance.mark(`bifrost:executeCommand ${name} #start`);
    if (this.isCommandEnabled(name, commandArgs)) {
      commandResult = this.commandManager.executeCommand<T>(name, commandArgs, commandContext);
    } else {
      throw new Error(`Executed command is not enabled: ${name} (commandArgs given: ${JSON.stringify(commandArgs)})`);
    }
    this.performance.mark(`bifrost:executeCommand ${name} #end`);

    return commandResult;
  }

  /**
   * Executes the command with the given `name`, provides the given `args` as parameters.
   *
   * Example:
   *
   *    bifrost.commands.tryToExecuteCommand('std.editor.saveFocusedDocument')
   *    bifrost.commands.tryToExecuteCommand('std.editor.saveFocusedDocument', ['file:///Users/hello/bifrost/kebap.bpmn'])
   *
   * Returns a CommandResult which contains an Error if the execution failed.
   */
  tryToExecuteCommand<T = any>(
    name: string,
    commandArgs: any[] = [],
    commandContext?: CommandContext,
  ): CommandResult<T> {
    let commandResult: CommandResult<T>;
    this.log('tryToExecuteCommand', 'name:', name, 'args:', commandArgs);

    this.performance.mark(`bifrost:tryToExecuteCommand ${name} #start`);
    if (this.isCommandEnabled(name, commandArgs)) {
      commandResult = this.commandManager.tryToExecuteCommand<T>(name, commandArgs, commandContext);
    } else {
      commandResult = {
        success: false,
        error: new Error(
          `Executed command is not enabled: ${name} (commandArgs given: ${JSON.stringify(commandArgs)})`,
        ),
      };
    }
    this.performance.mark(`bifrost:tryToExecuteCommand ${name} #end`);

    return commandResult;
  }

  /**
   * Returns whether the command with the given `name` is enabled.
   *
   * Example:
   *
   *    > bifrost.commands.isCommandEnabled('std.editor.saveFocusedDocument')
   *    false
   */
  isCommandEnabled(name: string, commandArgs?: any[]): boolean {
    if (!this.commandManager.isCommandRegistered(name)) {
      const content = `Error during isCommandEnabled: Command "${name}" not found`;
      this.showErrorNotificationOnce(content, name);

      return false;
    }

    try {
      return this.commandManager.isCommandEnabled(name, commandArgs);
    } catch (error) {
      const content = `Error during isCommandEnabled('${name}'): ${error.message}\n${error.stack}`;
      this.showErrorNotificationOnce(content, name);
      return false;
    }
  }

  /**
   * Returns `true` if a command with the given `commandName` is registered.
   */
  isRegistered(commandName: string): boolean {
    return this.commandManager.isCommandRegistered(commandName);
  }

  /**
   * Returns a click handler that can be used inside React components to easily execute commands.
   *
   * Example:
   *
   *      function HighFiveButton(props: any) {
   *        const bifrost: Bifrost = props.bifrost;
   *        const cmd = bifrost.commands.getClickHandler();
   *
   *        return (
   *          <div>
   *            <button onClick={cmd('give-one-high-five')}>Give 1 high five</button>
   *            <button onClick={cmd('give-multiple-high-fives', [42])}>Give 42 high fives</button>
   *          </div>
   *        );
   *      }
   */
  getClickHandler(): (commandName: string, commandArgs?: any[]) => (event: any) => void {
    return (commandName: string, commandArgs: any[] = []) => {
      if (!Array.isArray(commandArgs)) {
        throw new Error(`Expected \`commandArgs\` to be omitted or an Array, got ${JSON.stringify(commandArgs)}`);
      }

      return (clickEvent: any) => {
        const context: CommandContext = { type: 'mouse', mouseEvent: clickEvent };

        this.executeCommand(commandName, commandArgs, context);
      };
    };
  }

  /**
   * Returns all registered commands.
   */
  getCommands(): Command[] {
    return this.commandManager.getCommands();
  }

  /**
   * Returns all registered commands which are visible in command search and currently enabled.
   */
  getEnabledCommandsVisibleInSearch(): Command[] {
    return this.getCommands().filter(
      (command: Command) => command.visibleInSearch && this.isCommandEnabled(command.name),
    );
  }

  /**
   * Registers a command with the given name and callback.
   *
   * By default, commands are internal (not shown in the command search palette).
   * Use the `options` parameter to control visibility, description, context expectation,
   * and enabled predicate.
   */
  register<T>(name: string, callbackFn: CommandCallbackFn<T>, options?: CommandRegistrationOptions): void {
    this.commandManager.register<T>(name, callbackFn, options);
  }

  /**
   * Removes a previously registered command. Used by the PluginHostBridge
   * to clean up commands registered by plugins on dispose/refresh.
   */
  unregister(commandName: string): void {
    this.commandManager.unregister(commandName);
  }

  private async showErrorNotificationOnce(content: string, source: string): Promise<void> {
    if (this.isCommandEnabledErrors.has(content)) {
      return;
    }

    this.isCommandEnabledErrors.add(content);

    this.notifications.open(
      {
        type: 'error',
        content: content,
        source: source,
        actions: [
          {
            label: 'Show Error',
            action: 'open-dialog',
          },
        ],
      },
      (response) => {
        if (response.action == 'open-dialog') {
          this.showCopyErrorDialog(`isCommandEnabled('${name}') Error`, content);
        }
      },
    );
  }

  private async showCopyErrorDialog(title: string, content: string): Promise<void> {
    const dialogOptions: DialogOptions = {
      title: title,
      content: [
        {
          type: 'text_input',
          id: 'error',
          multiline: /\n/.test(content),
          value: content,
          readonly: true,
          focus: true,
        },
      ],
      actions: [
        { label: 'Close', response: 'close', cancel: true },
        { label: 'Copy & Close', response: 'copyAndClose', default: true },
      ],
    };
    const dialogValidation = async (dialogResult: DialogResult): Promise<DialogValidationResult> => {
      if (dialogResult.response === 'copyAndClose') {
        // This has to happen during validation for the text input to still be present and "copy-able"
        navigator.clipboard.writeText(content);
      }

      return { closeDialog: true };
    };

    await this.dialog.open(dialogOptions, dialogValidation);
  }
}
