import { getLanguageSupport, languageSupportIsConfigured } from '#components/code-editor/languageSupport';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('getLanguageSupport', () => {
  it('returns a non-empty extension for language ids the host actually uses', () => {
    const knownIds = ['json', 'javascript', 'html', 'xml'];

    for (const languageId of knownIds) {
      assert.strictEqual(
        languageSupportIsConfigured(languageId),
        true,
        `expected language support for '${languageId}'`,
      );
    }
  });

  it('does not throw for an unknown language id', () => {
    assert.doesNotThrow(() => getLanguageSupport('not-a-real-language'));
    assert.deepStrictEqual(getLanguageSupport('not-a-real-language'), []);
  });

  it('treats plaintext and empty ids as no language support', () => {
    assert.deepStrictEqual(getLanguageSupport('plaintext'), []);
    assert.deepStrictEqual(getLanguageSupport(''), []);
    assert.deepStrictEqual(getLanguageSupport(undefined), []);
  });

  it('does not register languages that no host callsite passes', () => {
    const unusedIds = ['typescript', 'css', 'markdown', 'yaml', 'python', 'shell'];
    for (const languageId of unusedIds) {
      assert.strictEqual(
        languageSupportIsConfigured(languageId),
        false,
        `did not expect language support for unused id '${languageId}'`,
      );
    }
  });
});
