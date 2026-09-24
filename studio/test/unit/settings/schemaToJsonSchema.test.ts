import { LocalStorageItem } from '#bifrost/common/LocalStorageItem';
import { SettingsMediator } from '#bifrost/common/SettingsMediator';
import ScopedSettingsDocumentModel, {
  ineligibleSettingMessage,
} from '#modules/std/settings/ScopedSettingsDocumentModel';
import { buildJsonSchema } from '#modules/std/settings/validation/schemaToJsonSchema';
import assert from 'node:assert';
import { describe, it } from 'vitest';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

describe('buildJsonSchema', () => {
  it('rejects unregistered top-level keys so the editor can warn on leftovers', () => {
    const schema = buildJsonSchema(
      new Map<string, SettingDescriptor>([
        [
          'workbench.general.theme',
          {
            type: 'string',
            label: 'Theme',
            description: 'Active theme id.',
            default: 'dark',
          },
        ],
      ]),
    );

    assert.strictEqual(schema.additionalProperties, false);
    assert.ok(schema.properties['workbench.general.theme']);
  });

  it('marks registered keys that are not eligible for the scoped layer instead of calling them unknown', async () => {
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
    const model = await ScopedSettingsDocumentModel.create(
      'about:settings-json?scope=solution',
      null,
      null,
      null as never,
      { settings } as never,
    );

    const schema = model.getJsonSchema();

    assert.strictEqual(
      schema.properties['workbench.general.theme'].deprecationMessage,
      ineligibleSettingMessage('solution'),
    );
    assert.strictEqual(schema.properties['bpmn.editor.showGrid'].deprecationMessage, undefined);
  });
});
