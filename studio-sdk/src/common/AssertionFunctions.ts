import type { CommandContext, CommandContext_Generic, CommandContext_Keybinding } from '../contracts/CommandTypes';

/**
 * Used for those situations where you *know* that a value cannot possibly be `null`.
 *
 * But you want/need to check at runtime to fail early and produce a clear error message.
 */
export function assertNotNull<T = any>(
  value: T,
  nameForErrorMessage: string,
  context?: any,
): asserts value is NonNullable<T> {
  if (value == null) {
    const suffix = context == null ? '' : `\n\nContext:\n\n${JSON.stringify(context, null, 2)}`;
    throw new Error(`Unexpected value: \`${nameForErrorMessage}\` should not be null here.${suffix}`);
  }
}

export function assertGenericCommandContext(ctx: CommandContext): asserts ctx is CommandContext_Generic {
  if (ctx?.type != 'generic') {
    const json = JSON.stringify(ctx, null, 2);
    throw new Error(`Unexpected value: The given CommandContext should be of type 'generic' here, got: ${json}`);
  }
}

export function assertKeybindingCommandContext(ctx: CommandContext): asserts ctx is CommandContext_Keybinding {
  if (ctx?.type !== 'keybinding') {
    throw new Error(
      `Unexpected value: \`ctx\` should have type 'keybinding' here, got ${JSON.stringify(ctx, null, 2)}`,
    );
  }
}
