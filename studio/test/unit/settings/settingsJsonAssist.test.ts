import { LocalStorageItem } from '#bifrost/common/LocalStorageItem';
import { SettingsMediator } from '#bifrost/common/SettingsMediator';
import { validateSettings } from '#bifrost/common/SettingsValidator';
import type { JsonPathLocation } from '#components/code-editor/jsonSyntaxPaths';
import ScopedSettingsDocumentModel, {
  ineligibleSettingMessage,
} from '#modules/std/settings/ScopedSettingsDocumentModel';
import UserSettingsDocumentModel from '#modules/std/settings/UserSettingsDocumentModel';
import { createSettingsJsonAssist } from '#modules/std/settings/validation/settingsJsonAssist';
import { describe, expect, it } from 'vitest';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

const registry = new Map<string, SettingDescriptor>([
  [
    'workbench.general.theme',
    {
      type: 'string',
      label: 'Theme',
      description: 'Active theme id.',
      markdownDescription: 'The **active** theme.',
      default: 'dark',
      enum: ['dark', 'light'],
      enumDescriptions: ['Dark colours', 'Light colours'],
    },
  ],
  ['bpmn.editor.showGrid', { type: 'boolean', label: 'Grid', description: 'Show the grid.', default: false }],
  ['legacy.flag', { type: 'boolean', label: 'Legacy', description: 'Old.', default: false, deprecated: 'Use x.' }],
  ['tags', { type: 'array', label: 'Tags', description: 'Tags.', default: [], items: { type: 'string' } }],
  [
    'engine.connections',
    {
      type: 'array',
      label: 'Connections',
      description: 'Engines.',
      default: [],
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', label: 'URL', description: 'Engine URL.', default: 'http://localhost' },
          port: { type: 'integer', label: 'Port', description: 'Port.', default: 8080 },
        },
      },
    },
  ],
]);

const assist = createSettingsJsonAssist(registry, {
  validateLayer: (layer) => validateSettings(layer, registry).errors,
  isKeyOffered: (key) => key !== 'tags',
});

function at(location: Partial<JsonPathLocation>): JsonPathLocation {
  return { path: [], slot: 'key', key: null, from: 0, to: 0, existingKeys: [], ...location };
}

describe('createSettingsJsonAssist', () => {
  it('rejects a layer that is not an object', () => {
    expect(assist.validate([])).toEqual([
      { path: [], message: 'Settings layer must be a JSON object.', severity: 'error' },
    ]);
  });

  it('warns on unknown and deprecated keys at the key', () => {
    expect(assist.validate({ 'no.such': 1, 'legacy.flag': true })).toEqual([
      { path: ['no.such'], target: 'key', message: 'Unknown setting.', severity: 'warning' },
      { path: ['legacy.flag'], target: 'key', message: 'Use x.', severity: 'warning', deprecated: true },
    ]);
  });

  it('reports save-time errors at the exact item', () => {
    const diagnostics = assist.validate({ tags: ['a', 2], 'engine.connections': [{ url: 'x', port: 'nope' }] });
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ['tags', 1],
      ['engine.connections', 0, 'port'],
    ]);
    expect(diagnostics.every((diagnostic) => diagnostic.severity === 'error')).toBe(true);
  });

  it('describes with markdownDescription first, down to item properties', () => {
    expect(assist.describe?.(['workbench.general.theme'])).toBe('**Theme**\n\nThe **active** theme.');
    expect(assist.describe?.(['engine.connections', 0, 'url'])).toBe('**URL**\n\nEngine URL.');
    expect(assist.describe?.(['legacy.flag'])).toContain('**Deprecated:** Use x.');
    expect(assist.describe?.(['tags', 0])).toBeNull();
  });

  it('completes offered root keys that are not present yet, with their default', () => {
    const completions = assist.complete?.(at({ existingKeys: ['bpmn.editor.showGrid'] })) ?? [];
    expect(completions.map((completion) => completion.label)).toEqual([
      'workbench.general.theme',
      'legacy.flag',
      'engine.connections',
    ]);
    expect(completions[0]).toMatchObject({
      insertText: '"workbench.general.theme": "dark"',
      detail: 'Theme',
      info: 'Active theme id.',
    });
  });

  it('completes keys of object items', () => {
    const completions = assist.complete?.(at({ path: ['engine.connections', 0], existingKeys: ['url'] })) ?? [];
    expect(completions.map((completion) => completion.insertText)).toEqual(['"port": 8080']);
  });

  it('completes enum values with descriptions and booleans', () => {
    expect(assist.complete?.(at({ path: ['workbench.general.theme'], slot: 'value' }))).toEqual([
      { label: 'dark', insertText: '"dark"', detail: 'Dark colours' },
      { label: 'light', insertText: '"light"', detail: 'Light colours' },
    ]);
    expect(
      assist.complete?.(at({ path: ['bpmn.editor.showGrid'], slot: 'value' })).map((item) => item.insertText),
    ).toEqual(['true', 'false']);
    expect(assist.complete?.(at({ path: ['engine.connections', 0, 'port'], slot: 'value' }))).toEqual([
      { label: '8080', insertText: '8080', detail: 'Default' },
    ]);
  });
});

describe('ScopedSettingsDocumentModel.getJsonAssist', () => {
  async function solutionModel(): Promise<ScopedSettingsDocumentModel> {
    const settings = new SettingsMediator(
      new LocalStorageItem({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, 'Settings'),
    );
    settings.register({
      'workbench.general.theme': { type: 'string', label: 'Theme', description: 'Theme.', default: 'dark' },
      'bpmn.editor.showGrid': {
        type: 'boolean',
        label: 'Grid',
        description: 'Grid.',
        default: false,
        scope: 'project',
      },
    });
    return ScopedSettingsDocumentModel.create(
      'about:settings-json?scope=solution',
      null,
      null,
      null as never,
      { settings } as never,
    );
  }

  it('reports the save-time error for keys that are not eligible for the scope', async () => {
    const backend = (await solutionModel()).getJsonAssist();
    expect(backend.validate({ 'workbench.general.theme': 'dark', 'bpmn.editor.showGrid': 'yes' })).toEqual([
      { path: ['workbench.general.theme'], message: ineligibleSettingMessage('solution'), severity: 'error' },
      { path: ['bpmn.editor.showGrid'], message: 'Expected boolean, got string', severity: 'error' },
    ]);
  });

  it('offers only eligible keys', async () => {
    const backend = (await solutionModel()).getJsonAssist();
    expect(backend.complete?.(at({})).map((completion) => completion.label)).toEqual(['bpmn.editor.showGrid']);
  });
});

describe('UserSettingsDocumentModel.saveEditorDocument', () => {
  it('rejects a document whose root is not an object, as the editor reports', async () => {
    const settings = new SettingsMediator(
      new LocalStorageItem({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, 'Settings'),
    );
    const model = await UserSettingsDocumentModel.create(
      'about:settings-json',
      null,
      null,
      null as never,
      {
        settings,
      } as never,
    );
    model.updateSettingsAsString('[]');

    expect(await model.saveEditorDocument()).toBe(false);
    expect(model.getLastValidationResult()?.errors[0]?.message).toBe('Settings layer must be a JSON object.');
  });
});
