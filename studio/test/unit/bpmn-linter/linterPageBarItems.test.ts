import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';
import { initializePageBarItems } from '#modules/bpmn-linter/initializers/initializePageBarItems';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function pageBarItems(options: {
  focusedDocumentType: string | null;
  settings?: Record<string, unknown>;
  definedIn?: string;
}): MenuBarItem[] {
  let itemFactory: (() => MenuBarItem[]) | undefined;
  const bifrost = {
    editors: {
      getFocusedEditorDocument: () =>
        options.focusedDocumentType == null
          ? null
          : { uri: 'file:///p/a.bpmn', documentType: options.focusedDocumentType },
    },
    settings: {
      get: (key: string) => options.settings?.[key],
      inspect: () => ({ definedIn: options.definedIn ?? 'user' }),
      getProjectBaseUriForResource: () => 'file:///p',
    },
    solution: { getSolution: () => ({ projects: [{ name: 'Orders', baseUri: 'file:///p' }] }) },
    menuBar: {
      registerMenuBarItem: (_area: string, factory: () => MenuBarItem[]) => {
        itemFactory = factory;
      },
    },
  };
  initializePageBarItems(bifrost as any);
  assert.ok(itemFactory);
  return itemFactory();
}

describe('linter page bar items', () => {
  it('shows nothing unless a BPMN document is focused', () => {
    assert.deepStrictEqual(pageBarItems({ focusedDocumentType: null }), []);
    assert.deepStrictEqual(pageBarItems({ focusedDocumentType: 'dmn' }), []);
  });

  it('shows the ruleset icon and select with built-in and custom rulesets, regardless of live linting', () => {
    const items = pageBarItems({
      focusedDocumentType: 'bpmn',
      settings: {
        'bpmnLinter.enabled': false,
        'bpmnLinter.profile': 'strict',
        'bpmnLinter.customRulesets': { strict: {} },
      },
      definedIn: 'project',
    });
    assert.deepStrictEqual(
      items.map((item) => item.id),
      ['bpmn-linter-rule-selection-icon', 'bpmn-linter-profile-select'],
    );
    const select = items[1];
    assert.ok(select.type === 'select');
    assert.strictEqual(select.value, 'strict');
    assert.strictEqual(select.command, 'bpmn.linter.setProfile');
    assert.deepStrictEqual(
      select.entries.map((entry) => entry.value),
      ['bpmn-development', 'bpmn-production-ready', 'strict'],
    );
    assert.strictEqual(select.tooltip, 'Select Linter Ruleset (Project: Orders)');
  });

  it('falls back to the Development ruleset for an unknown profile', () => {
    const items = pageBarItems({ focusedDocumentType: 'bpmn', settings: { 'bpmnLinter.profile': 'gone' } });
    const select = items[1];
    assert.ok(select.type === 'select');
    assert.strictEqual(select.value, 'bpmn-development');
  });
});
