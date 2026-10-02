import { initializeKeyBindings } from '#modules/std/initializers/initializeKeyBindings';
import { GO_TO_CATEGORY_COMMANDS } from '#modules/std/initializers/initializeWorkbenchCategories';
import assert from 'node:assert';
import { describe, it } from 'vitest';

type KeybindingsDefinition = { os: string; bindings: Record<string, Record<string, string>> };

function recordKeyBindings(): KeybindingsDefinition[] {
  const definitions: KeybindingsDefinition[] = [];
  const bifrostStandIn: any = {
    keybindings: { registerKeyBindings: (definition: KeybindingsDefinition) => definitions.push(definition) },
  };
  initializeKeyBindings(bifrostStandIn);
  return definitions;
}

/** All keystroke → command pairs that apply to `os`, including the `*` definitions. */
function bindingsForOs(definitions: KeybindingsDefinition[], os: string): [string, string][] {
  return definitions
    .filter((definition) => definition.os === os || definition.os === '*')
    .flatMap((definition) => Object.values(definition.bindings).flatMap((commandMap) => Object.entries(commandMap)));
}

const GO_TO_PREFIX_PER_OS: Record<string, string> = { windows: 'alt', linux: 'alt', macos: 'cmd-alt' };

describe('category go-to key bindings', () => {
  const definitions = recordKeyBindings();

  for (const [os, prefix] of Object.entries(GO_TO_PREFIX_PER_OS)) {
    it(`binds ${prefix}-1…6 to the categories in header order on ${os}`, () => {
      const bindings = bindingsForOs(definitions, os);
      GO_TO_CATEGORY_COMMANDS.forEach(({ command }, index) => {
        const keystroke = `${prefix}-${index + 1}`;
        const commandsForKeystroke = bindings.filter(([bound]) => bound === keystroke).map(([, bound]) => bound);
        assert.deepStrictEqual(commandsForKeystroke, [command], `${keystroke} on ${os}`);
      });
    });
  }

  it('binds no ctrl-alt-<digit> keystroke, which Windows reports for AltGr characters', () => {
    const allKeystrokes = definitions.flatMap((definition) =>
      Object.values(definition.bindings).flatMap((commandMap) => Object.keys(commandMap)),
    );
    assert.deepStrictEqual(
      allKeystrokes.filter((keystroke) => /^ctrl-alt-\d$/.test(keystroke)),
      [],
    );
  });
});
