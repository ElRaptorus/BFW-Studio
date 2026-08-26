import { buildJsonSchema } from '#modules/std/settings/validation/schemaToJsonSchema';
import assert from 'node:assert';
import { describe, it } from 'vitest';

import type { SettingDescriptor } from '@evil/bifrost_fw_sdk';

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
});
