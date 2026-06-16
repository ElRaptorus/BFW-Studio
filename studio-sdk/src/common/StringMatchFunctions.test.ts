import * as assert from 'assert';

import { getClosestMatch } from './StringMatchFunctions';

const COMMAND_NAMES = ['open', 'close', 'save', 'revert', 'select', 'copy', 'duplicate', 'add', 'subtract'];

describe('StringMatchFunctions', () => {
  it('getClosestMatch()', () => {
    const suggestion = getClosestMatch('subtact', COMMAND_NAMES);

    assert.deepStrictEqual(suggestion, 'subtract');
  });
});
