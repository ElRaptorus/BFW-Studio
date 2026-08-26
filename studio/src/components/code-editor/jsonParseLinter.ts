import { jsonParseLinter } from '@codemirror/lang-json';
import { type Diagnostic, linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

const stockJsonParseLinter = jsonParseLinter();

/**
 * Strict JSON parse lint for contract / token / dialog editors.
 * Do not attach this to Settings JSON (JSONC comments); Settings uses
 * `json5Schema` instead.
 *
 * Blank and whitespace-only documents are not linted. Optional JSON
 * properties (payload/result contracts, unset tokens, …) mount an empty
 * editor; `JSON.parse('')` would otherwise show "Unexpected end of JSON
 * input" in the gutter. Incomplete or invalid JSON still reports.
 */
export function lintJsonDocument(view: EditorView): readonly Diagnostic[] {
  if (view.state.doc.toString().trim() === '') {
    return [];
  }
  return stockJsonParseLinter(view);
}

export function jsonParseLinterExtension(): Extension {
  return linter(lintJsonDocument);
}
