import { CategoryManager } from '#bifrost/common/CategoryManager';
import {
  GO_TO_CATEGORY_COMMANDS,
  initializeWorkbenchCategories,
} from '#modules/std/initializers/initializeWorkbenchCategories';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';

type RecordedCommand = { handler: () => void; enabledWhen: () => boolean };

let categories: CategoryManager;
let commands: Map<string, RecordedCommand>;

function createBifrostStandIn(): any {
  commands = new Map();
  return {
    categories,
    icons: { registerIcons: () => undefined },
    events: { on: () => undefined },
    settings: { get: () => false },
    commands: {
      register: (name: string, handler: () => void, options?: { enabledWhen?: () => boolean }) => {
        commands.set(name, { handler, enabledWhen: options?.enabledWhen ?? (() => true) });
      },
    },
  };
}

describe('category navigation commands', () => {
  beforeEach(() => {
    categories = new CategoryManager();
    initializeWorkbenchCategories(createBifrostStandIn());
  });

  it('registers one go-to command per category in header order', () => {
    assert.deepStrictEqual(
      GO_TO_CATEGORY_COMMANDS.map((entry) => entry.categoryId),
      ['home', 'design', 'discover', 'deploy', 'debug', 'control'],
    );
    for (const { command } of GO_TO_CATEGORY_COMMANDS) {
      assert.ok(commands.has(command), `${command} is registered`);
    }
  });

  it('activates the category when its command runs', () => {
    commands.get('std.workbench.goToControl')!.handler();
    assert.strictEqual(categories.getActiveCategoryId(), 'control');
    assert.strictEqual(categories.getActivePageId(), 'control/settings');
  });

  it('returns to the last used page of a category', () => {
    commands.get('std.workbench.goToControl')!.handler();
    categories.activatePage('control/about');
    commands.get('std.workbench.goToHome')!.handler();
    assert.strictEqual(categories.getActivePageId(), 'home/welcome');
    commands.get('std.workbench.goToControl')!.handler();
    assert.strictEqual(categories.getActivePageId(), 'control/about');
  });

  it('disables the command of a hidden category and does nothing when it runs', () => {
    const goToDesign = commands.get('std.workbench.goToDesign')!;
    assert.strictEqual(goToDesign.enabledWhen(), false);

    commands.get('std.workbench.goToHome')!.handler();
    goToDesign.handler();
    assert.strictEqual(categories.getActiveCategoryId(), 'home');

    categories.registerPage({ id: 'design/workspace', categoryId: 'design', label: 'Workspace', icon: 'x', order: 0 });
    assert.strictEqual(goToDesign.enabledWhen(), true);
    goToDesign.handler();
    assert.strictEqual(categories.getActiveCategoryId(), 'design');
  });
});
