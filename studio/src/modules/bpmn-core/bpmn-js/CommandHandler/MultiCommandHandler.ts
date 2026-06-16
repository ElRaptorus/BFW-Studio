import type CommandStack from 'diagram-js/lib/command/CommandStack';

/**
 * A handler that combines and executes multiple commands.
 *
 * All updates are bundled on the command stack and executed in one step.
 * This also makes it possible to revert the changes in one step.
 *
 * @class
 * @constructor
 */
export function MultiCommandHandler(this: any, commandStack: CommandStack): void {
  this._commandStack = commandStack;
}

MultiCommandHandler.$inject = ['commandStack'];

MultiCommandHandler.prototype.preExecute = function (context: any[]) {
  const commandStack = this._commandStack;

  context.forEach((command) => {
    commandStack.execute(command.cmd, command.context);
  });
};

export default MultiCommandHandler;
