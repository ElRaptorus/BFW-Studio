import { describe, expect, it } from 'vitest';

import { isImportedReference, splitQualifiedReference } from '../../../src/modules/dmn-core/qualifiedReference';

// Mirrors BfwEngine.DMN.QualifiedReference.split/1, which splits on the first '#'.
describe('splitQualifiedReference', () => {
  it('treats plain ids and #id as local', () => {
    expect(splitQualifiedReference('Decision_1')).toEqual({ namespace: null, elementId: 'Decision_1' });
    expect(splitQualifiedReference('#Decision_1')).toEqual({ namespace: null, elementId: 'Decision_1' });
  });

  it('splits namespace and element on the first #', () => {
    expect(splitQualifiedReference('https://example.test/ns#Decision_1')).toEqual({
      namespace: 'https://example.test/ns',
      elementId: 'Decision_1',
    });
    expect(splitQualifiedReference('ns#a#b')).toEqual({ namespace: 'ns', elementId: 'a#b' });
  });

  it("keeps an empty element as a local id, which fails the lookup just like the Engine's :invalid", () => {
    expect(splitQualifiedReference('ns#')).toEqual({ namespace: null, elementId: 'ns#' });
    expect(splitQualifiedReference('')).toEqual({ namespace: null, elementId: '' });
  });

  it('reports imported references', () => {
    expect(isImportedReference('ns#id')).toBe(true);
    expect(isImportedReference('#id')).toBe(false);
    expect(isImportedReference('ns#')).toBe(false);
  });
});
