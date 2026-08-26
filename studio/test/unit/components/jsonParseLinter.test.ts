import { lintJsonDocument } from '#components/code-editor/jsonParseLinter';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function lint(text: string): readonly { message: string }[] {
  const state = EditorState.create({ doc: text });
  return lintJsonDocument({ state } as EditorView);
}

describe('lintJsonDocument', () => {
  it('does not report an error for an empty document', () => {
    assert.deepStrictEqual(lint(''), []);
  });

  it('does not report an error for a whitespace-only document', () => {
    assert.deepStrictEqual(lint('  \n\t'), []);
  });

  it('does not report an error for valid JSON', () => {
    assert.deepStrictEqual(lint('{"type":"object"}'), []);
  });

  it('reports a parse error for incomplete JSON', () => {
    const diagnostics = lint('{');
    assert.ok(diagnostics.length > 0, 'expected a parse diagnostic');
    assert.match(diagnostics[0].message, /JSON/i);
  });

  it('reports a parse error for invalid JSON', () => {
    const diagnostics = lint('{oops}');
    assert.ok(diagnostics.length > 0, 'expected a parse diagnostic');
  });
});
