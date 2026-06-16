import type { Bifrost } from '#bifrost/Bifrost';
import { QuickJumpViewMediator } from '#bifrost/browser/QuickJumpViewMediator';

import type { CommandContext } from '@evil/bifrost_fw_sdk';
import { assertKeybindingCommandContext } from '@evil/bifrost_fw_sdk';

export function initializeQuickJumpCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register('std.quickJump.show', () =>
    bifrost.views.getById<QuickJumpViewMediator>('std/quick-jump').showRecentFiles(),
  );

  commands.register('std.quickJump.showCommands', () =>
    bifrost.views.getById<QuickJumpViewMediator>('std/quick-jump').showCommands(),
  );

  commands.register(
    'std.quickJump.hide',
    (ctx: CommandContext) => {
      if (ctx?.type !== 'keybinding') {
        throw new Error(`Unexpected value: \`ctx\` should have type 'keybinding' here, got ${JSON.stringify(ctx)}`);
      }

      bifrost.views
        .getByDomNode<QuickJumpViewMediator>(QuickJumpViewMediator, ctx?.keyboardEvent?.target as HTMLElement)
        .hide();
    },
    { expectsContext: true },
  );

  commands.register(
    'std.quickJump.selectPrevious',
    (ctx: CommandContext) => {
      assertKeybindingCommandContext(ctx);

      bifrost.views
        .getByDomNode<QuickJumpViewMediator>(QuickJumpViewMediator, ctx?.keyboardEvent?.target as HTMLElement)
        .selectPreviousEntry();
    },
    { expectsContext: true },
  );

  commands.register(
    'std.quickJump.selectNext',
    (ctx: CommandContext) => {
      assertKeybindingCommandContext(ctx);

      bifrost.views
        .getByDomNode<QuickJumpViewMediator>(QuickJumpViewMediator, ctx?.keyboardEvent?.target as HTMLElement)
        .selectNextEntry();
    },
    { expectsContext: true },
  );

  commands.register(
    'std.quickJump.openSelected',
    (ctx: CommandContext) => {
      assertKeybindingCommandContext(ctx);

      bifrost.views
        .getByDomNode<QuickJumpViewMediator>(QuickJumpViewMediator, ctx?.keyboardEvent?.target as HTMLElement)
        .openSelectedEntryAndClose();
    },
    { expectsContext: true },
  );
}
