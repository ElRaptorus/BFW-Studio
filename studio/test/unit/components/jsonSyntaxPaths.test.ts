import { jsonPathAt, jsonRangeOf } from '#components/code-editor/jsonSyntaxPaths';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { json5 } from 'codemirror-json5';
import { describe, expect, it } from 'vitest';

const dialects = { json: json(), json5: json5() };

function stateOf(dialect: keyof typeof dialects, doc: string): EditorState {
  return EditorState.create({ doc, extensions: [dialects[dialect]] });
}

/** `|` marks the position. */
function locate(dialect: keyof typeof dialects, marked: string) {
  const pos = marked.indexOf('|');
  const state = stateOf(dialect, marked.replace('|', ''));
  const location = jsonPathAt(state, pos);
  return location == null ? null : { ...location, text: state.sliceDoc(location.from, location.to) };
}

describe.each(['json', 'json5'] as const)('jsonPathAt (%s)', (dialect) => {
  it('finds a partially typed quoted key at the root', () => {
    expect(locate(dialect, '{ "bpmn.ed|')).toMatchObject({ path: [], slot: 'key', key: 'bpmn.ed', text: '"bpmn.ed' });
  });

  it('finds a closed quoted key and lists the other keys', () => {
    expect(locate(dialect, '{ "a": 1, "b|": 2 }')).toMatchObject({
      path: [],
      slot: 'key',
      key: 'b',
      text: '"b"',
      existingKeys: ['a'],
    });
  });

  it('finds a partially typed key after a complete property', () => {
    expect(locate(dialect, '{ "a": [1, 2], "b|')).toMatchObject({
      path: [],
      slot: 'key',
      key: 'b',
      existingKeys: ['a'],
    });
  });

  it('treats the position after a colon as the value of that property', () => {
    expect(locate(dialect, '{ "a": |')).toMatchObject({ path: ['a'], slot: 'value', text: '' });
  });

  it('builds paths through arrays and nested objects', () => {
    expect(locate(dialect, '{ "a": [ { "x": |')).toMatchObject({ path: ['a', 0, 'x'], slot: 'value' });
    expect(locate(dialect, '{ "a": [ 1, { "x": tr|')).toMatchObject({ path: ['a', 1, 'x'], slot: 'value', text: 'tr' });
  });

  it('finds a partially typed string value', () => {
    expect(locate(dialect, '{ "theme": "da|" }')).toMatchObject({ path: ['theme'], slot: 'value', text: '"da"' });
  });

  it('offers keys in whitespace of an object', () => {
    expect(locate(dialect, '{ "a": 1, | }')).toMatchObject({ path: [], slot: 'key', key: null, existingKeys: ['a'] });
  });

  it('counts array items in whitespace', () => {
    expect(locate(dialect, '{ "a": [1, 2, |] }')).toMatchObject({ path: ['a', 2], slot: 'value' });
  });
});

describe('jsonPathAt (json5 only)', () => {
  it('finds an unquoted key being typed', () => {
    expect(locate('json5', '{ bpm|')).toMatchObject({ path: [], slot: 'key', key: 'bpm', text: 'bpm' });
  });

  it('skips comments', () => {
    expect(locate('json5', '{ a: 1, // c\n bp| }')).toMatchObject({
      path: [],
      slot: 'key',
      key: 'bp',
      existingKeys: ['a'],
    });
  });
});

describe.each(['json', 'json5'] as const)('jsonRangeOf (%s)', (dialect) => {
  const doc = '{ "a": [1, { "x": true }], "b": "text" }';
  const state = stateOf(dialect, doc);
  const textAt = (path: (string | number)[], target?: 'key' | 'value') => {
    const range = jsonRangeOf(state, path, target);
    return range == null ? null : doc.slice(range.from, range.to);
  };

  it('finds values by path', () => {
    expect(textAt(['a', 1, 'x'])).toBe('true');
    expect(textAt(['b'])).toBe('"text"');
    expect(textAt([])).toBe(doc);
  });

  it('finds property names', () => {
    expect(textAt(['b'], 'key')).toBe('"b"');
    expect(textAt(['a', 1, 'x'], 'key')).toBe('"x"');
  });

  it('falls back to the deepest existing value', () => {
    expect(textAt(['a', 5])).toBe('[1, { "x": true }]');
    expect(textAt(['missing', 'deeper'])).toBe(doc);
  });

  it('marks the last of duplicate keys, the one parsers keep', () => {
    const duplicate = '{ "a": 1, "a": 2 }';
    const range = jsonRangeOf(stateOf(dialect, duplicate), ['a']);
    expect(range == null ? null : range.from).toBe(duplicate.lastIndexOf('2'));
  });

  it('returns null for an empty document', () => {
    expect(jsonRangeOf(stateOf(dialect, ''), [])).toBeNull();
  });
});
