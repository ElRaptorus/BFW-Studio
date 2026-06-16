import type CommandStack from 'diagram-js/lib/command/CommandStack';

/**
 * Bundles multiple sub-commands into one undo step.
 * Mirrors bpmn-core/bpmn-js/CommandHandler/MultiCommandHandler.
 */
export function MultiCommandHandler(this: any, commandStack: CommandStack): void {
  this._commandStack = commandStack;
}

MultiCommandHandler.$inject = ['commandStack'];

MultiCommandHandler.prototype.preExecute = function (context: any[]) {
  const commandStack = this._commandStack;

  context.forEach((command: any) => {
    commandStack.execute(command.cmd, command.context);
  });
};

export default MultiCommandHandler;
