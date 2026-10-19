import { getClosestMatch } from '#bifrost/common/StringMatchFunctions';
import assert from 'node:assert';
import { describe, it } from 'vitest';

const COMMAND_NAMES = ['open', 'close', 'save', 'revert', 'select', 'copy', 'duplicate', 'add', 'subtract'];

describe('StringMatchFunctions', () => {
  it('getClosestMatch()', () => {
    const suggestion = getClosestMatch('subtact', COMMAND_NAMES);

    assert.deepStrictEqual(suggestion, 'subtract');
  });

  it('returns null for an empty list', () => {
    assert.strictEqual(getClosestMatch('open', []), null);
  });

  it('prefers the candidate sharing a prefix with the search string', () => {
    const suggestion = getClosestMatch('std.editor.openDocumnt', [
      'std.editor.closeDocument',
      'std.editor.openDocument',
    ]);

    assert.strictEqual(suggestion, 'std.editor.openDocument');
  });

  it('compares case-sensitively', () => {
    assert.strictEqual(getClosestMatch('SAVE', ['save', 'SAVX']), 'SAVX');
  });
});
