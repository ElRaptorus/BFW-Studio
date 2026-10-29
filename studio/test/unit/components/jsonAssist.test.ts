import { type JsonAssistBackend, createJsonAssistExtensions } from '#components/code-editor/jsonAssist';
import { type CompletionResult, type CompletionSource, CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

const backend: JsonAssistBackend = {
  validate: () => [],
  complete: (location) =>
    location.slot === 'key' ? [{ label: 'abc', insertText: '"abc": true' }] : [{ label: 'dark', insertText: '"dark"' }],
};

/** `|` marks the cursor. */
function complete(dialect: 'json' | 'jsonc', marked: string, explicit = false) {
  const pos = marked.indexOf('|');
  const state = EditorState.create({
    doc: marked.replace('|', ''),
    extensions: createJsonAssistExtensions(dialect, backend),
  });
  const context = new CompletionContext(state, pos, explicit);
  const results = state
    .languageDataAt<CompletionSource>('autocomplete', pos)
    .map((source) => source(context))
    .filter((result): result is CompletionResult => result != null && !(result instanceof Promise));
  return { state, pos, result: results[0] ?? null };
}

/** Applies the first option the way the autocomplete UI does and returns the new document. */
function accept(dialect: 'json' | 'jsonc', marked: string): string {
  const { state, pos, result } = complete(dialect, marked, true);
  let current = state;
  const view = {
    get state() {
      return current;
    },
    dispatch: (spec: Parameters<EditorState['update']>[0]) => {
      current = current.update(spec).state;
    },
  } as unknown as EditorView;
  const option = result!.options[0];
  (option.apply as (view: EditorView, completion: typeof option, from: number, to: number) => void)(
    view,
    option,
    result!.from,
    pos,
  );
  return current.doc.toString();
}

describe.each(['json', 'jsonc'] as const)('createJsonAssistExtensions completion (%s)', (dialect) => {
  it('filters a quoted partial key from after the quote', () => {
    const { result } = complete(dialect, '{ "ab|');
    expect(result?.from).toBe(3);
    expect(result?.options.map((option) => option.label)).toEqual(['abc']);
  });

  it('offers nothing in whitespace unless asked', () => {
    expect(complete(dialect, '{ | }').result).toBeNull();
    expect(complete(dialect, '{ | }', true).result?.from).toBe(2);
  });

  it('inserts key and default, replacing the quotes', () => {
    expect(accept(dialect, '{ "ab|" }')).toBe('{ "abc": true }');
    expect(accept(dialect, '{ "ab|')).toBe('{ "abc": true');
  });

  it('inserts only the key when a colon follows', () => {
    expect(accept(dialect, '{ "ab|": 1 }')).toBe('{ "abc": 1 }');
  });

  it('replaces the rest of the word after the cursor', () => {
    expect(accept(dialect, '{ "a|bx" }')).toBe('{ "abc": true }');
  });

  it('adds a comma when another property follows', () => {
    expect(accept(dialect, '{ "ab|"\n  "x": 1 }')).toBe('{ "abc": true,\n  "x": 1 }');
    expect(accept(dialect, '{ "x": 1, "ab|" }')).toBe('{ "x": 1, "abc": true }');
  });

  it('replaces a quoted partial value', () => {
    expect(accept(dialect, '{ "theme": "da|" }')).toBe('{ "theme": "dark" }');
  });
});

describe('createJsonAssistExtensions completion (jsonc only)', () => {
  it('replaces an unquoted partial key', () => {
    expect(complete('jsonc', '{ ab|').result?.from).toBe(2);
    expect(accept('jsonc', '{ ab|')).toBe('{ "abc": true');
  });
});
