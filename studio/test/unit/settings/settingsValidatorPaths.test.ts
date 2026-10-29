import { validateSetting } from '#bifrost/common/SettingsValidator';
import { describe, expect, it } from 'vitest';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

const connections: SettingDescriptor = {
  type: 'array',
  label: 'Connections',
  description: '',
  default: [],
  items: {
    type: 'object',
    properties: {
      url: { type: 'string', label: '', description: '', default: '' },
      auth: {
        type: 'object',
        label: '',
        description: '',
        default: {},
        properties: { user: { type: 'string', label: '', description: '', default: '' } },
      },
    },
  },
  maxItems: 2,
};

describe('validateSetting paths', () => {
  it('locates a top-level value', () => {
    expect(validateSetting('flag', 'yes', { type: 'boolean', label: '', description: '', default: false })).toEqual([
      { key: 'flag', message: 'Expected boolean, got string', expected: 'boolean', actual: 'string', path: ['flag'] },
    ]);
  });

  it('locates primitive items by index and keeps the key and message', () => {
    const errors = validateSetting('tags', ['a', 2], {
      type: 'array',
      label: '',
      description: '',
      default: [],
      items: { type: 'string' },
    });
    expect(errors).toEqual([
      {
        key: 'tags',
        message: 'Item at index 1: expected string, got number',
        expected: 'string',
        actual: 'number',
        path: ['tags', 1],
      },
    ]);
  });

  it('locates properties of object items and nested objects', () => {
    const errors = validateSetting('connections', [{ url: 1 }, { auth: { user: 2 } }, 'x'], connections);
    expect(errors.map(({ key, path }) => ({ key, path }))).toEqual([
      { key: 'connections[0].url', path: ['connections', 0, 'url'] },
      { key: 'connections[1].auth.user', path: ['connections', 1, 'auth', 'user'] },
      { key: 'connections', path: ['connections', 2] },
      { key: 'connections', path: ['connections'] },
    ]);
  });
});
