import { getClosestMatch } from '#bifrost/common/StringMatchFunctions';
import assert from 'node:assert';
import { describe, it } from 'vitest';

const COMMAND_NAMES = ['open', 'close', 'save', 'revert', 'select', 'copy', 'duplicate', 'add', 'subtract'];

describe('StringMatchFunctions', () => {
  it('getClosestMatch()', () => {
    const suggestion = getClosestMatch('subtact', COMMAND_NAMES);

    assert.deepStrictEqual(suggestion, 'subtract');
  });
});
