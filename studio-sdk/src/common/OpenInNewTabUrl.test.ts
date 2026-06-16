import * as assert from 'assert';
import 'mocha';

import { getUrlForOpenInNewTab, isUrlForOpenInNewTab, parseOpenInNewTabUrl } from './OpenInNewTabUrl';

const LOOKS_LIKE_A_STRING_BUT_IS_ACTUALLY_NULL = null as any as string;

describe('OpenInNewTabUrl', () => {
  it('works w/ getUrlForOpenInNewTab', () => {
    const expected = {
      type: 'test-type',
      parentUri: 'file://something important/somewhere',
      fragmentId: '#my crazy id',
      data: {},
    };
    const { type, parentUri, fragmentId } = expected;
    const result = getUrlForOpenInNewTab(type, parentUri, fragmentId);

    assert.equal(result, 'fragment+test-type:file%3A//something%20important/somewhere#!fragmentId=%23my%20crazy%20id');

    const result2 = parseOpenInNewTabUrl(result);

    assert.deepStrictEqual(result2, expected);
  });

  it('works w/ getUrlForOpenInNewTab for object params', () => {
    const expected = {
      type: 'test-type',
      parentUri: 'file://something important/somewhere',
      fragmentId: '#my crazy id',
      data: { bar: '42' },
    };
    const { type, parentUri, fragmentId, data } = expected;
    const result = getUrlForOpenInNewTab(type, parentUri, fragmentId, { ...data });

    assert.equal(
      result,
      'fragment+test-type:file%3A//something%20important/somewhere#!bar=42&fragmentId=%23my%20crazy%20id',
    );

    const result2 = parseOpenInNewTabUrl(result);

    assert.deepStrictEqual(result2, expected);
  });

  it('works w/ parseOpenInNewTabUrl', () => {
    const result = parseOpenInNewTabUrl('fragment+test-type:file://something/somewhere#!fragmentId=#my crazy id');
    const expected = {
      type: 'test-type',
      parentUri: 'file://something/somewhere',
      fragmentId: '#my crazy id',
      data: {},
    };

    assert.deepStrictEqual(result, expected);
  });

  it('works w/ parseOpenInNewTabUrl w/ excess parameters', () => {
    const result = parseOpenInNewTabUrl(
      'fragment+test-type:file://something/somewhere#!fragmentId=#my crazy id&excessParam=42',
    );
    const expected = {
      type: 'test-type',
      parentUri: 'file://something/somewhere',
      fragmentId: '#my crazy id',
      data: { excessParam: '42' },
    };

    assert.deepStrictEqual(result, expected);
  });

  it('throws an exception w/ parseOpenInNewTabUrl w/ null and empty string', () => {
    assert.throws(() => parseOpenInNewTabUrl(LOOKS_LIKE_A_STRING_BUT_IS_ACTUALLY_NULL));
    assert.throws(() => parseOpenInNewTabUrl(''));
  });

  it('works w/ isUrlForOpenInNewTab', () => {
    assert.equal(true, isUrlForOpenInNewTab('fragment+test-type:file://something/somewhere#!fragmentId=#my crazy id'));
    assert.equal(
      false,
      isUrlForOpenInNewTab('fragment:not-the-correct-protocol:file://something/somewhere#!#my crazy id'),
    );

    assert.equal(false, isUrlForOpenInNewTab(LOOKS_LIKE_A_STRING_BUT_IS_ACTUALLY_NULL));
    assert.equal(false, isUrlForOpenInNewTab(''));
  });
});
